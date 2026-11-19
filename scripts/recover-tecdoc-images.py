#!/usr/bin/env python3
"""Réimport des images manquantes des pièces VENDABLES depuis TecDoc.

Voie d'import (inchangée) :
  1. catalogue web TecDoc (Playwright, compte de l'owner) : recherche de
     l'article, lecture de la réponse « TecdocToCat » qui donne, pour le
     fournisseur TecDoc (DLNR = dossier `pmi_folder`), le nom de fichier et
     l'URL CDN de chaque image ;
  2. téléchargement depuis le CDN digital-assets.tecalliance.services ;
  3. envoi dans le bucket Supabase `rack-images`, objet `<pmi_folder>/<pmi_name>`
     (nom brut de pieces_media_img, jamais renommé ni converti).

Sélection : uniquement les images affichables (pmi_display='1') des pièces
vendables dont l'objet manque, lues par scripts/recover-tecdoc-images.sql
(requête unique, lots de piece_id, transaction en lecture seule). La définition
de « vendable » n'est pas recopiée ici : la requête appelle
public.piece_est_vendable (PR #2191). Règle de l'owner (19/11/2026) : import
après la première mise à jour complète du tarif d'un fournisseur, contrôle des
images manquantes aux mises à jour suivantes
(.claude/knowledge/ops/supplier-brand-price-load-procedure.md).

Usage :
  # rapport à blanc, tous fournisseurs (base en lecture seule)
  python3 scripts/recover-tecdoc-images.py --rapport scripts/logs/images-a-blanc
  # rapport à blanc hors ligne, depuis un export CSV de la requête
  python3 scripts/recover-tecdoc-images.py --inventaire-csv inv.csv --rapport out/
  # exécution réelle : UN fournisseur à la fois (Bosch d'abord), owner seulement
  python3 scripts/recover-tecdoc-images.py --marque 730 --commit

Environnement (jamais affiché ni journalisé ; aucun fichier .env n'est lu) :
  DATABASE_URL                lecture de l'inventaire (sauf --inventaire-csv)
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   envoi dans rack-images (--commit)
  TECDOC_EMAIL, TECDOC_PASS   connexion au catalogue TecDoc (--commit)

Codes de sortie :
  0  terminé ; aucune erreur technique (des images peuvent rester introuvables)
  1  terminé avec des erreurs techniques de téléchargement ou d'envoi
  2  configuration ou lecture impossible (variable absente, dépendance absente,
     requête en échec — y compris fonction piece_est_vendable absente)
  3  arrêt de sécurité : recherches en échec à la suite (session TecDoc morte),
     état enregistré, reprise possible
  4  connexion TecDoc refusée
  5  une autre exécution tient le verrou
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import logging
import mimetypes
import os
import random
import re
import sys
import tempfile
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Protocol
from urllib.parse import quote

ICI = Path(__file__).resolve().parent
RACINE = ICI.parent
FICHIER_SQL = ICI / "recover-tecdoc-images.sql"
REGISTRE_MARQUES = RACINE / ".spec/00-canon/repository-registry/brand-folder-registry.yaml"
DOSSIER_JOURNAUX = ICI / "logs"
ETAT_PAR_DEFAUT = DOSSIER_JOURNAUX / "recover-tecdoc-images-etat.json"

BUCKET = "rack-images"
PORTAIL_ACCUEIL = "https://web.tecalliance.net/tecdoc/fr/home"
CHAMP_RECHERCHE = 'input[placeholder="Recherche par numéro quelconque"]'

DELAI_RECHERCHE_MIN = 5.0
DELAI_RECHERCHE_MAX = 10.0
DELAI_TELECHARGEMENT = 0.5
TAILLE_LOT_PIECES = 50000
STATEMENT_TIMEOUT_MS = 58000

# Caractères acceptés par Supabase Storage dans une clé d'objet. Les noms hors
# de cet ensemble (ex. « MS902.0 [TEC DOC].JPG », refusé InvalidKey en avril)
# sont signalés, jamais envoyés ni renommés.
CLE_STORAGE_VALIDE = re.compile(r"^(\w|/|!|-|\.|\*|'|\(|\)| |&|\$|@|=|;|:|\+|,|\?)*$")

COLONNES_INVENTAIRE = (
    "piece_id", "pm_id", "piece_ref", "images_affichables", "images_presentes",
    "classe", "pmi_folder", "pmi_name",
)

# Causes d'échec. Les causes « à réessayer » sont reprises à l'exécution
# suivante ; les autres sont définitives sauf --reessayer-tout.
A_REESSAYER = {"erreur_recherche", "erreur_telechargement", "erreur_envoi"}
DEFINITIVES = {"article_sans_image", "nom_sans_correspondance", "nom_invalide_storage", "dossier_vide"}

SORTIE_OK, SORTIE_ERREURS, SORTIE_CONFIG, SORTIE_DISJONCTEUR, SORTIE_CONNEXION, SORTIE_VERROU = range(6)

log = logging.getLogger("recover-tecdoc-images")


class ErreurConfiguration(Exception):
    """Configuration ou lecture impossible (code 2)."""


class ErreurRecherche(Exception):
    """La recherche n'a pas abouti (champ absent, délai, aucune réponse)."""


