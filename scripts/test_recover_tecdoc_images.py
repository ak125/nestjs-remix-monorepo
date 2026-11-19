"""Tests de scripts/recover-tecdoc-images.py — sans réseau ni base (faux portail, CDN, stockage).

    python3 -m pytest scripts/test_recover_tecdoc_images.py -q
"""
from __future__ import annotations

import asyncio
import importlib.util
import json
import logging
import re
import sys
from pathlib import Path

import pytest

ICI = Path(__file__).resolve().parent
FIXTURE = ICI / "fixtures/recover-tecdoc-images/inventaire-essai.csv"

_spec = importlib.util.spec_from_file_location("recover_tecdoc_images", ICI / "recover-tecdoc-images.py")
rti = importlib.util.module_from_spec(_spec)
sys.modules["recover_tecdoc_images"] = rti
_spec.loader.exec_module(rti)


def faux_dsn(sentinelle: str) -> str:
    """URL de base factice, assemblée pour ne pas ressembler à un secret littéral (scanners)."""
    return "postgres" + "://" + "u:" + sentinelle + "@h/db"


def sql_sans_commentaires() -> str:
    return "\n".join(ln for ln in rti.FICHIER_SQL.read_text(encoding="utf-8").splitlines()
                     if not ln.lstrip().startswith("--"))


# --- définition « vendable » : un seul appel, aucune copie --------------------------------

def test_requete_appelle_la_definition_unique_une_seule_fois():
    sql = sql_sans_commentaires()
    assert sql.count("public.piece_est_vendable(") == 1


@pytest.mark.parametrize("condition", ["pri_dispo", "FROZEN", "pricing_state", "pri_vente_ttc", "piece_display"])
def test_requete_ne_recopie_pas_les_conditions_vendables(condition):
    assert condition not in sql_sans_commentaires()


def test_module_ne_recopie_pas_les_conditions_vendables():
    code = (ICI / "recover-tecdoc-images.py").read_text(encoding="utf-8")
    for condition in ("pri_dispo", "FROZEN", "pricing_state", "pri_vente_ttc", "piece_display"):
        assert condition not in code


def test_parametres_de_la_requete():
    assert sorted(set(re.findall(r"%\((\w+)\)s", sql_sans_commentaires()))) == ["id_max", "id_min"]


def test_requete_en_lecture_seule():
    sql = sql_sans_commentaires().upper()
    for mot in ("INSERT", "UPDATE", "DELETE", "TRUNCATE", "ALTER", "DROP", "CREATE", "GRANT"):
        assert not re.search(rf"\b{mot}\b", sql), mot


# --- inventaire et plan ---------------------------------------------------------------------

def test_lecture_csv_ignore_set_et_entete_et_garde_les_virgules():
    lignes = rti.lire_inventaire_csv(FIXTURE)
    assert len(lignes) == 10
    assert lignes[2].piece_ref == "F 026 400 1,2"


def plan_essai(etat, reessayer=False):
    registre = rti.charger_registre()
    return rti.planifier(rti.lire_inventaire_csv(FIXTURE), registre, etat, reessayer)


def test_plan_par_fournisseur(tmp_path):
    plans = plan_essai(rti.Etat(tmp_path / "e.json"))
    bosch = plans["730"].resume()
    assert bosch["marque"] == "BOSCH" and bosch["dossier_registre"] == "30"
    assert bosch["pieces_vendables_sans_image_servie"] == 4      # 1002, 1003, 1004, 1005 (1001 garde une image)
    assert bosch["dont_sans_image_affichable"] == 1
    assert bosch["images_manquantes"] == 6
    assert bosch["nom_invalide_storage"] == 1                     # crochets : signalé, pas envoyé
    assert bosch["images_a_chercher"] == 5
    assert bosch["articles_a_chercher"] == 3                      # 3 images de 1003 = 1 recherche
    ven = plans["4900"].resume()
    assert ven["dossier_vide"] == 1 and ven["images_a_chercher"] == 1
    assert plans["1780"].resume()["images_a_chercher"] == 0


def test_artnr_repli_sur_le_nom_si_reference_vide(tmp_path):
    plans = plan_essai(rti.Etat(tmp_path / "e.json"))
    assert ("30", "1987432") in plans["730"].articles


