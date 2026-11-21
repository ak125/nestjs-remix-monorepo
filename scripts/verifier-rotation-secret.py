#!/usr/bin/env python3
"""Verifie mecaniquement qu'une rotation du mot de passe PostgreSQL a bien eu lieu.

Une rotation n'est pas prouvee parce qu'on l'a faite : elle est prouvee quand
l'ANCIEN secret est refuse ET que le NOUVEAU fonctionne. Ce script etablit les deux,
sans jamais afficher, journaliser ni ecrire la moindre valeur.

Ce qu'il fait
  1. lit le secret ACTIF depuis backend/.env
  2. lit le secret PUBLIE depuis l'historique git (blob du commit fautif)
  3. compare leurs empreintes SHA-256 tronquees      -> rotation faite ou non
  4. ouvre une connexion avec le secret ACTIF        -> doit REUSSIR
  5. ouvre une connexion avec le secret PUBLIE       -> doit ECHOUER en 28P01
  6. inventorie les copies locales portant l'ancien secret, sans les supprimer

Aucune valeur ne transite par argv, par l'environnement d'un sous-processus, ni par
la sortie. Les empreintes affichees sont tronquees a 12 hexa : elles identifient sans
permettre de reconstituer.

Codes de sortie
  0  ROTATED         ancien refuse, nouveau valide
  1  ROTATION_FAIL   l'ancien secret est ENCORE accepte — le pire cas
  2  BLOCKED_BY_SECRET_ROTATION   actif == publie, rien n'a change
  3  INDETERMINE     une verification n'a pas pu etre menee (dit, jamais suppose)

Mode inventaire (--constats)
  Meme principe, etendu a tous les secrets d'un inventaire de balayage (TSV gitleaks
  enrichi : depot, mode, regle, fichier, ligne, commit, date, cle, ...). Pour chaque
  valeur exposee distincte : empreinte comparee a TOUTES les valeurs de --env, puis un
  essai minimal en lecture seule avec l'ancienne valeur, selon la famille :
    supabase     GET /auth/v1/settings (apikey) et GET /rest/v1/ (apikey + Bearer),
                 temoin = cle active du meme projet               -> doit etre 401/403
    resend       GET /domains                                    -> doit etre refuse ;
                 « restricted_api_key » = cle VALIDE restreinte a l'envoi
    meilisearch  GET /version sur l'hote du blob, s'il est autorise (--hote-essai)
    grafana      GET /api/user (Basic) sur l'hote du blob, s'il est autorise
    paiement, session, postgres : hors ligne, comparaison d'empreintes seule
  Verdicts : REFUSE, ENCORE_ACCEPTE, IDENTIQUE (actif == expose), INDETERMINE (raison).
  Code de sortie : 1 si un ENCORE_ACCEPTE, sinon 2 si un IDENTIQUE, sinon 3 si un
  INDETERMINE, sinon 0. L'inventaire est fourni a l'execution, jamais range ici.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import ipaddress
import json
import os
import re
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
CLE = "SUPABASE_DB_PASSWORD"

#: La reference du blob ou le litteral a ete publie est fournie a l'EXECUTION, jamais
#: ecrite ici. Ce depot est public : y inscrire « le mot de passe est dans tel commit,
#: tel fichier » en ferait un panneau indicateur. L'operateur la connait, le depot non.


def empreinte(valeur: str) -> str:
    return hashlib.sha256(valeur.strip().encode()).hexdigest()[:12]


def secret_actif(env: Path) -> str:
    if not env.is_file():
        raise RuntimeError(
            f"{env} introuvable. Le fichier .env n'est pas suivi par Git : depuis un "
            "worktree, passer --env /opt/automecanik/app/backend/.env")
    for ligne in env.read_text(encoding="utf-8", errors="replace").splitlines():
        if ligne.startswith(f"{CLE}="):
            return ligne.split("=", 1)[1].strip()
    raise RuntimeError(f"{CLE} absent de {env}")


def secret_publie(commit: str, chemin: str) -> str:
    import re
    blob = subprocess.run(["git", "show", f"{commit}:{chemin}"],
                          cwd=RACINE, capture_output=True, text=True)
    if blob.returncode != 0:
        raise RuntimeError(f"blob {commit}:{chemin} illisible — "
                           "historique tronque ou depot incomplet")
    trouves = re.findall(r"['\"]password['\"]\s*:\s*['\"]([^'\"]+)['\"]", blob.stdout)
    if not trouves:
        raise RuntimeError("aucun litteral de mot de passe dans le blob de reference")
    return trouves[0]


def tenter_connexion(secret: str, *, hote: str, port: int, utilisateur: str,
                     base: str) -> tuple[bool, str]:
    """Ouvre une connexion et la referme. Rend (succes, classe d'erreur).

    Le secret est passe par le parametre `password` de psycopg2 : il ne figure ni
    dans argv, ni dans l'environnement, ni dans un fichier temporaire.
    """
    import psycopg2
    try:
        conn = psycopg2.connect(host=hote, port=port, user=utilisateur,
                                password=secret, dbname=base, connect_timeout=15)
        conn.close()
        return True, "OK"
    except psycopg2.OperationalError as e:
        code = getattr(e, "pgcode", None) or ""
        texte = str(e).lower()
        if code == "28P01" or "authentication failed" in texte or "mot de passe" in texte:
            return False, "28P01"
        return False, f"AUTRE:{type(e).__name__}"
    except Exception as e:  # noqa: BLE001 — on nomme, on ne suppose pas
        return False, f"AUTRE:{type(e).__name__}"


def copies_locales(cible: str, racine: Path) -> list[Path]:
    """Fichiers hors Git portant l'empreinte donnee. Inventaire seul, aucune suppression."""
    import re as _re
    trouves: set[Path] = set()
    for motif in ("backend/.env*", ".env*", "backend/*.bak", "backend/*.backup"):
        for f in racine.glob(motif):
            if not f.is_file():
                continue
            try:
                contenu = f.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            for ligne in contenu.splitlines():
                nom, sep, val = ligne.partition("=")
                if not sep or nom.strip() not in (CLE, "DATABASE_URL"):
                    continue
                val = val.strip().strip("\"'")
                if nom.strip() == "DATABASE_URL":
                    m = _re.search(r"://[^:]+:([^@]+)@", val)
                    val = m.group(1) if m else ""
                if val and empreinte(val) == cible:
                    trouves.add(f)
                    break
    return sorted(trouves)


# ---------------------------------------------------------------------------
# Mode inventaire : tous les secrets d'un balayage, un verdict mecanique chacun
# ---------------------------------------------------------------------------

#: Familles par nom de cle tel que le balayage l'a capture (certains noms sont
#: tronques par la regle de capture, d'ou YBOX_/MPAY_/VICE_).
FAMILLES: dict[str, tuple[str, ...]] = {
    "supabase": ("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY", "SUPABASE_KEY",
                 "SERVICE_ROLE_KEY", "VICE_ROLE_KEY"),
    "resend": ("RESEND_API_KEY",),
    "meilisearch": ("MEILISEARCH_API_KEY", "MEILISEARCH_KEY", "MEILI_MASTER_KEY",
                    "MEILISEARCH_MASTER_KEY"),
    "grafana": ("GRAFANA_ADMIN_PASSWORD", "GF_SECURITY_ADMIN_PASSWORD"),
    "paiement": ("PAYBOX_HMAC_KEY", "YBOX_HMAC_KEY", "HMAC_KEY",
                 "SYSTEMPAY_CERTIFICATE_PROD", "SYSTEMPAY_CERTIFICATE_TEST",
                 "SYSTEMPAY_HMAC_KEY_PROD", "SYSTEMPAY_HMAC_KEY_TEST",
                 "MPAY_HMAC_KEY_TEST", "CYBERPLUS_CERTIFICAT",
                 "CertificatProd", "CertificatTest"),
    "session": ("SESSION_SECRET",),
}
FAMILLE_PAR_CLE = {cle: fam for fam, cles in FAMILLES.items() for cle in cles}
#: Familles verifiees hors ligne seulement : aucun appel au service (paiement :
#: interdit ; session : pas de service a interroger).
HORS_LIGNE = ("paiement", "session", "jwt-autre")

RE_JWT = re.compile(r"eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}")
RE_BEARER = re.compile(r"Bearer\s+([A-Za-z0-9_\-.=]{8,})")
RE_HOTE = {
    "meilisearch": re.compile(
        r"MEILI(?:SEARCH)?_(?:HOST|URL)[\"']?\s*[:=]\s*[\"']?(https?://[^\s\"'`]+)", re.I),
    "grafana": re.compile(
        r"(?:GRAFANA_URL|GF_SERVER_ROOT_URL)[\"']?\s*[:=]\s*[\"']?(https?://[^\s\"'`]+)",
        re.I),
}
HOTE_DEFAUT = {"meilisearch": "http://localhost:7700", "grafana": "http://localhost:3000"}
GABARIT = ("xxx", "your", "change", "example", "exemple", "placeholder", "votre",
           "***", "...", "<", ">", "dummy", "test_key", "secret_here")


def valeurs_de_ligne(ligne: str, cle: str, regle: str) -> list[str]:
    """Litteraux portes par la ligne signalee. Rend [] si la ligne n'en porte pas."""
    if regle == "jwt":
        return RE_JWT.findall(ligne)
    if cle:
        m = re.search(re.escape(cle) + r"[\"']?\s*[:=]\s*[\"'`]?([^\"'`\s,;}]+)", ligne)
        if m:
            return [m.group(1)]
    if regle == "curl-auth-header":
        return RE_BEARER.findall(ligne)
    return []


def est_renvoi(valeur: str) -> bool:
    """Une reference a une variable n'est pas une valeur exposee."""
    return valeur.startswith(("$", "process.env", "os.environ", "{{", "%"))


def est_gabarit(valeur: str) -> bool:
    v = valeur.lower()
    return len(v) < 8 or any(g in v for g in GABARIT)


def valeurs_env(env: Path) -> dict[str, str]:
    vals: dict[str, str] = {}
    for ligne in env.read_text(encoding="utf-8", errors="replace").splitlines():
        s = ligne.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        if s.startswith("export "):
            s = s[7:]
        nom, _, val = s.partition("=")
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        if val:
            vals[nom.strip()] = val
    return vals


def charge_jwt(jeton: str) -> dict:
    """Charge utile d'un JWT (metadonnees publiques : ref, role, iss, iat, exp)."""
    try:
        p = jeton.split(".")[1]
        p += "=" * (-len(p) % 4)
        d = json.loads(base64.urlsafe_b64decode(p))
        return d if isinstance(d, dict) else {}
    except Exception:  # noqa: BLE001
        return {}


class _SansRedirection(urllib.request.HTTPRedirectHandler):
    """Une redirection emporterait l'en-tete d'authentification ailleurs : refusee."""

    def redirect_request(self, *a, **k):  # noqa: D401
        return None


_OUVREUR = urllib.request.build_opener(_SansRedirection)


def motif(corps: bytes, secret: str) -> str:
    try:
        d = json.loads(corps)
    except Exception:  # noqa: BLE001
        return ""
    if not isinstance(d, dict):
        return ""
    morceaux = [d[c] for c in ("name", "code", "error", "message", "msg")
                if isinstance(d.get(c), (str, int)) and str(d.get(c))]
    texte = "|".join(str(m) for m in morceaux[:2]).replace(secret, "<masque>")
    return texte[:70]


def requete(url: str, entetes: dict[str, str], secret: str) -> tuple[int | None, str]:
    """GET en lecture seule. Le secret ne voyage que dans un en-tete, jamais dans l'URL."""
    req = urllib.request.Request(url, method="GET",
                                 headers={"User-Agent": "rotation-check/1.0", **entetes})
    try:
        with _OUVREUR.open(req, timeout=15) as r:
            return r.status, motif(r.read(2048), secret)
    except urllib.error.HTTPError as e:
        return e.code, motif(e.read(2048), secret)
    except urllib.error.URLError as e:
        if isinstance(e.reason, socket.gaierror):
            return None, "DNS:nom inexistant"
        return None, f"AUTRE:{type(e.reason).__name__}"
    except Exception as e:  # noqa: BLE001
        return None, f"AUTRE:{type(e).__name__}"


def hote_autorise(url: str, autorises: list[str]) -> bool:
    hote = urllib.parse.urlsplit(url).hostname or ""
    if hote in autorises:
        return True
    try:
        adresses = {i[4][0] for i in socket.getaddrinfo(hote, None)}
    except OSError:
        return False
    return bool(adresses) and all(ipaddress.ip_address(a).is_loopback for a in adresses)


def _code(r: tuple[int | None, str]) -> str:
    return f"{r[0]}" + (f"[{r[1]}]" if r[1] else "")


#: Table lue avec limit=0 : aucune ligne ne revient, seul compte le verdict sur le JWT.
TABLE_ESSAI = "pieces_gamme?select=pg_id&limit=0"
DESACTIVEE = "Legacy API keys are disabled"


def essai_supabase(cle: str, ref: str, temoin: tuple[int | None, str] | None,
                   reseau_sain: bool, est_jwt: bool) -> tuple[str, str]:
    """Deux essais en lecture : la cle comme apikey, puis (JWT) comme Bearer.

    Le second essai passe la porte avec la cle active temoin : il dit si le JWT
    expose est encore VERIFIE par PostgREST, independamment de la porte apikey.
    """
    base = f"https://{ref}.supabase.co"
    r1 = requete(base + "/auth/v1/settings", {"apikey": cle}, cle)
    preuve = f"apikey:settings={_code(r1)}"
    r2: tuple[int | None, str] | None = None
    if est_jwt and temoin is not None:
        r2 = requete(base + "/rest/v1/" + TABLE_ESSAI,
                     {"apikey": temoin[1], "Authorization": f"Bearer {cle}"}, cle)
        preuve += f" bearer:rest={_code(r2)}"
    reponses = [r for r in (r1, r2) if r is not None]
    if any(r[0] is not None and 200 <= r[0] < 300 for r in reponses):
        if cle.startswith("sb_publishable_"):
            return "ENCORE_ACCEPTE", preuve + " ; cle publishable : publique par conception"
        return "ENCORE_ACCEPTE", preuve
    if any(DESACTIVEE in r[1] for r in reponses):
        return "REFUSE", (preuve + " ; RESERVE : refus par l'interrupteur reversible des "
                          "cles legacy ; rotation du secret JWT non prouvee")
    if r1 == (None, "DNS:nom inexistant") and reseau_sain:
        return "REFUSE", preuve + " ; projet inexistant, reseau sain (temoin)"
    if not reseau_sain:
        return "INDETERMINE", preuve + " ; pas de temoin actif accepte : refus non concluant"
    if r1[0] in (401, 403) and (r2 is None or r2[0] in (401, 403)):
        return "REFUSE", preuve
    return "INDETERMINE", preuve + " ; ni accepte ni refus d'authentification"


def essai_resend(cle: str) -> tuple[str, str]:
    r = requete("https://api.resend.com/domains", {"Authorization": f"Bearer {cle}"}, cle)
    preuve = f"domains={_code(r)}"
    if r[0] is not None and 200 <= r[0] < 300:
        return "ENCORE_ACCEPTE", preuve
    if "restricted_api_key" in r[1]:
        return "ENCORE_ACCEPTE", preuve + " ; cle valide, restreinte a l'envoi"
    if r[0] in (400, 401, 403) and ("invalid" in r[1].lower() or "missing" in r[1].lower()):
        return "REFUSE", preuve
    return "INDETERMINE", preuve


#: Point de sante interrogeable SANS identifiant, et cle JSON qui signe le service.
SANTE = {"meilisearch": ("/health", "status"), "grafana": ("/api/health", "database")}


def service_identifie(famille: str, url: str) -> bool:
    """Le service attendu repond-il a cette adresse ? Aucun identifiant n'est envoye."""
    chemin, signe = SANTE[famille]
    req = urllib.request.Request(url.rstrip("/") + chemin, method="GET",
                                 headers={"User-Agent": "rotation-check/1.0"})
    try:
        with _OUVREUR.open(req, timeout=10) as r:
            d = json.loads(r.read(2048))
    except Exception:  # noqa: BLE001
        return False
    return isinstance(d, dict) and signe in d


def essai_http(famille: str, valeur: str, url: str, blob: str,
               autorises: list[str]) -> tuple[str, str]:
    hote = urllib.parse.urlsplit(url).hostname or "?"
    if not hote_autorise(url, autorises):
        return "INDETERMINE", f"hote {hote} non autorise a l'essai (--hote-essai)"
    if not service_identifie(famille, url):
        return "INDETERMINE", (f"aucun {famille} identifie sur {hote} : identifiant "
                               "non envoye")
    if famille == "meilisearch":
        r = requete(url.rstrip("/") + "/version", {"Authorization": f"Bearer {valeur}"},
                    valeur)
        preuve = f"{hote} version={_code(r)}"
    else:
        m = re.search(r"(?:GRAFANA_ADMIN_USER|GF_SECURITY_ADMIN_USER)\s*[:=]\s*[\"']?(\w+)",
                      blob)
        jeton = base64.b64encode(f"{m.group(1) if m else 'admin'}:{valeur}".encode()).decode()
        r = requete(url.rstrip("/") + "/api/user", {"Authorization": f"Basic {jeton}"},
                    valeur)
        preuve = f"{hote} api/user={_code(r)}"
    if r[0] is None:
        return "INDETERMINE", preuve + " ; service injoignable"
    if 200 <= r[0] < 300:
        return "ENCORE_ACCEPTE", preuve
    if r[0] in (401, 403):
        return "REFUSE", preuve
    return "INDETERMINE", preuve


def copies_portant(empreintes: set[str], racine: Path, sauf: Path) -> dict[str, list[str]]:
    """Fichiers hors Git (.env*) portant une empreinte exposee. Inventaire seul."""
    trouves: dict[str, list[str]] = {}
    for motif_glob in (".env*", "backend/.env*", "frontend/.env*"):
        for f in racine.glob(motif_glob):
            if not f.is_file() or f.resolve() == sauf.resolve():
                continue
            try:
                vals = valeurs_env(f)
            except OSError:
                continue
            for v in vals.values():
                e = empreinte(v)
                if e in empreintes:
                    trouves.setdefault(e, []).append(str(f.relative_to(racine)))
    return trouves


def collecter(constats: Path, depot: str) -> tuple[dict[str, dict], dict[str, int]]:
    """Valeurs exposees distinctes (par empreinte), blobs lus une fois chacun."""
    lignes = constats.read_text(encoding="utf-8").splitlines()
    blobs: dict[tuple[str, str], str | None] = {}
    groupes: dict[str, dict] = {}
    non_extraits: dict[str, int] = {}
    for ligne in lignes[1:]:
        c = ligne.split("\t")
        if len(c) < 8 or c[0] != depot:
            continue
        regle, fichier, num, commit, date, cle = c[2], c[3], c[4], c[5], c[6], c[7]
        fam = FAMILLE_PAR_CLE.get(cle)
        if fam is None and regle == "jwt":
            fam = "jwt-autre"
        if fam is None and regle == "curl-auth-header" and "meili" in fichier.lower():
            fam = "meilisearch"
        if fam is None:
            continue
        if (commit, fichier) not in blobs:
            r = subprocess.run(["git", "show", f"{commit}:{fichier}"], cwd=RACINE,
                               capture_output=True, text=True, errors="replace")
            blobs[(commit, fichier)] = r.stdout if r.returncode == 0 else None
        blob = blobs[(commit, fichier)]
        texte = blob.splitlines() if blob is not None else []
        n = int(num) if num.isdigit() else 0
        valeurs = valeurs_de_ligne(texte[n - 1], cle, regle) if 0 < n <= len(texte) else []
        valeurs = [v for v in valeurs if not est_renvoi(v)]
        if not valeurs:
            non_extraits[cle or regle] = non_extraits.get(cle or regle, 0) + 1
            continue
        for v in valeurs:
            e = empreinte(v)
            g = groupes.setdefault(e, {"valeur": v, "familles": set(), "cles": set(),
                                       "lieux": set(), "dates": set(), "blob": blob})
            g["familles"].add(fam)
            g["cles"].add(cle or regle)
            g["lieux"].add((date, commit[:12], f"{fichier}:{num}"))
            g["dates"].add(date)
    return groupes, non_extraits


def inventaire(args: argparse.Namespace) -> int:
    env = Path(args.env)
    try:
        actifs = valeurs_env(env)
    except OSError as e:
        print(f"INDETERMINE : {env} illisible ({type(e).__name__})", file=sys.stderr)
        return 3
    actifs_par_empreinte: dict[str, list[str]] = {}
    for nom, val in actifs.items():
        actifs_par_empreinte.setdefault(empreinte(val), []).append(nom)

    groupes, non_extraits = collecter(Path(args.constats), args.depot)

    # 2. Temoins Supabase : la cle active du projet actif doit etre acceptee.
    url_actif = actifs.get("SUPABASE_URL", "")
    ref_actif = (urllib.parse.urlsplit(url_actif).hostname or "").split(".")[0]
    temoin: tuple[int | None, str] | None = None
    temoins_vus: list[str] = []
    for nom in ("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY"):
        cle = actifs.get(nom)
        if not (ref_actif and cle) or args.sans_connexion:
            continue
        code = requete(f"https://{ref_actif}.supabase.co/auth/v1/settings",
                       {"apikey": cle}, cle)[0]
        temoins_vus.append(f"{nom}={code}")
        if temoin is None and code is not None and 200 <= code < 300:
            temoin = (code, cle)

    # 3. Verdict par valeur distincte.
    resultats = []
    for e, g in groupes.items():
        v, fams = g["valeur"], g["familles"]
        charge = charge_jwt(v) if RE_JWT.fullmatch(v) else {}
        if str(charge.get("iss", "")).startswith("supabase") and charge.get("ref"):
            fam = "supabase"
        else:
            fam = next((f for f in FAMILLES if f in fams), "jwt-autre")
        if charge:
            meta = (f"iss={charge.get('iss', '?')} ref={charge.get('ref', '-')} "
                    f"role={charge.get('role', '-')}")
        else:
            prefixe = next((p for p in ("sb_secret_", "sb_publishable_", "re_")
                            if v.startswith(p)), "")
            meta = f"forme={prefixe or 'autre'} longueur={len(v)}"
        if fam == "supabase" and not charge:
            charge = {"ref": ref_actif}  # cle non JWT : seul le projet actif peut l'accepter
        gabarit = est_gabarit(v)
        if e in actifs_par_empreinte:
            verdict, preuve = ("IDENTIQUE",
                               f"== actif {','.join(sorted(actifs_par_empreinte[e]))}")
        elif args.sans_connexion and fam not in HORS_LIGNE:
            verdict, preuve = "INDETERMINE", "!= actif DEV ; essai non mene (--sans-connexion)"
        elif fam == "supabase" and not re.fullmatch(r"[a-z0-9]{20}",
                                                    str(charge.get("ref", ""))):
            verdict, preuve = "INDETERMINE", "projet de reference inconnu, aucun essai"
        elif fam == "jwt-autre" and charge.get("iss") == "supabase-demo":
            verdict, preuve = ("INDETERMINE", "cle de demonstration publique de la CLI "
                               "Supabase locale : sans portee sur un projet heberge")
        elif fam == "supabase":
            verdict, preuve = essai_supabase(v, charge["ref"],
                                             temoin if charge["ref"] == ref_actif else None,
                                             temoin is not None, bool(RE_JWT.fullmatch(v)))
        elif fam == "resend":
            verdict, preuve = essai_resend(v)
            time.sleep(0.6)
        elif fam in ("meilisearch", "grafana"):
            m = RE_HOTE[fam].search(g["blob"] or "")
            url = m.group(1) if m else HOTE_DEFAUT[fam]
            verdict, preuve = essai_http(fam, v, url, g["blob"] or "", args.hote_essai)
        else:
            verdict, preuve = ("INDETERMINE",
                               "!= actif DEV ; refus non eprouvable hors ligne")
        resultats.append({"empreinte": e, "famille": fam, "cles": sorted(g["cles"]),
                          "lieux": sorted(g["lieux"]), "dates": sorted(g["dates"]),
                          "verdict": verdict, "preuve": preuve, "meta": meta,
                          "gabarit": gabarit})
        g["valeur"] = None  # ne pas garder la valeur au-dela du necessaire

    copies = copies_portant({r["empreinte"] for r in resultats}, env.parent.parent, env)

    # 4. Rapport : aucune valeur, empreintes tronquees, emplacements comptes seulement.
    ordre = {"ENCORE_ACCEPTE": 0, "IDENTIQUE": 1, "INDETERMINE": 2, "REFUSE": 3}
    resultats.sort(key=lambda r: (ordre[r["verdict"]], r["famille"], r["dates"][0]))
    print(f"=== Inventaire {args.depot} : {len(resultats)} valeurs exposees distinctes "
          f"(aucune valeur affichee) ===")
    print(f"actif compare : {env} ({len(actifs)} cles) ; temoins supabase "
          f"({ref_actif}) : {' '.join(temoins_vus) or 'aucun'}")
    print("verdict\tfamille\tcles\tempreinte\tblobs\tdates\tgabarit\tpreuve\tmeta\tcopies")
    for r in resultats:
        print("\t".join([r["verdict"], r["famille"], ",".join(r["cles"]), r["empreinte"],
                         str(len(r["lieux"])), f"{r['dates'][0]}..{r['dates'][-1]}",
                         "oui" if r["gabarit"] else "non", r["preuve"], r["meta"],
                         str(len(copies.get(r["empreinte"], [])))]))
    if non_extraits:
        print("constats sans litteral extrait (renvoi, multi-ligne ou blob absent) : "
              + ", ".join(f"{k}={n}" for k, n in sorted(non_extraits.items())))
    bilan = {k: sum(1 for r in resultats if r["verdict"] == k) for k in ordre}
    print("bilan : " + "  ".join(f"{k}={n}" for k, n in bilan.items()))

    if args.detail:
        fd = os.open(args.detail, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as out:
            out.write("# emplacements des valeurs exposees — SANS valeur, ne pas publier\n")
            for r in resultats:
                out.write(f"\n## {r['verdict']} {r['famille']} {r['empreinte']} "
                          f"({','.join(r['cles'])}) {r['preuve']}\n")
                for d, c, f in r["lieux"]:
                    out.write(f"- {d} {c} {f}\n")
                for f in copies.get(r["empreinte"], []):
                    out.write(f"- copie locale : {f}\n")

    if bilan["ENCORE_ACCEPTE"]:
        return 1
    if bilan["IDENTIQUE"]:
        return 2
    if bilan["INDETERMINE"]:
        return 3
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--hote", default="aws-0-eu-west-3.pooler.supabase.com")
    ap.add_argument("--port", type=int, default=6543)
    ap.add_argument("--utilisateur", default="postgres.cxpojprgwgubzjyqzmoq")
    ap.add_argument("--base", default="postgres")
    ap.add_argument("--commit",
                    help="commit ou le litteral a ete publie (reference forensique, "
                         "fournie par l'operateur — jamais figee dans le depot)")
    ap.add_argument("--chemin",
                    help="chemin du fichier dans ce commit")
    ap.add_argument("--env", default=str(RACINE / "backend" / ".env"),
                    help="fichier .env portant le secret actif (jamais suivi par Git)")
    ap.add_argument("--sans-connexion", action="store_true",
                    help="comparaison d'empreintes seule, aucune tentative de connexion")
    ap.add_argument("--constats",
                    help="mode inventaire : TSV des constats (hors depot, chmod 600)")
    ap.add_argument("--depot", default="nestjs-remix-monorepo",
                    help="mode inventaire : valeur de la 1re colonne du TSV a retenir")
    ap.add_argument("--hote-essai", action="append", default=[],
                    help="mode inventaire : hote autorise pour les essais meilisearch "
                         "et grafana (repetable ; loopback toujours autorise)")
    ap.add_argument("--detail",
                    help="mode inventaire : ecrit les emplacements (sans valeur) dans "
                         "ce fichier, chmod 600")
    args = ap.parse_args(argv)

    if args.constats:
        return inventaire(args)
    if not (args.commit and args.chemin):
        ap.error("--commit et --chemin sont requis hors mode --constats")

    try:
        env = Path(args.env)
        actif, publie = secret_actif(env), secret_publie(args.commit, args.chemin)
    except Exception as e:  # noqa: BLE001
        print(f"INDETERMINE : {e}", file=sys.stderr)
        return 3

    e_actif, e_publie = empreinte(actif), empreinte(publie)
    print("=== Empreintes SHA-256 tronquees (aucune valeur affichee) ===")
    print(f"  secret actif  ({CLE}) : {e_actif}")
    print(f"  secret publie ({args.commit})     : {e_publie}")

    if e_actif == e_publie:
        print()
        print("  Le secret actif EST celui publie publiquement.")
        print("  La verification negative est sans objet : il n'y a pas d'« ancien » secret.")
        print()
        print("BLOCKED_BY_SECRET_ROTATION")
        return 2

    print("  -> les empreintes different : une rotation a eu lieu.")

    if args.sans_connexion:
        print()
        print("INDETERMINE : rotation constatee par empreinte, connexions non testees "
              "(--sans-connexion). Une rotation non eprouvee n'est pas une rotation prouvee.")
        return 3

    print()
    print(f"=== Verification par connexion ({args.hote}:{args.port}) ===")
    ok_neuf, detail_neuf = tenter_connexion(actif, hote=args.hote, port=args.port,
                                            utilisateur=args.utilisateur, base=args.base)
    print(f"  nouveau secret : {'ACCEPTE' if ok_neuf else 'REFUSE'} ({detail_neuf})")
    ok_vieux, detail_vieux = tenter_connexion(publie, hote=args.hote, port=args.port,
                                              utilisateur=args.utilisateur, base=args.base)
    print(f"  ancien secret  : {'ACCEPTE' if ok_vieux else 'REFUSE'} ({detail_vieux})")

    print()
    if ok_vieux:
        print("  L'identifiant publie publiquement ouvre TOUJOURS la base.")
        print("ROTATION_FAIL")
        return 1
    if not ok_neuf:
        print("  Le secret actif n'ouvre pas la base : configuration incoherente, ou")
        print("  indisponibilite reseau. Ne pas conclure a une rotation reussie.")
        print("INDETERMINE")
        return 3
    if detail_vieux != "28P01":
        print(f"  L'ancien secret echoue, mais pas sur un refus d'authentification "
              f"({detail_vieux}). Un echec reseau ressemble a un refus — il ne le prouve pas.")
        print("INDETERMINE")
        return 3

    restes = copies_locales(e_publie, env.parent.parent)
    print("=== Copies locales portant l'ancien secret (inventaire, aucune suppression) ===")
    if restes:
        for f in restes:
            print(f"  · {f}")
        print("  Ces fichiers peuvent maintenant etre supprimes sans risque : la valeur")
        print("  qu'ils portent n'ouvre plus rien.")
    else:
        print("  aucune")

    print()
    print("ROTATED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