# --------------------------------------------------------------------------
# Inventaire
# --------------------------------------------------------------------------

@dataclass(frozen=True)
class LigneInventaire:
    piece_id: int
    pm_id: str
    piece_ref: str
    images_affichables: int
    images_presentes: int
    classe: str
    pmi_folder: str
    pmi_name: str


def ligne_depuis(valeurs: Iterable) -> LigneInventaire:
    v = ["" if x is None else str(x) for x in valeurs]
    if len(v) != len(COLONNES_INVENTAIRE):
        raise ErreurConfiguration(f"ligne d'inventaire à {len(v)} colonnes, {len(COLONNES_INVENTAIRE)} attendues")
    return LigneInventaire(int(v[0]), v[1], v[2], int(v[3]), int(v[4]), v[5], v[6], v[7])


def lire_inventaire_csv(chemin: Path) -> list[LigneInventaire]:
    lignes = []
    with open(chemin, newline="", encoding="utf-8") as f:
        for row in csv.reader(f):
            if not row or row == ["SET"] or row[0] == "piece_id":
                continue
            lignes.append(ligne_depuis(row))
    return lignes


def lire_inventaire_base(dsn: str, taille_lot: int = TAILLE_LOT_PIECES) -> list[LigneInventaire]:
    """Lit l'inventaire par lots de piece_id, transaction en lecture seule."""
    try:
        import psycopg2  # noqa: PLC0415 — dépendance chargée seulement si la base est lue
    except ImportError as e:
        raise ErreurConfiguration("psycopg2 absent : pip install -r scripts/requirements-recover-tecdoc-images.txt") from e
    requete = FICHIER_SQL.read_text(encoding="utf-8")
    try:
        conn = psycopg2.connect(dsn, application_name="recover-tecdoc-images")
    except Exception as e:  # le message peut contenir l'hôte : seule la classe est écrite
        raise ErreurConfiguration(f"connexion à la base impossible ({type(e).__name__})") from None
    try:
        conn.set_session(readonly=True)
        with conn.cursor() as cur:
            cur.execute(f"SET statement_timeout = {STATEMENT_TIMEOUT_MS}")
            cur.execute(
                "SELECT min(piece_id) FROM (SELECT piece_id, (row_number() OVER (ORDER BY piece_id) - 1) / %s AS g"
                " FROM pieces) t GROUP BY g ORDER BY 1",
                (taille_lot,),
            )
            bornes = [r[0] for r in cur.fetchall()] + [2**31 - 1]
            lignes: list[LigneInventaire] = []
            for k in range(len(bornes) - 1):
                cur.execute(requete, {"id_min": bornes[k], "id_max": bornes[k + 1]})
                lignes.extend(ligne_depuis(r) for r in cur.fetchall())
                log.info("inventaire : lot %d/%d lu", k + 1, len(bornes) - 1)
            return lignes
    except ErreurConfiguration:
        raise
    except Exception as e:
        code = getattr(e, "pgcode", None)
        raise ErreurConfiguration(f"lecture de l'inventaire en échec ({type(e).__name__}, pgcode={code})") from None
    finally:
        conn.close()