def test_reprise_ignore_recuperees_et_echecs_definitifs(tmp_path):
    etat = rti.Etat(tmp_path / "e.json")
    etat.noter_recupere("30", "0986494001_1.JPG")
    etat.noter_echec("30", "1987432_2.jpg", "nom_sans_correspondance")
    etat.noter_echec("357", "VP2.JPG", "erreur_recherche")
    etat.enregistrer()
    etat = rti.Etat(tmp_path / "e.json")
    plans = plan_essai(etat)
    assert plans["730"].deja_recuperees == 1
    assert plans["730"].echecs_definitifs == 1
    assert plans["730"].images_a_chercher == 3
    assert plans["4900"].images_a_chercher == 1                  # erreur_recherche : reprise
    assert plan_essai(etat, reessayer=True)["730"].images_a_chercher == 4


def test_etat_dun_autre_format_refuse(tmp_path):
    (tmp_path / "e.json").write_text(json.dumps({"recovered": {"30": []}, "failed": {}}))
    with pytest.raises(rti.ErreurConfiguration):
        rti.Etat(tmp_path / "e.json")


def test_filtre_dossier_garde_les_sans_image_de_la_marque_du_dossier():
    registre = rti.charger_registre()
    lignes = rti.filtrer(rti.lire_inventaire_csv(FIXTURE), [], ["30"], registre)
    assert {ln.piece_id for ln in lignes} == {1001, 1002, 1003, 1004, 1005}


# --- correspondance des noms, types ---------------------------------------------------------

IMAGES = [{"fileName": "A.JPG", "url": "u/a"}, {"fileName": "b.jpg", "url": "u/b"}, {"fileName": "C.PNG", "url": "u/c"}]


def test_correspondance_exacte_casse_radical():
    assert rti.correspondance("A.JPG", IMAGES, False)[1] == "exacte"
    img, sorte, cand = rti.correspondance("B.JPG", IMAGES, False)
    assert img is None and sorte == "casse_non_acceptee" and cand == ["b.jpg"]
    assert rti.correspondance("B.JPG", IMAGES, True)[0]["url"] == "u/b"
    img, sorte, cand = rti.correspondance("C.BMP", IMAGES, True)
    assert img is None and sorte == "aucune" and cand == ["C.PNG"]


@pytest.mark.parametrize("nom,annonce,attendu", [
    ("x.JPG", "", "image/jpeg"), ("x.bmp", "", "image/bmp"), ("x.GIF", "", "image/gif"),
    ("x.webp", "", "image/webp"), ("x.png", "image/png; charset=binary", "image/png"),
    ("x.jpg", "text/html", "image/jpeg"),
])
def test_type_contenu(nom, annonce, attendu):
    assert rti.type_contenu(nom, annonce) == attendu


def test_extraire_images_filtre_le_fournisseur():
    corps = {"articles": [
        {"dataSupplierId": 30, "images": [{"fileName": "A.JPG", "imageURL800": "u800"}, {"fileName": "N.JPG"}]},
        {"dataSupplierId": 31, "images": [{"fileName": "Z.JPG", "imageURL800": "z"}]},
    ]}
    images, noms = rti.extraire_images(corps, "30")
    assert images == [{"fileName": "A.JPG", "url": "u800"}] and noms == ["A.JPG", "N.JPG"]


# --- exécution réelle avec faux portail, CDN et stockage -------------------------------------

class FauxPortail:
    def __init__(self, reponses, connexion=True, session=True):
        self.reponses, self.connexion, self.session = reponses, connexion, session
        self.connexions = 0
        self.recherches = []
        self.ferme = False

    async def connecter(self):
        self.connexions += 1
        return self.connexion

    async def session_valide(self):
        return self.session

    async def chercher(self, artnr, dlnr):
        self.recherches.append((artnr, dlnr))
        r = self.reponses.get(artnr, rti.ErreurRecherche("Locator.clear: Timeout 30000ms exceeded"))
        if isinstance(r, Exception):
            raise r
        return r

    async def fermer(self):
        self.ferme = True


class FauxCdn:
    def __init__(self, echecs=()):
        self.echecs = set(echecs)

    def telecharger(self, url):
        return None if url in self.echecs else (b"\x89PNG-" + url.encode(), "")


class FauxStockage:
    def __init__(self, statuts=None):
        self.statuts = statuts or {}
        self.envois = []

    def envoyer(self, chemin, donnees, type_contenu):
        self.envois.append((chemin, type_contenu))
        return self.statuts.get(chemin, ("envoye", ""))


def resultat(*noms, autres=()):
    images = [{"fileName": n, "url": f"cdn/{n}"} for n in noms]
    return rti.ResultatRecherche(images, list(noms) + list(autres), 1)


def executer(plan, portail, cdn, stockage, etat, **kw):
    async def sans_pause(_s):
        return None
    return asyncio.run(rti.recuperer(plan, portail, cdn, stockage, etat, pause=sans_pause, delais=(0, 0, 0), **kw))