def charger_registre(chemin: Path = REGISTRE_MARQUES) -> dict[str, dict]:
    """pm_id -> {nom, dossier} depuis le registre marque → dossier (canon)."""
    try:
        import yaml  # noqa: PLC0415
    except ImportError as e:
        raise ErreurConfiguration("PyYAML absent : pip install -r scripts/requirements-recover-tecdoc-images.txt") from e
    donnees = yaml.safe_load(chemin.read_text(encoding="utf-8"))
    return {
        str(b["pm_id"]): {"nom": b.get("name", ""), "dossier": str(b.get("primary_folder", ""))}
        for b in donnees.get("brands", [])
    }


# --------------------------------------------------------------------------
# État de reprise (écriture atomique après chaque article)
# --------------------------------------------------------------------------

class Etat:
    def __init__(self, chemin: Path):
        self.chemin = chemin
        self.donnees = {"version": 2, "recupere": {}, "echecs": {}}
        if chemin.exists():
            lu = json.loads(chemin.read_text(encoding="utf-8"))
            if lu.get("version") != 2:
                raise ErreurConfiguration(f"état {chemin} d'un autre format : choisir un autre --etat")
            self.donnees = lu

    @staticmethod
    def cle(dossier: str, nom: str) -> str:
        return f"{dossier}/{nom}"

    def deja_recupere(self, dossier: str, nom: str) -> bool:
        return self.cle(dossier, nom) in self.donnees["recupere"]

    def echec(self, dossier: str, nom: str) -> dict | None:
        return self.donnees["echecs"].get(self.cle(dossier, nom))

    def noter_recupere(self, dossier: str, nom: str) -> None:
        c = self.cle(dossier, nom)
        self.donnees["recupere"][c] = horodatage()
        self.donnees["echecs"].pop(c, None)

    def noter_echec(self, dossier: str, nom: str, cause: str, detail: str = "") -> None:
        self.donnees["echecs"][self.cle(dossier, nom)] = {"cause": cause, "detail": detail[:500], "le": horodatage()}

    def enregistrer(self) -> None:
        self.chemin.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=self.chemin.parent, prefix=".etat-", suffix=".json")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(self.donnees, f, ensure_ascii=False, indent=1, sort_keys=True)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, self.chemin)


def horodatage() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# --------------------------------------------------------------------------
# Plan : ce qu'il faut chercher, par fournisseur
# --------------------------------------------------------------------------

@dataclass
class Article:
    dossier: str
    artnr: str
    noms: list[str] = field(default_factory=list)


@dataclass
class PlanFournisseur:
    pm_id: str
    nom: str
    dossier_registre: str
    pieces_sans_image_servie: set = field(default_factory=set)
    pieces_sans_image_affichable: set = field(default_factory=set)
    images_manquantes: int = 0
    deja_recuperees: int = 0
    echecs_definitifs: int = 0
    signalees: dict = field(default_factory=lambda: defaultdict(list))
    articles: dict = field(default_factory=dict)

    @property
    def images_a_chercher(self) -> int:
        return sum(len(a.noms) for a in self.articles.values())

    def resume(self) -> dict:
        return {
            "pm_id": self.pm_id,
            "marque": self.nom,
            "dossier_registre": self.dossier_registre,
            "pieces_vendables_sans_image_servie": len(self.pieces_sans_image_servie),
            "dont_sans_image_affichable": len(self.pieces_sans_image_affichable),
            "images_manquantes": self.images_manquantes,
            "deja_recuperees": self.deja_recuperees,
            "echecs_definitifs_ignores": self.echecs_definitifs,
            "nom_invalide_storage": len(self.signalees["nom_invalide_storage"]),
            "dossier_vide": len(self.signalees["dossier_vide"]),
            "images_a_chercher": self.images_a_chercher,
            "articles_a_chercher": len(self.articles),
        }


def artnr_de(ligne: LigneInventaire) -> str:
    ref = ligne.piece_ref.strip()
    if ref:
        return ref
    nom = ligne.pmi_name
    return nom.rsplit("_", 1)[0] if "_" in nom else nom.rsplit(".", 1)[0]


def planifier(
    lignes: Iterable[LigneInventaire],
    registre: dict[str, dict],
    etat: Etat,
    reessayer_tout: bool = False,
) -> dict[str, PlanFournisseur]:
    plans: dict[str, PlanFournisseur] = {}
    for ln in lignes:
        info = registre.get(ln.pm_id, {})
        p = plans.get(ln.pm_id)
        if p is None:
            p = plans[ln.pm_id] = PlanFournisseur(ln.pm_id, info.get("nom", "(hors registre)"), info.get("dossier", ""))
        if ln.images_presentes == 0:
            p.pieces_sans_image_servie.add(ln.piece_id)
        if ln.classe == "sans_image_affichable":
            p.pieces_sans_image_affichable.add(ln.piece_id)
            continue
        if ln.classe != "image_absente":
            raise ErreurConfiguration(f"classe d'inventaire inconnue : {ln.classe!r}")
        p.images_manquantes += 1
        if not ln.pmi_folder.strip():
            p.signalees["dossier_vide"].append(ln.pmi_name)
            continue
        if not CLE_STORAGE_VALIDE.match(f"{ln.pmi_folder}/{ln.pmi_name}"):
            p.signalees["nom_invalide_storage"].append(f"{ln.pmi_folder}/{ln.pmi_name}")
            continue
        if etat.deja_recupere(ln.pmi_folder, ln.pmi_name):
            p.deja_recuperees += 1
            continue
        e = etat.echec(ln.pmi_folder, ln.pmi_name)
        if e and e["cause"] in DEFINITIVES and not reessayer_tout:
            p.echecs_definitifs += 1
            continue
        art = p.articles.setdefault((ln.pmi_folder, artnr_de(ln)), Article(ln.pmi_folder, artnr_de(ln)))
        if ln.pmi_name not in art.noms:
            art.noms.append(ln.pmi_name)
    return plans


def ecrire_rapport(plans: dict[str, PlanFournisseur], dossier: Path, mode: str) -> None:
    dossier.mkdir(parents=True, exist_ok=True)
    resumes = sorted((p.resume() for p in plans.values()),
                     key=lambda r: (-(r["images_manquantes"] + r["pieces_vendables_sans_image_servie"]), r["pm_id"]))
    total = {k: sum(r[k] for r in resumes) for k in resumes[0] if isinstance(resumes[0][k], int)} if resumes else {}
    (dossier / "rapport.json").write_text(json.dumps(
        {"genere_le": horodatage(), "mode": mode, "requete": str(FICHIER_SQL.relative_to(RACINE)),
         "total": total, "fournisseurs": resumes,
         "signalees": {p.pm_id: dict(p.signalees) for p in plans.values() if p.signalees}},
        ensure_ascii=False, indent=1), encoding="utf-8")
    with open(dossier / "rapport.csv", "w", newline="", encoding="utf-8") as f:
        if resumes:
            w = csv.DictWriter(f, fieldnames=list(resumes[0]))
            w.writeheader()
            w.writerows(resumes)


# --------------------------------------------------------------------------
# Portail, CDN, stockage — interfaces (les tests les remplacent)
# --------------------------------------------------------------------------

@dataclass
class ResultatRecherche:
    images: list[dict]            # [{"fileName", "url"}] du fournisseur demandé
    noms_vus: list[str]           # tous les fileName du fournisseur, pour diagnostic
    reponses: int                 # réponses TecdocToCat reçues
    reponses_illisibles: int = 0


class Portail(Protocol):
    async def connecter(self) -> bool: ...
    async def session_valide(self) -> bool: ...
    async def chercher(self, artnr: str, dlnr: str) -> ResultatRecherche: ...
    async def fermer(self) -> None: ...


class Stockage(Protocol):
    def envoyer(self, chemin: str, donnees: bytes, type_contenu: str) -> tuple[str, str]: ...


class Cdn(Protocol):
    def telecharger(self, url: str) -> tuple[bytes, str] | None: ...


def extraire_images(corps: dict, dlnr: str) -> tuple[list[dict], list[str]]:
    images, noms = [], []
    for art in corps.get("articles", []) or []:
        if str(art.get("dataSupplierId", "")) != str(dlnr):
            continue
        for img in art.get("images", []) or []:
            fn = img.get("fileName", "")
            url = img.get("imageURL1600") or img.get("imageURL800") or img.get("imageURL400") or img.get("imageURL200", "")
            if fn:
                noms.append(fn)
            if fn and url:
                images.append({"fileName": fn, "url": url})
    return images, noms