def test_recuperation_noms_et_chemins_inchanges(tmp_path):
    etat = rti.Etat(tmp_path / "e.json")
    plan = plan_essai(etat)["730"]
    portail = FauxPortail({
        "0 986 494 001": resultat("0986494001_1.JPG"),
        "F 026 400 1,2": resultat("F026400_A.JPG", "F026400_B.BMP", "F026400_C.jpg"),
        "1987432": rti.ResultatRecherche([], [], 1),
    })
    stockage = FauxStockage({"30/F026400_B.BMP": ("deja_present", "409")})
    bilan = executer(plan, portail, FauxCdn(), stockage, etat)
    assert bilan.recuperees == 2 and bilan.deja_presentes == 1 and bilan.arret == ""
    assert ("30/0986494001_1.JPG", "image/jpeg") in stockage.envois
    assert ("30/F026400_B.BMP", "image/bmp") in stockage.envois
    assert bilan.causes == {"nom_sans_correspondance": 1, "article_sans_image": 1}
    lu = json.loads((tmp_path / "e.json").read_text())
    assert set(lu["recupere"]) == {"30/0986494001_1.JPG", "30/F026400_A.JPG"}
    detail = json.loads(lu["echecs"]["30/F026400_C.gif"]["detail"])
    assert detail["candidats"] == ["F026400_C.jpg"]                # radical identique : signalé, pas envoyé
    assert lu["echecs"]["30/1987432_2.jpg"]["cause"] == "article_sans_image"


def test_erreurs_techniques_comptees(tmp_path):
    etat = rti.Etat(tmp_path / "e.json")
    plan = plan_essai(etat)["730"]
    portail = FauxPortail({"0 986 494 001": resultat("0986494001_1.JPG"),
                           "F 026 400 1,2": resultat("F026400_A.JPG", "F026400_B.BMP", "F026400_C.gif"),
                           "1987432": resultat("1987432_2.jpg")})
    stockage = FauxStockage({"30/F026400_A.JPG": ("erreur_envoi", "HTTP 500")})
    bilan = executer(plan, portail, FauxCdn(echecs={"cdn/F026400_B.BMP"}), stockage, etat)
    assert bilan.erreurs_techniques == 2
    assert bilan.causes["erreur_telechargement"] == 1 and bilan.causes["erreur_envoi"] == 1


def test_disjoncteur_et_reconnexion(tmp_path):
    etat = rti.Etat(tmp_path / "e.json")
    plan = plan_essai(etat)["730"]
    portail = FauxPortail({}, session=False)
    bilan = executer(plan, portail, FauxCdn(), FauxStockage(), etat, max_erreurs_consecutives=2)
    assert bilan.arret == "disjoncteur"
    assert len(portail.recherches) == 2                           # arrêt, pas de course à vide
    assert portail.connexions == 3                                # connexion + une reconnexion par échec
    lu = json.loads((tmp_path / "e.json").read_text())
    assert {v["cause"] for v in lu["echecs"].values()} == {"erreur_recherche"}
    # la reprise relance ces images
    assert plan_essai(rti.Etat(tmp_path / "e.json"))["730"].images_a_chercher == 5


def test_erreur_isolee_ne_declenche_pas_le_disjoncteur(tmp_path):
    etat = rti.Etat(tmp_path / "e.json")
    plan = plan_essai(etat)["730"]
    portail = FauxPortail({"F 026 400 1,2": resultat("F026400_A.JPG"), "1987432": resultat("1987432_2.jpg")})
    bilan = executer(plan, portail, FauxCdn(), FauxStockage(), etat, max_erreurs_consecutives=2)
    assert bilan.arret == "" and bilan.recuperees == 2 and bilan.causes["erreur_recherche"] == 1


# --- entrée, codes de sortie, secrets ----------------------------------------------------------

def test_commit_exige_un_fournisseur():
    with pytest.raises(SystemExit):
        rti.analyser_arguments(["--commit"])
    with pytest.raises(SystemExit):
        rti.analyser_arguments(["--commit", "--marque", "730", "--inventaire-csv", str(FIXTURE)])


def test_a_blanc_hors_ligne_ecrit_le_rapport(tmp_path, monkeypatch):
    for v in ("DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TECDOC_EMAIL", "TECDOC_PASS"):
        monkeypatch.delenv(v, raising=False)
    a = rti.analyser_arguments(["--inventaire-csv", str(FIXTURE), "--rapport", str(tmp_path / "r"),
                                "--etat", str(tmp_path / "e.json")])
    assert asyncio.run(rti.principal(a)) == rti.SORTIE_OK
    rapport = json.loads((tmp_path / "r/rapport.json").read_text())
    assert rapport["mode"] == "a_blanc"
    assert rapport["total"]["images_manquantes"] == 8
    assert (tmp_path / "r/rapport.csv").read_text().startswith("pm_id,marque,")