class PortailPlaywright:
    """Catalogue web TecDoc via Playwright (même parcours qu'en avril 2026)."""

    def __init__(self, email: str, mot_de_passe: str):
        self._email, self._mdp = email, mot_de_passe
        self._pw = self._navigateur = self.page = None

    async def ouvrir(self) -> None:
        try:
            from playwright.async_api import async_playwright  # noqa: PLC0415
        except ImportError as e:
            raise ErreurConfiguration("playwright absent : pip install -r scripts/requirements-recover-tecdoc-images.txt") from e
        self._pw = await async_playwright().start()
        self._navigateur = await self._pw.chromium.launch(headless=True)
        contexte = await self._navigateur.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/135.0.0.0 Safari/537.36")
        self.page = await contexte.new_page()

    async def connecter(self) -> bool:
        if self.page is None:
            await self.ouvrir()
        page = self.page
        await page.goto(PORTAIL_ACCUEIL, wait_until="networkidle", timeout=45000)
        if "login" in page.url:
            await page.wait_for_selector('input[name="identifier"]', timeout=10000)
            await page.fill('input[name="identifier"]', self._email)
            await page.wait_for_timeout(500)
            await page.click('input[type="submit"]')
            await page.wait_for_timeout(3000)
            await page.wait_for_selector('input[name="credentials.passcode"]', timeout=10000)
            await page.fill('input[name="credentials.passcode"]', self._mdp)
            await page.wait_for_timeout(500)
            await page.click('input[type="submit"]')
            await page.wait_for_timeout(10000)
        return await self.session_valide()

    async def session_valide(self) -> bool:
        page = self.page
        if page is None or "login" in page.url:
            return False
        try:
            return await page.locator(CHAMP_RECHERCHE).count() > 0
        except Exception:
            return False

    async def chercher(self, artnr: str, dlnr: str) -> ResultatRecherche:
        page = self.page
        res = ResultatRecherche([], [], 0)

        async def sur_reponse(reponse):
            if "pegasus" not in reponse.url or "TecdocToCat" not in reponse.url:
                return
            res.reponses += 1
            try:
                corps = await reponse.json()
            except Exception:
                res.reponses_illisibles += 1
                return
            if isinstance(corps, dict):
                images, noms = extraire_images(corps, dlnr)
                res.images.extend(images)
                res.noms_vus.extend(noms)

        page.on("response", sur_reponse)
        try:
            champ = page.locator(CHAMP_RECHERCHE)
            await champ.clear(timeout=30000)
            await champ.fill(artnr.strip())
            await page.wait_for_timeout(300)
            await champ.press("Enter")
            await page.wait_for_timeout(6000)
        except Exception as e:
            raise ErreurRecherche(f"{type(e).__name__}: {str(e).splitlines()[0][:200]}") from None
        finally:
            page.remove_listener("response", sur_reponse)
        if res.reponses == 0:
            raise ErreurRecherche("aucune réponse TecdocToCat")
        return res

    async def fermer(self) -> None:
        if self._navigateur:
            await self._navigateur.close()
        if self._pw:
            await self._pw.stop()


TYPES_IMAGE = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif",
               ".bmp": "image/bmp", ".webp": "image/webp", ".tif": "image/tiff", ".tiff": "image/tiff"}


def type_contenu(nom: str, annonce: str = "") -> str:
    """Type MIME de l'objet : annoncé par le CDN s'il est une image, sinon déduit de l'extension."""
    annonce = (annonce or "").split(";")[0].strip().lower()
    if annonce.startswith("image/"):
        return annonce
    ext = os.path.splitext(nom)[1].lower()
    return TYPES_IMAGE.get(ext) or mimetypes.guess_type(nom)[0] or "application/octet-stream"


class CdnRequests:
    def __init__(self):
        import requests  # noqa: PLC0415
        self._s = requests.Session()

    def telecharger(self, url: str) -> tuple[bytes, str] | None:
        url_800 = re.sub(r"/images/(100|200|400)/", "/images/800/", url)
        for u in dict.fromkeys([url_800, url]):
            r = self._s.get(u, timeout=30)
            if r.status_code == 200 and r.headers.get("content-type", "").startswith("image/") and r.content:
                return r.content, r.headers.get("content-type", "")
        return None


class StockageSupabase:
    """API Storage de Supabase (même appel que supabase-py `upload`, sans écrasement)."""

    def __init__(self, url: str, cle: str):
        import requests  # noqa: PLC0415
        self._base = url.rstrip("/") + f"/storage/v1/object/{BUCKET}/"
        self._s = requests.Session()
        self._s.headers.update({"apikey": cle, "Authorization": f"Bearer {cle}"})

    def envoyer(self, chemin: str, donnees: bytes, type_contenu_: str) -> tuple[str, str]:
        r = self._s.post(self._base + quote(chemin, safe="/"), data=donnees,
                         headers={"content-type": type_contenu_, "x-upsert": "false"}, timeout=60)
        if r.status_code in (200, 201):
            return "envoye", ""
        corps = r.text[:300]
        if r.status_code == 409 or "already exists" in corps.lower() or "duplicate" in corps.lower():
            return "deja_present", corps
        if "invalidkey" in corps.lower().replace(" ", ""):
            return "nom_invalide_storage", corps
        return "erreur_envoi", f"HTTP {r.status_code} {corps}"


# --------------------------------------------------------------------------
# Correspondance des noms
# --------------------------------------------------------------------------

def correspondance(nom: str, images: list[dict], accepter_casse: bool) -> tuple[dict | None, str, list[str]]:
    """(image retenue, type de correspondance, candidats signalés)."""
    exact = next((i for i in images if i["fileName"] == nom), None)
    if exact:
        return exact, "exacte", []
    casse = [i for i in images if i["fileName"].lower() == nom.lower()]
    if casse:
        if accepter_casse:
            return casse[0], "casse", []
        return None, "casse_non_acceptee", [i["fileName"] for i in casse]
    radical = os.path.splitext(nom)[0].lower()
    candidats = [i["fileName"] for i in images if os.path.splitext(i["fileName"])[0].lower() == radical]
    return None, "aucune", candidats


# --------------------------------------------------------------------------
# Exécution réelle
# --------------------------------------------------------------------------

@dataclass
class Bilan:
    recuperees: int = 0
    deja_presentes: int = 0
    causes: dict = field(default_factory=lambda: defaultdict(int))
    erreurs_techniques: int = 0
    arret: str = ""