def test_base_sans_dsn_sort_en_2(tmp_path, monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    a = rti.analyser_arguments(["--etat", str(tmp_path / "e.json")])
    assert asyncio.run(rti.principal(a)) == rti.SORTIE_CONFIG


def test_connexion_refusee_sort_en_4(tmp_path, monkeypatch):
    monkeypatch.setattr(rti, "lire_inventaire_base", lambda dsn: rti.lire_inventaire_csv(FIXTURE))
    monkeypatch.setenv("DATABASE_URL", "postgres://jamais-lu")
    a = rti.analyser_arguments(["--marque", "730", "--commit", "--etat", str(tmp_path / "e.json")])
    portail = FauxPortail({}, connexion=False)
    code = asyncio.run(rti.principal(a, portail=portail, cdn=FauxCdn(), stockage=FauxStockage()))
    assert code == rti.SORTIE_CONNEXION and portail.ferme


def test_disjoncteur_sort_en_3(tmp_path, monkeypatch):
    monkeypatch.setattr(rti, "lire_inventaire_base", lambda dsn: rti.lire_inventaire_csv(FIXTURE))
    monkeypatch.setenv("DATABASE_URL", "postgres://jamais-lu")
    a = rti.analyser_arguments(["--marque", "730", "--commit", "--max-erreurs-consecutives", "1",
                                "--etat", str(tmp_path / "e.json")])
    code = asyncio.run(rti.principal(a, portail=FauxPortail({}), cdn=FauxCdn(), stockage=FauxStockage()))
    assert code == rti.SORTIE_DISJONCTEUR


def test_identifiants_jamais_journalises(tmp_path, monkeypatch, caplog):
    secrets = {"TECDOC_EMAIL": "sentinelle-email-x9", "TECDOC_PASS": "sentinelle-mdp-x9",
               "SUPABASE_URL": "https://sentinelle-url-x9.invalid", "SUPABASE_SERVICE_ROLE_KEY": "sentinelle-cle-x9",
               "DATABASE_URL": faux_dsn("sentinelle-db-x9")}
    for k, v in secrets.items():
        monkeypatch.setenv(k, v)
    monkeypatch.setattr(rti, "lire_inventaire_base", lambda dsn: rti.lire_inventaire_csv(FIXTURE))
    monkeypatch.setitem(sys.modules, "playwright", None)          # pas de navigateur : arrêt en configuration
    monkeypatch.setitem(sys.modules, "playwright.async_api", None)
    a = rti.analyser_arguments(["--marque", "730", "--commit", "--etat", str(tmp_path / "e.json")])
    with caplog.at_level(logging.DEBUG):
        code = asyncio.run(rti.principal(a))
    assert code == rti.SORTIE_CONFIG
    sortie = caplog.text + (tmp_path / "e.json").read_text() if (tmp_path / "e.json").exists() else caplog.text
    for v in secrets.values():
        assert v not in sortie


def test_variable_absente_nommee_sans_valeur(monkeypatch):
    monkeypatch.setenv("TECDOC_EMAIL", "sentinelle-z")
    monkeypatch.delenv("TECDOC_PASS", raising=False)
    with pytest.raises(rti.ErreurConfiguration) as e:
        rti.env_obligatoire("TECDOC_EMAIL", "TECDOC_PASS")
    assert "TECDOC_PASS" in str(e.value) and "sentinelle-z" not in str(e.value)


def test_connexion_base_echouee_sans_detail(monkeypatch):
    class FauxPsycopg:
        @staticmethod
        def connect(*_a, **_k):
            raise RuntimeError("password authentication failed for sentinelle-db-y")
    monkeypatch.setitem(sys.modules, "psycopg2", FauxPsycopg)
    with pytest.raises(rti.ErreurConfiguration) as e:
        rti.lire_inventaire_base(faux_dsn("sentinelle-db-y"))
    assert "sentinelle" not in str(e.value)


def test_verrou_exclusif(tmp_path):
    v1 = rti.verrouiller(tmp_path / "e.json")
    assert v1 is not None
    assert rti.verrouiller(tmp_path / "e.json") is None
    v1.close()


def test_noms_invalides_storage():
    assert rti.CLE_STORAGE_VALIDE.match("30/0986494001_1.JPG")
    assert rti.CLE_STORAGE_VALIDE.match("15/A B.JPG")
    assert not rti.CLE_STORAGE_VALIDE.match("15/MS902.0 [TEC DOC].JPG")