async def recuperer(
    plan: PlanFournisseur,
    portail: Portail,
    cdn: Cdn,
    stockage: Stockage,
    etat: Etat,
    *,
    max_erreurs_consecutives: int = 5,
    accepter_casse: bool = False,
    pause=asyncio.sleep,
    delais: tuple[float, float, float] = (DELAI_RECHERCHE_MIN, DELAI_RECHERCHE_MAX, DELAI_TELECHARGEMENT),
) -> Bilan:
    bilan = Bilan()
    articles = list(plan.articles.values())
    if not articles:
        return bilan
    if not await portail.connecter():
        bilan.arret = "connexion"
        return bilan
    erreurs_suite = 0
    for i, art in enumerate(articles, 1):
        log.info("[%d/%d] dossier %s, article %s (%d image(s))", i, len(articles), art.dossier, art.artnr, len(art.noms))
        try:
            res = await portail.chercher(art.artnr, art.dossier)
        except ErreurRecherche as e:
            erreurs_suite += 1
            log.warning("  recherche en échec (%d à la suite) : %s", erreurs_suite, e)
            for nom in art.noms:
                etat.noter_echec(art.dossier, nom, "erreur_recherche", str(e))
                bilan.causes["erreur_recherche"] += 1
            etat.enregistrer()
            if not await portail.session_valide():
                log.warning("  session TecDoc invalide : reconnexion")
                if not await portail.connecter():
                    bilan.arret = "connexion"
                    return bilan
            if erreurs_suite >= max_erreurs_consecutives:
                bilan.arret = "disjoncteur"
                log.error("  %d recherches en échec à la suite : arrêt (état enregistré)", erreurs_suite)
                return bilan
            continue
        erreurs_suite = 0
        if res.reponses_illisibles:
            log.warning("  %d réponse(s) TecdocToCat illisible(s)", res.reponses_illisibles)
        for nom in art.noms:
            image, sorte, candidats = correspondance(nom, res.images, accepter_casse)
            if image is None:
                cause = "article_sans_image" if not res.images else "nom_sans_correspondance"
                detail = json.dumps({"sorte": sorte, "candidats": candidats[:10], "noms_vus": res.noms_vus[:10]},
                                    ensure_ascii=False)
                etat.noter_echec(art.dossier, nom, cause, detail)
                bilan.causes[cause] += 1
                continue
            try:
                telecharge = cdn.telecharger(image["url"])
            except Exception as e:
                telecharge = None
                log.warning("  téléchargement en échec %s/%s : %s", art.dossier, nom, type(e).__name__)
            if not telecharge:
                etat.noter_echec(art.dossier, nom, "erreur_telechargement", image["url"])
                bilan.causes["erreur_telechargement"] += 1
                bilan.erreurs_techniques += 1
                continue
            donnees, annonce = telecharge
            chemin = f"{art.dossier}/{nom}"
            try:
                statut, detail = stockage.envoyer(chemin, donnees, type_contenu(nom, annonce))
            except Exception as e:
                statut, detail = "erreur_envoi", type(e).__name__
            if statut == "envoye":
                etat.noter_recupere(art.dossier, nom)
                bilan.recuperees += 1
                log.info("  envoyé %s (%d octets, %s)", chemin, len(donnees), sorte)
            elif statut == "deja_present":
                etat.noter_echec(art.dossier, nom, "deja_present", detail)
                bilan.deja_presentes += 1
            else:
                etat.noter_echec(art.dossier, nom, statut, detail)
                bilan.causes[statut] += 1
                if statut == "erreur_envoi":
                    bilan.erreurs_techniques += 1
            await pause(delais[2])
        etat.enregistrer()
        await pause(random.uniform(delais[0], delais[1]))
    return bilan


# --------------------------------------------------------------------------
# Entrée
# --------------------------------------------------------------------------

def env_obligatoire(*noms: str) -> list[str]:
    manquants = [n for n in noms if not os.environ.get(n)]
    if manquants:
        raise ErreurConfiguration("variable(s) d'environnement absente(s) : " + ", ".join(manquants))
    return [os.environ[n] for n in noms]


def analyser_arguments(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Réimport des images manquantes des pièces vendables depuis TecDoc")
    p.add_argument("--marque", action="append", default=[], help="pm_id (répétable) ; obligatoire avec --commit")
    p.add_argument("--dossier", action="append", default=[], help="dossier pmi_folder = DLNR TecDoc (répétable)")
    p.add_argument("--commit", action="store_true", help="exécution réelle (sinon rapport à blanc)")
    p.add_argument("--rapport", type=Path, help="dossier du rapport à blanc (rapport.json, rapport.csv)")
    p.add_argument("--inventaire-csv", type=Path, help="lire l'inventaire depuis un CSV (hors ligne, sans base)")
    p.add_argument("--etat", type=Path, default=ETAT_PAR_DEFAUT, help="fichier d'état de reprise")
    p.add_argument("--reessayer-tout", action="store_true", help="reprendre aussi les échecs définitifs")
    p.add_argument("--accepter-casse", action="store_true",
                   help="envoyer une image dont le nom TecDoc ne diffère que par la casse (objet nommé pmi_name)")
    p.add_argument("--max-erreurs-consecutives", type=int, default=5)
    p.add_argument("--limite-articles", type=int, default=0, help="arrêter après N articles (essai)")
    a = p.parse_args(argv)
    if a.commit and not (a.marque or a.dossier):
        p.error("--commit exige --marque ou --dossier : un fournisseur à la fois")
    if a.commit and a.inventaire_csv:
        p.error("--commit lit l'inventaire en base, pas un CSV")
    return a


def filtrer(lignes: list[LigneInventaire], marques: list[str], dossiers: list[str],
            registre: dict[str, dict]) -> list[LigneInventaire]:
    """--marque garde les pièces de ces pm_id ; --dossier garde les images de ces dossiers et les
    pièces sans image affichable des marques dont c'est le dossier principal au registre."""
    if marques:
        lignes = [ln for ln in lignes if ln.pm_id in set(marques)]
    if dossiers:
        d = set(dossiers)
        lignes = [ln for ln in lignes
                  if ln.pmi_folder in d
                  or (ln.classe == "sans_image_affichable" and registre.get(ln.pm_id, {}).get("dossier") in d)]
    return lignes


def configurer_journal() -> None:
    DOSSIER_JOURNAUX.mkdir(exist_ok=True)
    fichier = DOSSIER_JOURNAUX / f"recover-tecdoc-images-{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}.log"
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s",
                        handlers=[logging.FileHandler(fichier, encoding="utf-8"), logging.StreamHandler()])


def verrouiller(chemin: Path):
    import fcntl  # noqa: PLC0415
    chemin.parent.mkdir(parents=True, exist_ok=True)
    f = open(chemin.with_suffix(".lock"), "w")
    try:
        fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        f.close()
        return None
    return f


async def principal(a: argparse.Namespace, *, portail=None, cdn=None, stockage=None) -> int:
    try:
        etat = Etat(a.etat)
        registre = charger_registre()
        if a.inventaire_csv:
            lignes = lire_inventaire_csv(a.inventaire_csv)
        else:
            (dsn,) = env_obligatoire("DATABASE_URL")
            lignes = lire_inventaire_base(dsn)
        lignes = filtrer(lignes, a.marque, a.dossier, registre)
        plans = planifier(lignes, registre, etat, a.reessayer_tout)
    except ErreurConfiguration as e:
        log.error("%s", e)
        return SORTIE_CONFIG

    mode = "commit" if a.commit else "a_blanc"
    for p in sorted(plans.values(), key=lambda p: -p.images_a_chercher):
        log.info("fournisseur %s %s : %s", p.pm_id, p.nom, json.dumps(p.resume(), ensure_ascii=False))
    if a.rapport:
        ecrire_rapport(plans, a.rapport, mode)
        log.info("rapport écrit dans %s", a.rapport)
    if not a.commit:
        return SORTIE_OK

    if a.limite_articles:
        for p in plans.values():
            p.articles = dict(list(p.articles.items())[: a.limite_articles])
    try:
        if portail is None:
            email, mdp = env_obligatoire("TECDOC_EMAIL", "TECDOC_PASS")
            portail = PortailPlaywright(email, mdp)
        if stockage is None:
            url, cle = env_obligatoire("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
            stockage = StockageSupabase(url, cle)
        if cdn is None:
            cdn = CdnRequests()
    except (ErreurConfiguration, ImportError) as e:
        log.error("%s", e)
        return SORTIE_CONFIG

    code = SORTIE_OK
    try:
        for p in plans.values():
            log.info("=== %s %s : %d image(s), %d article(s) ===", p.pm_id, p.nom, p.images_a_chercher, len(p.articles))
            bilan = await recuperer(p, portail, cdn, stockage, etat,
                                    max_erreurs_consecutives=a.max_erreurs_consecutives,
                                    accepter_casse=a.accepter_casse)
            etat.enregistrer()
            log.info("bilan %s : récupérées=%d déjà présentes=%d causes=%s", p.pm_id, bilan.recuperees,
                     bilan.deja_presentes, dict(bilan.causes))
            if bilan.arret == "connexion":
                log.error("connexion TecDoc refusée")
                return SORTIE_CONNEXION
            if bilan.arret == "disjoncteur":
                return SORTIE_DISJONCTEUR
            if bilan.erreurs_techniques:
                code = SORTIE_ERREURS
    except ErreurConfiguration as e:
        log.error("%s", e)
        return SORTIE_CONFIG
    finally:
        await portail.fermer()
    return code


def main(argv: list[str] | None = None) -> int:
    a = analyser_arguments(argv)
    configurer_journal()
    verrou = verrouiller(a.etat)
    if verrou is None:
        log.error("une autre exécution tient le verrou de %s", a.etat)
        return SORTIE_VERROU
    try:
        return asyncio.run(principal(a))
    finally:
        verrou.close()


if __name__ == "__main__":
    sys.exit(main())
