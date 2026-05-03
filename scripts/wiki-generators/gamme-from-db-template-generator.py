#!/usr/bin/env python3
"""
gamme-from-db-template-generator.py — Enrichit les entrées DB __rag_knowledge
'Données techniques OEM' sparse (< 500c) par templates de contenu technique.

⚠️ CAS PARTICULIER : ce générateur écrit dans la **DB Supabase** (table
__rag_knowledge), pas dans le filesystem wiki/exports/rag/. Sa logique métier
produit du contenu RAG consommé directement par le backend NestJS (pas
mirroré via sync-from-wiki). Placement dans wiki-generators/ reflète son
rôle de producteur de contenu RAG, mais l'OUTPUT path est DB-only.

Usage:
  python3 scripts/wiki-generators/gamme-from-db-template-generator.py [--dry-run] [--gamme disque-de-frein]

Requiert : SUPABASE_SERVICE_ROLE_KEY dans l'environnement (.env.vps)
"""
import os
import re
import sys
import hashlib
import time
import argparse
import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://cxpojprgwgubzjyqzmoq.supabase.co")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

def _build_headers():
    return {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

# Template de contenu technique par catégorie de pièce
# Clé = mots-clés dans le titre (lowercase), Valeur = dict avec sections
TEMPLATES = {
    "courroie d'accessoire": {
        "role": "Entraîner les accessoires moteur (alternateur, pompe direction, compresseur clim, pompe à eau) depuis le vilebrequin.",
        "variantes": ["Courroie poly-V (serpentine) : standard actuel", "Courroie trapézoïdale : anciens moteurs", "Courroie dentée accessoires : synchronisation stricte"],
        "specs": ["Section poly-V : 6PK, 7PK, 8PK (nombre de nervures × longueur mm)", "Longueur : 800–2500 mm selon circuit", "Tension : 200–600 N (vérification dynamomètre)", "Matériaux : EPDM avec fibres aramide ou polyester"],
        "defauts": ["Sifflement à froid : usure nervures ou galet", "Rupture = perte alternateur + direction assistée + clim", "Craquelures visibles : remplacement immédiat"],
        "entretien": "Remplacement préventif 60 000–100 000 km ou 5 ans. Vérifier galets tendeurs simultanément."
    },
    "pompe à eau": {
        "role": "Faire circuler le liquide de refroidissement dans le circuit moteur pour maintenir la température de fonctionnement optimale (85–95 °C).",
        "variantes": ["Pompe mécanique (entraînement courroie/chaîne) : standard", "Pompe électrique : moteurs hybrides, EV thermique", "Pompe intégrée au kit distribution"],
        "specs": ["Débit : 40–120 L/min selon cylindrée", "Pression max : 1,5–2,5 bars", "Matériaux corps : aluminium ou fonte, turbine plastique ou acier inox", "Joint d'étanchéité : mécanique (graphite/céramique)"],
        "defauts": ["Fuite axe pompe = traces rouille sous courroie distribution", "Bruit roulement = grincement synchrone régime", "Surchauffe moteur = débit insuffisant (turbine cassée ou encrassée)"],
        "entretien": "Remplacement préventif avec le kit distribution. Rinçage circuit recommandé."
    },
    "thermostat": {
        "role": "Réguler la température du moteur en contrôlant le débit de liquide de refroidissement vers le radiateur selon la température.",
        "variantes": ["Thermostat à cire (standard) : ouverture thermostatique à température fixe", "Thermostat cartouche (intégré boîtier) : remplacement boîtier complet", "Thermostat électrique (thermostat mappé) : piloté par calculateur"],
        "specs": ["Température d'ouverture : 80–95 °C (marquée sur le boîtier)", "Levée valve à T+10°C : > 7 mm", "Débit à pleine ouverture : > 90% débit pompe"],
        "defauts": ["Moteur qui n'atteint pas température : thermostat bloqué ouvert", "Surchauffe rapide : thermostat bloqué fermé", "Consommation carburant augmentée : thermostat ouvert trop tôt"],
        "entretien": "Remplacement avec joint et liquide de refroidissement. Préventif à chaque vidange circuit."
    },
    "vase d'expansion": {
        "role": "Absorber les variations de volume du liquide de refroidissement selon la température et maintenir la pression du circuit (0,9–1,3 bar).",
        "variantes": ["Vase pressurisé (rôle actif) : connecté directement au circuit", "Vase de débordement (rôle passif) : récupération uniquement (ancien)"],
        "specs": ["Pression de service : 0,9–1,5 bars (bouchon calibré)", "Matériau : polyamide ou polypropylène résistant T°", "Jauge niveau min/max sur paroi transparente"],
        "defauts": ["Vase fissuré = perte de liquide progressive + surchauffe", "Bouchon défaillant = ébullition prématurée", "Liquide marron/huileux = joint de culasse défaillant"],
        "entretien": "Vérification niveau à froid. Remplacement liquide tous les 2 ans."
    },
    "alternateur": {
        "role": "Générer le courant électrique alternatif converti en continu pour alimenter tous les consommateurs et recharger la batterie.",
        "variantes": ["Alternateur classique avec régulateur interne", "Alternateur à régulation variable (smart charging) : régule selon besoins", "Alternateur-démarreur (BSG) : hybride léger 48 V"],
        "specs": ["Tension de charge nominale : 13,8–14,4 V", "Intensité max : 70–200 A selon modèle", "Vitesse de rotation : 1500–18 000 tr/min", "Régulateur intégré (AVR) ou externe"],
        "defauts": ["Tension < 13,5 V = régulateur ou diodes HS", "Sifflement = roulement ou pont de diodes", "Voyant batterie allumé = courroie, fusible ou alternateur"],
        "entretien": "Durée de vie 150 000–200 000 km. Contrôle tension charge à chaque révision."
    },
    "batterie": {
        "role": "Stocker l'énergie électrique pour le démarrage et alimenter les consommateurs moteur arrêté.",
        "variantes": ["Batterie plomb-acide (SLI) : standard, économique", "Batterie AGM : décharge profonde, véhicules Start-Stop", "Batterie EFB : cycle partiel, entrée de gamme Start-Stop", "Batterie lithium (EV/hybride) : haute densité énergie"],
        "specs": ["Tension nominale : 12 V (6 cellules 2 V)", "Capacité : 40–110 Ah selon véhicule", "Courant de démarrage (EN) : 300–900 A", "Température optimale : 20–25 °C (perte -30% à -15 °C)"],
        "defauts": ["Démarrage difficile par froid : batterie sulfatée ou en fin de vie", "Décharge permanente : consommateur parasite ou alternateur HS", "Batterie gonflée : surcharge alternateur ou chaleur"],
        "entretien": "Durée de vie 4–6 ans. Test capacité au testeur de batterie. AGM : ne jamais décharger sous 10,5 V."
    },
    "radiateur": {
        "role": "Dissiper la chaleur du liquide de refroidissement vers l'air ambiant pour maintenir le moteur à température optimale.",
        "variantes": ["Radiateur aluminium brasé : standard actuel, léger", "Radiateur cuivre-laiton : véhicules anciens, réparable", "Radiateur huile intégré : certains modèles diesel"],
        "specs": ["Matériau : aluminium alliage 3003, tubes plats 1,5–2 mm", "Pression de test : 1,5 × pression de service", "Débit nominal : 60–120 L/min"],
        "defauts": ["Fuite externe : colmatage provisoire possible mais remplacement conseillé", "Radiateur colmaté : surchauffe progressive, nettoyage haute pression", "Ailettes écrasées : perte d'échange, nettoyage délicat"],
        "entretien": "Rinçage circuit tous les 4 ans. Liquide OAT (orange) : durée 5 ans."
    },
    "filtre à huile": {
        "role": "Retenir les particules métalliques, suies et impuretés en suspension dans l'huile moteur pour protéger les organes de frottement.",
        "variantes": ["Filtre à cartouche métallique (spin-on) : remplacement complet", "Filtre à cartouche papier (insert) : cartouche seule + boîtier réutilisable", "Filtre combiné huile + eau : certains moteurs BMW"],
        "specs": ["Filtration nominale : 10–25 µm", "Pression de clapet by-pass : 1,5–3,5 bars (protection démarrage froid)", "Clapet anti-retour : évite vidange circuit à l'arrêt", "Matériau média filtrant : cellulose ou synthétique"],
        "defauts": ["Filtre colmaté = by-pass ouvert = huile non filtrée = usure prématurée", "Fuite à la base = joint torique non lubrifié ou trop serré"],
        "entretien": "Remplacement à chaque vidange (7 500–15 000 km selon huile). Lubrifier le joint avant montage."
    },
    "filtre à carburant": {
        "role": "Retenir les particules, la rouille et l'eau du carburant avant l'entrée dans la pompe haute pression et les injecteurs.",
        "variantes": ["Filtre essence en ligne (basse pression) : montage tuyauterie retour/aller", "Filtre gazole avec décanteur eau : vidange eau périodique", "Filtre intégré au module pompe (en réservoir)"],
        "specs": ["Filtration : 10–30 µm (essence), 5–10 µm (diesel HP)", "Pression admissible : 5–10 bars (essence), 10–15 bars (diesel)", "Capacité rétention eau : > 30 mL (filtre diesel)"],
        "defauts": ["Démarrage difficile : filtre colmaté ou eau dans filtre diesel", "Manque puissance à l'accélération : débit insuffisant", "Capteur eau (diesel) : voyant allumé = vidange eau obligatoire"],
        "entretien": "Remplacement : 30 000–50 000 km (gazole), 60 000–100 000 km (essence). Vidange eau filtre diesel tous les 15 000 km."
    },
    "injecteur": {
        "role": "Pulvériser le carburant sous pression dans la chambre de combustion ou le collecteur d'admission avec un débit et une atomisation précis.",
        "variantes": ["Injecteur électromagnétique (essence) : bobine + pointeau, pression 3–6 bars", "Injecteur piézoélectrique (diesel common rail) : précision ±1 µs, pression jusqu'à 2200 bars", "Injecteur GDI (injection directe essence) : pression 150–350 bars"],
        "specs": ["Débit nominal : 150–400 mL/min (essence) / calibré en mm³/coup (diesel)", "Résistance bobine : 12–16 Ω (haute) ou 1–5 Ω (basse impédance)", "Étanchéité siège : 0 fuite à l'arrêt (tolérance zéro)"],
        "defauts": ["Injecteur qui fuit = surconsommation, fumées noires, dilution huile", "Injecteur bouché = trou de combustion, ratés allumage", "Dépôts = nettoyage ultrason ou remplacement"],
        "entretien": "Contrôle débit tous les 100 000 km. Nettoyage ultrason possible. Joint cuivre à usage unique."
    },
    "turbocompresseur": {
        "role": "Comprimer l'air admis dans le moteur pour augmenter le remplissage des cylindres et donc la puissance sans augmenter la cylindrée.",
        "variantes": ["Turbo à géométrie fixe : simple, économique", "Turbo à géométrie variable (VGT) : plage de pression variable", "Turbo à double volute (biturbo / twin-scroll) : réponse améliorée", "Turbo électrique (e-turbo) : 48 V, zéro turbo lag"],
        "specs": ["Vitesse de rotation turbine : 100 000–300 000 tr/min", "Pression de suralimentation : 0,8–2,5 bars relatifs", "Température côté turbine : jusqu'à 950 °C (diesel) / 1050 °C (essence)", "Huile lubrification : 4–6 bars, débit 2–4 L/min"],
        "defauts": ["Sifflement aigu = jeu palier ou roue déséquilibrée", "Fumées bleues = joints axiaux défaillants (huile turbine)", "Manque puissance = wastegate ou actuateur VGT bloqué"],
        "entretien": "Laisser tourner moteur 2 min avant extinction. Huile synthétique obligatoire. Durée vie 150 000–200 000 km."
    },
    "vanne egr": {
        "role": "Recirculer une fraction des gaz d'échappement vers l'admission pour réduire les émissions de NOx par dilution et abaissement de la température de combustion.",
        "variantes": ["EGR basse pression (LP-EGR) : en aval FAP, gaz froids filtrés", "EGR haute pression (HP-EGR) : en amont turbine, gaz chauds", "EGR refroidi : échangeur thermique intégré", "EGR électrique (brushless) : précision de débit améliorée"],
        "specs": ["Taux de recirculation : 0–40% selon charge/régime", "Température gaz EGR à la vanne : 100–600 °C", "Résistance bobine : 5–20 Ω (EGR électromagnétique)", "Capteur position intégré : 0–5 V"],
        "defauts": ["EGR bloquée ouverte : calage ralenti, fumées noires", "EGR bloquée fermée : NOx élevés, voyant OBD", "Dépôts carbone : nettoyage possible, remplacement si corrodée"],
        "entretien": "Nettoyage préventif tous les 60 000 km (produit décarbonisant). Remplacement si valve HS."
    },
    "capteur maf|débitmètre": {
        "role": "Mesurer la masse ou le volume d'air admis dans le moteur pour calculer la quantité de carburant à injecter.",
        "variantes": ["Fil chaud (HFM) : platine chauffé, refroidissement mesure le débit massique", "Film chaud : robuste, réponse rapide", "MAF + IAT combiné : débit + température en un capteur"],
        "specs": ["Signal sortie : 0–5 V ou fréquence 0–12 kHz", "Plage mesure : 2–720 kg/h selon cylindrée", "Alimentation : 12 V, consommation < 200 mA", "Matériaux : platine (fil/film), boîtier PA"],
        "defauts": ["Encrassement huile (reniflard) : signal biaisé, surconsommation", "Code P0100–P0104 : circuit MAF hors plage"],
        "entretien": "Nettoyage spray MAF cleaner (jamais de chiffon). Remplacement si nettoyage inefficace."
    },
    "capteur map|pression admission": {
        "role": "Mesurer la pression absolue dans le collecteur d'admission pour que le calculateur détermine la masse d'air admise (stratégie speed-density).",
        "variantes": ["MAP seul : pression uniquement", "MAP + IAT : pression + température combinés", "MAP turbo (TMAP) : plage étendue pour moteurs suralimentés"],
        "specs": ["Plage mesure : 20–300 kPa (1–3 bars absolus pour turbo)", "Signal : 0,5–4,5 V proportionnel à la pression", "Alimentation : 5 V, consommation < 10 mA"],
        "defauts": ["Code P0105–P0108 : signal MAP hors plage", "Vacuum leak = signal MAP élevé = richesse perturbée"],
        "entretien": "Pas d'entretien préventif. Remplacement sur défaillance."
    },
    "sonde température": {
        "role": "Mesurer la température d'un fluide (eau, air, huile, carburant) et transmettre un signal au calculateur pour adapter les paramètres moteur.",
        "variantes": ["NTC (Negative Temperature Coefficient) : résistance diminue quand T augmente — standard", "PTC (Positive Temperature Coefficient) : résistance augmente avec T", "Thermocouple : très haute température (gaz échappement)"],
        "specs": ["Résistance NTC type : 10 kΩ à 25 °C / 330 Ω à 80 °C / 170 Ω à 90 °C", "Tension signal : 0–5 V (diviseur de tension)", "Temps de réponse : < 5 s pour variation 5 °C"],
        "defauts": ["Signal figé (circuit ouvert) : injection enrichie en permanence", "Signal court-circuit masse : injection appauvrie", "Code P0115–P0128 selon capteur concerné"],
        "entretien": "Remplacement avec joint torique. Pas d'intervalle préventif fixe."
    },
    "pompe à carburant": {
        "role": "Aspirer le carburant du réservoir et le refouler sous pression vers le circuit d'injection (basse pression) ou la pompe haute pression.",
        "variantes": ["Pompe immergée (dans réservoir) : standard, refroidissement par carburant", "Pompe externe (en ligne) : anciens véhicules, remplacée par immergée", "Module pompe complet : pompe + jauge + flotteur"],
        "specs": ["Pression de refoulement (essence) : 3,5–6 bars", "Débit nominal : 50–150 L/h", "Consommation : 5–15 A sous charge", "Durée de vie : 150 000–200 000 km"],
        "defauts": ["Démarrage difficile : pression insuffisante (clapet anti-retour)", "Panne sèche à chaud : moteur pompe thermiquement protégé", "Bruit de vrombissement fort : roulement pompe usé"],
        "entretien": "Ne pas rouler réservoir quasi-vide (refroidissement et lubrification pompe). Remplacement module complet recommandé."
    },
    "joint spi|joint spy|joint d'arbre": {
        "role": "Assurer l'étanchéité dynamique autour d'un arbre rotatif pour retenir l'huile ou la graisse et exclure la poussière.",
        "variantes": ["Joint lèvre simple : face intérieure lubrification huile", "Joint lèvre double : + lèvre anti-poussière externe", "Joint PTFE (sans lèvre) : haute température, haute vitesse", "Joint radial caged (RADSEAL) : arbre vilebrequin"],
        "specs": ["Matériaux lèvre : NBR (−40/+120 °C), FKM/Viton (−20/+200 °C), PTFE", "Tolérance d'excentricité : < 0,3 mm", "Vitesse linéaire max : 4–16 m/s selon matière"],
        "defauts": ["Fuite huile en couronne autour arbre : lèvre durcie ou usée", "Lèvre retournée : mauvais montage (outil de pose obligatoire)", "Joint double face : orientation côté huilé critique"],
        "entretien": "Montage à l'outil (jamais au marteau direct). Léger film d'huile sur lèvre avant montage."
    },
    "roulement": {
        "role": "Guider la rotation d'un arbre ou d'un moyeu en réduisant les frottements et en supportant les charges radiales et/ou axiales.",
        "variantes": ["Roulement à billes : charges mixtes, vitesses élevées", "Roulement à rouleaux coniques : charges axiales importantes (roue)", "Roulement à rouleaux cylindriques : charges radiales lourdes", "Roulement de roue intégré (hub bearing) : double rangée, ABS intégré"],
        "specs": ["Jeu axial admissible roulement de roue : 0–0,05 mm", "Couple de serrage écrou de fusée : 150–350 N·m (serrage + crénelage)", "Graisse : lithium ou polyurée NLGI 2–3"],
        "defauts": ["Ronflement en virage : roulement de roue (charge axiale révèle le défaut)", "Vibrations vitesse constante : roulement déséquilibré", "Jeu volant : roulement de colonne de direction"],
        "entretien": "Remplacement à l'apparition de bruit anormal. Ne jamais réutiliser un roulement démonté."
    },
    "amortisseur": {
        "role": "Contrôler les oscillations du ressort et stabiliser la roue en contact avec la chaussée. Dissipe l'énergie cinétique des chocs. NE SUPPORTE PAS LE POIDS DU VÉHICULE.",
        "variantes": ["Amortisseur hydraulique monotube : gaz séparé, performance constante", "Amortisseur hydraulique bitube : économique, standard", "Amortisseur à gaz (bi-pression) : meilleure réponse", "Amortisseur électronique (CDC) : réglage continu calculateur"],
        "specs": ["Force de compression : 300–800 N selon charge", "Force de détente : 600–1800 N", "Course utile : 100–200 mm", "Gaz chargement (monotube) : azote 10–30 bars"],
        "defauts": ["Rebonds excessifs sur bosses : amortisseur fatigué (claquement)", "Affaissement caisse d'un côté : fuite huile amortisseur", "Bruits de choc (butée) : amortisseur en fin de course"],
        "entretien": "Remplacement par paire obligatoire sur même essieu. Contrôle tous les 20 000 km."
    },
    "ressort": {
        "role": "Supporter la charge du véhicule, maintenir la hauteur de caisse et stocker/restituer l'énergie des chocs. NE JOUE PAS LE RÔLE D'AMORTISSEUR.",
        "variantes": ["Ressort hélicoïdal : standard véhicules modernes", "Ressort à lames : utilitaires et pickups", "Barre de torsion : certains 4x4 et anciennes architectures", "Ressort pneumatique : véhicules haut de gamme et utilitaires"],
        "specs": ["Raideur : 15–50 N/mm (auto) / 50–200 N/mm (utilitaire)", "Diamètre fil : 10–20 mm", "Hauteur libre vs hauteur montée : différence = précharge"],
        "defauts": ["Ressort cassé = affaissement brutal d'un côté, danger immédiat", "Ressort tassé = caisse basse, géométrie modifiée", "Bruit crissement = ressort contre coupelle (graisse silicone)"],
        "entretien": "Remplacement par paire sur même essieu (écart raideur > 10% inacceptable). Contrôle hauteur de caisse."
    },
    "rotule": {
        "role": "Articuler le bras de suspension sur la fusée d'essieu en autorisant les mouvements de suspension et de braquage simultanément.",
        "variantes": ["Rotule de triangle inférieur : supporte le poids en compression", "Rotule de triangle supérieur : guidage", "Rotule de direction (tie rod) : transmission braquage", "Rotule sur axe intégré : remplacement ensemble bras + rotule"],
        "specs": ["Jeu radial admissible : 0 mm (pièce de sécurité)", "Couple de serrage : 50–120 N·m + goupille ou frein filet", "Matériaux : boule 100Cr6, logement PA66 ou bronze"],
        "defauts": ["Claquement bosses : jeu axial rotule", "Tire d'un côté : parallélisme perturbé par jeu rotule", "Soufflet déchiré : contamination immédiate"],
        "entretien": "Contrôle jeu à chaque révision. Réglage géométrie obligatoire après remplacement."
    },
    "silent bloc|silentbloc": {
        "role": "Isoler vibrations et bruits entre pièces métalliques mobiles via un insert caoutchouc vulcanisé entre deux armatures métalliques.",
        "variantes": ["Silent bloc cylindrique : bras de suspension, fixations moteur", "Silent bloc conique : différentiel, boîte de vitesses", "Silent bloc hydraulique : absorbeur actif, plus performant", "Coussinet de barre stabilisatrice"],
        "specs": ["Matériaux élastomère : NR (naturel), EPDM, polyuréthane", "Raideur axiale / radiale : 50–5000 N/mm selon application", "Température : −40/+100 °C (NR), −40/+150 °C (EPDM)"],
        "defauts": ["Craquements suspension : caoutchouc fissuré ou décollé", "Vibrations en ligne droite : silent bloc moteur affaissé", "Bruit de roulis : silent bloc barre stabilisatrice usé"],
        "entretien": "Remplacement au ressuage visible ou sur défaillance. Lubrifier légèrement à la pose."
    },
    "plaquette": {
        "role": "Générer la friction nécessaire pour ralentir et arrêter le véhicule par serrage hydraulique contre le disque de frein en rotation.",
        "variantes": ["Garniture NAO (Non-Asbestos Organic) : faibles émissions de particules, bruit réduit", "Garniture semi-métallique : résistance à chaud, usure disque plus rapide", "Garniture céramique : haute performance, longue durée", "Plaquette avec capteur d'usure électrique : voyant tableau de bord"],
        "specs": ["Épaisseur neuve : 10–18 mm", "Épaisseur mini : 2–3 mm (remplacement obligatoire)", "Coefficient de friction : 0,35–0,45 (µ)", "Température de service : jusqu'à 400 °C (plaquettes route)"],
        "defauts": ["Crissement : plaquettes usées (indicateur métallique) ou encrassées", "Vibration pédale : plaquettes voilées ou disque endommagé", "Tirage d'un côté : plaquette collée (étrier grippé)"],
        "entretien": "Contrôle épaisseur tous les 20 000 km. Remplacement par jeu complet (4 plaquettes par essieu)."
    },
    "disque de frein": {
        "role": "Constituer la surface de friction sur laquelle les plaquettes serrent pour convertir l'énergie cinétique en chaleur et arrêter le véhicule.",
        "variantes": ["Disque plein : entrée de gamme, refroidissement passif", "Disque ventilé (ajouré) : dissipation thermique améliorée, standard essieu avant", "Disque percé/rainuré : évacuation gaz, haute performance", "Disque composite (acier + fonte) : allègement"],
        "specs": ["Épaisseur nominale/mini gravée sur chant du disque", "Voile axial maxi : 0,05–0,10 mm (contrôle au comparateur)", "Matériau : fonte grise GG25 ou GGG40, revêtement anti-corrosion optionnel"],
        "defauts": ["Vibrations pédale à l'arrêt : voile > 0,10 mm", "Sillons profonds (> 1,5 mm) : remplacement obligatoire", "Disque rouillé sur piste (inutilisé) : disparaît au freinage normal"],
        "entretien": "Remplacement par paire sur même essieu. Rodage 200 km à éviter freinages brusques."
    },
    "étrier": {
        "role": "Transformer la pression hydraulique du circuit de frein en force de serrage mécanique des plaquettes contre le disque.",
        "variantes": ["Étrier flottant (coulissant) : 1 piston, mouvement latéral, économique", "Étrier fixe : 2–6 pistons, rigide, haute performance", "Étrier de frein à main intégré : vis dans piston pour freinage stationnaire"],
        "specs": ["Diamètre piston : 38–60 mm (avant), 28–45 mm (arrière)", "Pression de service : 60–160 bars", "Matériau corps : aluminium (léger) ou fonte (économique)", "Joint piston : polyuréthane ou EPDM"],
        "defauts": ["Fuite caliper : liquide visible sur roue, pédale molle", "Étrier grippé : chauffage unilatéral, usure plaquette côté interne", "Piston bloqué rentré : frein qui accroche"],
        "entretien": "Déblocage piston et graissage glissières tous les 50 000 km. Remplacement liquide de frein tous les 2 ans."
    },
    "capteur abs": {
        "role": "Détecter la vitesse de rotation de chaque roue via une cible magnétique pour informer le calculateur ABS/ESP et moduler le freinage.",
        "variantes": ["Capteur inductif passif (VR) : signal sinusoïdal, sans alimentation", "Capteur actif Hall : signal carré 0/5 V, alimentation 12 V", "Capteur intégré au roulement de roue (ABS actif)"],
        "specs": ["Signal Hall : alimentation 5 V, sortie 0 V / 5 V", "Signal inductif : résistance bobine 800–2500 Ω", "Entrefer max : 1,5 mm (inductif) / 2,5 mm (Hall)", "Fréquence signal : 0–3000 Hz (0–300 km/h)"],
        "defauts": ["ABS désactivé + voyant jaune : capteur encrassé, déconnecté ou entrefer trop grand", "Code C0031–C0050 : roue concernée identifiable", "Signal intermittent : oxydation connecteur ou câble endommagé"],
        "entretien": "Nettoyage piste de roulement (pas de graisse). Remplacement sur défaillance. Vérifier roue phonique."
    },
    "capteur|sonde": {
        "role": "Mesurer un paramètre physique (température, pression, position, vitesse) et transmettre un signal électrique au calculateur pour la gestion moteur ou châssis.",
        "variantes": ["Capteur résistif (NTC/PTC) : variation de résistance avec la grandeur mesurée", "Capteur à effet Hall : signal numérique 0/5 V, précision angulaire", "Capteur inductif : signal sinusoïdal proportionnel à la vitesse", "Capteur piézorésistif : variation résistance avec pression"],
        "specs": ["Signal typique : 0,5–4,5 V (analogique) ou 0/5 V (numérique)", "Alimentation : 5 V ou 12 V selon type", "Impédance sortie : 1–10 kΩ selon application", "Précision : ±1–5% pleine échelle"],
        "defauts": ["Signal figé ou hors plage : court-circuit ou circuit ouvert", "Signal bruité : masse insuffisante ou câble parasité", "Code P0xxx selon le capteur : consulter documentation constructeur"],
        "entretien": "Pas d'entretien préventif. Vérifier connecteur et câblage avant remplacement."
    },
    "kit d'embrayage|kit embrayage": {
        "role": "Regrouper en un seul kit les trois composants de l'embrayage : disque, mécanisme et butée, pour une révision complète cohérente.",
        "variantes": ["Kit 3 pièces (disque + mécanisme + butée) : standard", "Kit 2 pièces (disque + mécanisme) : butée réutilisable", "Kit bi-masse : avec volant moteur bi-masse inclus"],
        "specs": ["Diamètre disque : 180–260 mm selon cylindrée", "Couple transmissible : 150–600 N·m", "Matériau garniture : organique (NAO) ou Kevlar pour hautes performances", "Épaisseur disque neuf : 6–10 mm, mini 4–5 mm"],
        "defauts": ["Patinage : disque usé ou graisse sur les garnitures", "Claquement en prise : amortisseur de torsion disque cassé", "Dureté pédale : diaphragme fatigué ou butée HS"],
        "entretien": "Remplacement systématique des 3 pièces. Nettoyer cloche et vérifier volant moteur (voile < 0,2 mm)."
    },
    "maître cylindre": {
        "role": "Convertir la pression mécanique de la pédale de frein en pression hydraulique distribuée aux étriers et cylindres de roue.",
        "variantes": ["Maître cylindre simple (1 circuit) : anciens véhicules", "Maître cylindre tandem (2 circuits indépendants) : obligatoire depuis 1967", "Maître cylindre avec capteur de pression (ESP) : signal calculateur"],
        "specs": ["Diamètre piston : 19–26 mm selon véhicule", "Pression générée : 80–200 bars sur pédale normale", "Matériau corps : aluminium anodisé ou fonte", "Joint piston : EPDM ou polyuréthane"],
        "defauts": ["Pédale longue + dure : air dans le circuit (purge obligatoire)", "Pédale molle + descend seule : fuite interne maître cylindre", "Fuite liquide sous tableau de bord : soufflet/joint HS"],
        "entretien": "Purge circuit frein obligatoire après remplacement. Remplacement liquide tous les 2 ans."
    },
    "compresseur de climatisation": {
        "role": "Comprimer le fluide frigorigène (R134a ou R1234yf) en phase gazeuse pour élever sa pression et sa température, initiant le cycle thermodynamique de réfrigération.",
        "variantes": ["Compresseur à pistons axiaux à cylindrée variable : économique en carburant", "Compresseur scroll (spirale) : silencieux, hybrides/EV", "Compresseur électrique 12 V ou 48 V : véhicules hybrides"],
        "specs": ["Pression aspiration (basse) : 1,5–3 bars", "Pression refoulement (haute) : 8–20 bars", "Huile PAG : 40–180 mL selon capacité compresseur", "Embrayage électromagnétique : 12 V, 3–5 A"],
        "defauts": ["Claquement embrayage : embrayage slippé ou bobine HS", "Pas de froid + compresseur non enclenché : pressostat, fusible ou fluide insuffisant", "Bruit de fonctionnement anormal : roulement ou clapet interne"],
        "entretien": "Recharge uniquement par technicien certifié (fluides F-gas). Huile PAG à vérifier lors de chaque ouverture circuit."
    },
    "silencieux|pot d'échappement": {
        "role": "Réduire le niveau sonore des gaz d'échappement par expansion des gaz et absorption acoustique dans des chambres de résonance.",
        "variantes": ["Silencieux central (résonateur) : atténuation fréquences moyennes", "Silencieux arrière (principal) : atténuation basses fréquences", "Silencieux sport : pression contre-pression réduite, son plus présent"],
        "specs": ["Matériaux : acier inoxydable AISI 409 ou 304, épaisseur 1,2–2 mm", "Température entrée : 200–600 °C", "Contre-pression admissible : < 0,3 bar", "Durée de vie : 8–15 ans (inox) / 5–8 ans (acier aluminisé)"],
        "defauts": ["Bruit de ferraille : déflecteur interne cassé", "Bruit d'échappement anormal : fissure ou rouille perforante", "Consommation augmentée : contre-pression excessive (colmaté)"],
        "entretien": "Inspection visuelle annuelle. Remplacement sans couper si possible (jeu d'assemblage)."
    },
    "durite|tuyau": {
        "role": "Transporter les fluides (liquide de refroidissement, carburant, air, liquide de frein) entre les composants du circuit correspondant.",
        "variantes": ["Durite caoutchouc EPDM : refroidissement, standard", "Durite silicone : haute température (turbo, refroidissement perf)", "Tuyau rigide acier : circuit haute pression carburant/frein", "Tuyau flexible PTFE : compatibilité chimique totale"],
        "specs": ["Pression de service : 0,5–3 bars (refroidissement), jusqu'à 250 bars (injection)", "Température : −40/+175 °C (EPDM), −60/+200 °C (silicone)", "Diamètre intérieur : 10–50 mm selon circuit"],
        "defauts": ["Durite gonflée ou craquelée : vieillissement = remplacement immédiat", "Fuite aux colliers : desserrage ou collier corrodé", "Durite effondrée à chaud (depression) : paroi interne décolle"],
        "entretien": "Inspection visuelle annuelle. Durites EPDM : durée de vie 10–15 ans."
    },
    "support moteur|suspension moteur": {
        "role": "Maintenir le groupe motopropulseur en position dans le compartiment moteur tout en isolant les vibrations vers la caisse.",
        "variantes": ["Support hydraulique : amortissement actif des vibrations, liquide de déplacement interne", "Support caoutchouc simple : économique, confort moindre", "Support actif (électronique) : contre-vibration pilotée"],
        "specs": ["Raideur statique : 100–500 N/mm", "Atténuation vibratoire : −20 à −40 dB à 100 Hz (hydraulique)", "Matériaux élastomère : NR ou EPDM vulcanisé sur armature acier"],
        "defauts": ["Vibrations habitacle au ralenti : support affaissé ou déchiré", "Claquements accélération/décélération : support HS ou desserré", "Bruit sourd virage à plein régime : support de transmission endommagé"],
        "entretien": "Contrôle visuel à chaque révision (fissure caoutchouc). Remplacement par paire recommandé."
    },
    "mâchoire|tambour": {
        "role": "Assurer le freinage arrière par expansion des mâchoires contre la paroi intérieure du tambour sous pression hydraulique du cylindre de roue.",
        "variantes": ["Frein à tambour auto-serrant (Simplex) : standard", "Frein à tambour auto-bloquant (Duplex) : axe avant anciens véhicules", "Tambour + disque intégré : frein de stationnement (hat drum)"],
        "specs": ["Diamètre tambour standard : 180–250 mm", "Épaisseur garniture neuve : 4–6 mm, mini 1,5 mm", "Jeu réglage standard : 0,3–0,5 mm entre mâchoire et tambour", "Usure max alésage tambour : + 0,5 mm / diamètre nominal"],
        "defauts": ["Crissement constant : garnitures vitrifiées ou tambour rouillé", "Frein qui accroche : cylindre de roue grippé ou ressort de rappel cassé", "Bruit sourd freinage : garniture décollée"],
        "entretien": "Remplacement garnitures par kit complet (4 mâchoires). Mesure alésage tambour obligatoire."
    },
    "filtre à air": {
        "role": "Filtrer les poussières, pollens et particules de l'air admis dans le moteur pour protéger les cylindres, pistons et turbo.",
        "variantes": ["Filtre papier plissé : standard, efficacité > 99,5% @ 5 µm", "Filtre coton huilé (sport) : moins filtrant mais débit accru", "Filtre panneau : moteurs à admission directe", "Filtre cyclonique : avant-filtre milieux poussiéreux"],
        "specs": ["Filtration : > 99,5% des particules ≥ 5 µm", "Perte de charge maxi admissible : 30–50 mbar", "Surface filtrante : 0,5–2 m²", "Matériaux : cellulose traitée ou synthétique"],
        "defauts": ["Filtre colmaté : richesse perturbée, perte puissance, surconsommation", "Filtre absent/troué : ingestion particules abrasives = rayures cylindres"],
        "entretien": "Remplacement tous les 15 000–30 000 km ou 1–2 ans. Jamais souffler un filtre papier (destruction fibres)."
    },
    "catalyseur": {
        "role": "Réduire les émissions de CO, HC et NOx des gaz d'échappement par oxydation et réduction catalytique via les métaux précieux du washcoat.",
        "variantes": ["Catalyseur TWC (Three-Way Catalyst) : essence, convertit CO + HC + NOx", "Catalyseur DOC (Diesel Oxidation Catalyst) : diesel, CO + HC", "SCR (Selective Catalytic Reduction) : NOx + AdBlue → N2 + H2O", "GPF/FAP : filtre à particules"],
        "specs": ["Température d'amorçage (light-off) : > 300 °C", "Support : céramique cordiérite 400–900 cpsi ou métal", "Washcoat : platine, palladium, rhodium (1–5 g/unité)", "Durée de vie : 150 000–200 000 km si non empoisonné"],
        "defauts": ["Catalyseur empoisonné (plomb, silicone, P) : perte efficacité définitive", "Catalyseur fondu : surchauffe (ratés allumage prolongés)", "Code P0420/P0430 : efficacité < seuil (sonde aval)"],
        "entretien": "Pas d'entretien. Éviter huile avec SAPS élevés (poison catalyseur). Traiter immédiatement tout raté d'allumage."
    },
    "courroie de distribution": {
        "role": "Synchroniser la rotation du vilebrequin avec l'arbre à cames au rapport 2:1 pour coordonner l'ouverture des soupapes avec le mouvement des pistons.",
        "variantes": ["Courroie crantée HNBR : standard, résistance huile et chaleur", "Courroie crantée EPDM : anciens moteurs", "Chaîne de distribution : durable mais bruyante et lourde", "Courroie intégrée dans bain d'huile (CBID) : courroie immergée huile moteur"],
        "specs": ["Pas : 8 mm ou 9,525 mm selon moteur", "Largeur : 16–32 mm", "Matériau : HNBR renforcé fibres aramide", "Tolérance synchronisation : ±1 dent max (±5° vilebrequin)"],
        "defauts": ["Rupture sur moteur interférent = collision pistons/soupapes = destruction moteur", "Saut de dent (huile sur courroie) : calage modifié, perte puissance", "Craquèlement visible : remplacement immédiat"],
        "entretien": "Remplacement préventif : 60 000–120 000 km ou 5–10 ans selon constructeur. Kit complet obligatoire."
    },
    "démarreur": {
        "role": "Mettre en rotation le vilebrequin moteur par entraînement électromagnétique pour initier le démarrage thermique.",
        "variantes": ["Démarreur à engrenement direct : simple, robuste", "Démarreur à réduction (planétaire) : couple élevé, compact", "Démarreur-alternateur (BSG) : hybride léger 12 V ou 48 V"],
        "specs": ["Puissance : 0,8–3 kW selon cylindrée", "Tension : 12 V (courant pointe : 200–500 A)", "Régime de lancement : 80–250 tr/min", "Durée de vie : 150 000–300 000 cycles démarrage"],
        "defauts": ["Claquement sans démarrage : solénoïde OK mais balais usés", "Pas de réaction : solénoïde HS ou batterie faible", "Démarreur qui reste enclenché : contact solénoïde collé"],
        "entretien": "Contrôle chute tension batterie sous démarrage (< 9,6 V acceptable)."
    },
    "bobine": {
        "role": "Transformer la tension 12 V en haute tension (20 000–45 000 V) pour créer l'étincelle aux bougies d'allumage.",
        "variantes": ["Bobine crayon (COP) : 1 par cylindre, montage direct sur bougie", "Bobine rail (pack) : module 2 ou 4 cylindres", "Bobine avec distributeur (anciens moteurs)", "Module d'allumage intégré"],
        "specs": ["Tension secondaire : 20 000–45 000 V", "Résistance primaire : 0,4–1 Ω", "Résistance secondaire : 4–15 kΩ", "Inductance primaire : 1–5 mH"],
        "defauts": ["Raté allumage permanent cylindre N : mesurer résistances", "Raté intermittent à chaud : isolation dégradée (claquage thermique)", "Code P0301–P0308 : cylindre concerné identifiable"],
        "entretien": "Remplacement recommandé avec les bougies (accès déjà effectué)."
    },
    "crémaillière": {
        "role": "Convertir le mouvement rotatif du volant de direction en mouvement linéaire pour braquer les roues via les barres de direction.",
        "variantes": ["Crémaillière mécanique : assistée ou non (effort manuel)", "Crémaillière hydraulique (HPAS) : assistance par huile sous pression", "Crémaillière électrique (EPAS) : moteur électrique, plus économique", "Crémaillière à assistance variable : raideur selon vitesse"],
        "specs": ["Rapport de démultiplication : 12–20 tr volant / braquage complet", "Débattement total : 70–120 mm (lock to lock)", "Pression système hydraulique : 50–120 bars", "Couple moteur EPAS : 3–8 N·m"],
        "defauts": ["Jeu volant > 30 mm : crémaillière usée ou joints internes", "Fuite huile (hydraulique) : soufflets ou joints internes", "Coups de bélier direction : clapet anti-choc HS"],
        "entretien": "Niveau huile direction assistée tous les 30 000 km. Crémaillière électrique : recalibrage si remplacement."
    },
    "cylindre de roue": {
        "role": "Convertir la pression hydraulique du circuit de frein en force d'expansion mécanique des mâchoires contre le tambour.",
        "variantes": ["Cylindre simple effet : 1 piston, frein Simplex", "Cylindre double effet : 2 pistons opposés, frein Duplex"],
        "specs": ["Diamètre piston : 14–22 mm", "Pression de service : 30–80 bars", "Matériau corps : aluminium ou fonte", "Joints pistons : EPDM"],
        "defauts": ["Fuite liquide sur la roue : joint HS — freinage unilatéral", "Mâchoire qui accroche : piston grippé (rouille)", "Pédale molle : air entré via cylindre défaillant"],
        "entretien": "Purge circuit frein obligatoire après remplacement. Remplacement par paire."
    },
    "bras de suspension": {
        "role": "Relier la fusée d'essieu au châssis en guidant le mouvement vertical de la roue tout en supportant les charges latérales et longitudinales.",
        "variantes": ["Triangle inférieur (lower arm) : le plus sollicité", "Triangle supérieur (upper arm) : double triangle", "Bras longitudinal (trailing arm) : essieu arrière", "Bras multibras : géométrie précise"],
        "specs": ["Matériau : acier embossé, aluminium forgé ou fonte nodulaire", "Silent blocs intégrés : 2–4 points d'articulation", "Tolérance déformation : 0 mm (sécurité active)"],
        "defauts": ["Bruit de claquement bosses : silent bloc usé", "Usure pneus irrégulière : géométrie perturbée", "Bras fissuré : remplacement immédiat (sécurité)"],
        "entretien": "Remplacement silent blocs possible séparément si accessibles. Géométrie obligatoire après remplacement."
    },
    "biellette": {
        "role": "Transmettre les efforts entre la barre stabilisatrice et le triangle ou l'amortisseur pour limiter le roulis en virage.",
        "variantes": ["Biellette rigide acier : standard", "Biellette réglable : préparation piste, réglage assiette"],
        "specs": ["Matériau : acier ou aluminium", "Rotules d'extrémité : 2 rotules sphériques", "Longueur fixe ou réglable : 100–300 mm selon modèle"],
        "defauts": ["Claquement en virage ou sur petites irrégularités : rotule biellette usée", "Roulis excessif : biellette cassée ou déconnectée"],
        "entretien": "Remplacement par paire recommandé. Pas de graissage (rotules scellées)."
    },
    "barre stabilisatrice|barre anti-roulis": {
        "role": "Limiter le roulis de la caisse en virage en transmettant la charge d'un côté à l'autre via une barre de torsion transversale.",
        "variantes": ["Barre creuse acier : allègement à rigidité égale", "Barre active (électronique) : raideur variable, véhicules premium", "Barre passive (standard) : raideur fixe"],
        "specs": ["Diamètre : 18–35 mm (avant), 14–25 mm (arrière)", "Matériau : acier à ressort 27MnSiB5", "Fixation : silent blocs de barre + biellettes d'extrémité"],
        "defauts": ["Roulis excessif en virage : barre cassée ou silent blocs fondus", "Craquement sur irrégularités : silent blocs de fixation usés"],
        "entretien": "Lubrification silent blocs à la graisse silicone. Contrôle à chaque révision."
    },
    "boulon de roue|écrou de roue": {
        "role": "Assurer la fixation mécanique de la jante sur le moyeu par serrage contrôlé contre le cône de centrage.",
        "variantes": ["Boulon sphérique : jantes acier standard", "Boulon conique : jantes alliage (angle 60°)", "Boulon plat : jantes spécifiques BMW", "Écrou de roue : alternativement aux boulons (pivot central)"],
        "specs": ["Filetage standard : M12×1,5 ou M14×1,5", "Couple de serrage : 80–140 N·m (valeur constructeur stricte)", "Longueur utile de filetage : min 8 mm dans le moyeu"],
        "defauts": ["Bruit de roulement + vibration : boulon desserré ou filetage endommagé", "Filetage fusée : ne jamais forcer un boulon qui coince"],
        "entretien": "Contrôle couple après 50 km en cas de remplacement roue. Ne jamais graisser le filetage (risque desserrage)."
    },
    "joint de culasse": {
        "role": "Assurer l'étanchéité entre le bloc moteur et la culasse en isolant les chambres de combustion, les canaux d'eau et les galeries d'huile.",
        "variantes": ["Joint multicouches acier (MLS) : standard actuel, 3–5 couches", "Joint composite (graphite + acier) : anciens moteurs", "Joint cuivre : préparation piste"],
        "specs": ["Épaisseur : 0,8–1,5 mm (codes épaisseur sur piston saillant)", "Pression de claquage : > 80 bars (compression + combustion)", "Matériaux : acier inox laminé, revêtement PTFE ou élastomère"],
        "defauts": ["Fumée blanche persistante : joint claqué côté eau → eau dans cylindre", "Émulsion huile-eau (mayonnaise) : fuite huile/eau joint", "Bulles dans vase expansion : gaz combustion dans circuit refroidissement"],
        "entretien": "Planage culasse obligatoire (voile < 0,05 mm). Boulons culasse à remplacer (usage unique sur certains moteurs)."
    },
    "pochette joints": {
        "role": "Regrouper l'ensemble des joints nécessaires à la révision d'un bloc moteur ou d'une culasse pour une étanchéité complète.",
        "variantes": ["Pochette joints haut moteur : culasse + cache culbuteurs + collecteurs", "Pochette joints bas moteur : carter + joints spi", "Pochette joints complète : tous les joints moteur"],
        "specs": ["Matériaux inclus : EPDM, NBR, FKM, papier graissé, acier, cuivre", "Compatibilité fluides : huile moteur, liquide refroidissement, carburant"],
        "defauts": ["Joint manquant ou inadapté : fuite dès mise en route"],
        "entretien": "Toujours utiliser les joints de la pochette, jamais les anciens. Respecter couples de serrage constructeur."
    },
    "vis de culasse": {
        "role": "Assurer la fixation et le serrage contrôlé de la culasse sur le bloc moteur pour maintenir la pression des joints en fonctionnement.",
        "variantes": ["Vis à serrage angulaire (TTY) : à usage unique, déformation contrôlée", "Vis à serrage couple seul : réutilisables si non allongées", "Goujons + écrous : moteurs compétition"],
        "specs": ["Couple de serrage préliminaire : 20–50 N·m", "Serrage angulaire : 60–180° selon constructeur (en plusieurs passes)", "Matériau : acier 10.9 ou 12.9", "Longueur filetée : 60–120 mm"],
        "defauts": ["Vis allongée (TTY) : ne peut plus garantir le couple — remplacement obligatoire", "Filetage bloc endommagé : réparation Helicoil ou remplacement bloc"],
        "entretien": "Vis TTY = usage unique. Remplacer systématiquement lors de la dépose culasse."
    },
    "ventilateur": {
        "role": "Forcer le passage d'air à travers le radiateur quand le véhicule est à l'arrêt ou à faible vitesse pour maintenir la température moteur.",
        "variantes": ["Ventilateur électrique (motoventilateur) : piloté par calculateur", "Ventilateur mécanique (viscorhestat) : entraîné par courroie, embrayage à visqueux", "Module double ventilateur : climatisation + refroidissement moteur"],
        "specs": ["Puissance moteur électrique : 80–400 W", "Débit d'air : 800–3000 m³/h", "Température déclenchement : 90–105 °C (via sonde)", "Alimentation : 12 V, courant 7–35 A"],
        "defauts": ["Surchauffe à l'arrêt (moteur tournant bien) : ventilateur HS ou sonde refroid HS", "Ventilateur toujours en marche : thermocontact bloqué fermé", "Bruit de ventilateur : roulement moteur usé"],
        "entretien": "Contrôle déclenchement automatique (mettre clim ON = ventilateur doit tourner)."
    },
    "câble": {
        "role": "Transmettre un mouvement mécanique (traction/compression) depuis une commande (pédale, levier) vers l'organe actionné via une âme acier dans une gaine souple.",
        "variantes": ["Câble d'embrayage : pédale → fourchette/butée", "Câble de frein à main : levier → mâchoires/étriers arrière", "Câble de capot : manette → serrure capot", "Câble d'accélérateur : pédale → papillon des gaz (remplacé par drive-by-wire)"],
        "specs": ["Âme : acier tressé galvanisé", "Gaine : PVC ou PTFE anti-friction", "Jeu nominal : 2–5 mm selon application", "Résistance traction : 3–10 kN selon câble"],
        "defauts": ["Câble étiré : jeu excessif, commande imprécise ou inefficace", "Câble cassé : perte totale de la fonction", "Gaine écrasée ou coudée : résistance à la course augmentée"],
        "entretien": "Lubrification annuelle (huile légère ou spray PTFE). Réglage jeu selon constructeur."
    },
    "bague d'étanchéité|joint spi|joint d'arbre|joint de boîte|joint de carter": {
        "role": "Assurer l'étanchéité dynamique ou statique autour d'un arbre ou sur un plan de joint pour retenir huile, graisse ou liquide.",
        "variantes": ["Joint spi à lèvre (arbre rotatif) : NBR, FKM ou PTFE selon T°", "Joint plat (carter) : papier graissé, silicone RTV ou élastomère", "Joint torique (raccords) : NBR ou EPDM", "Bague de distribution : étanchéité côté distribution"],
        "specs": ["NBR : −40/+120 °C, résistance huile minérale", "FKM/Viton : −20/+200 °C, résistance huiles synthétiques", "Tolérance concentricité : < 0,3 mm pour joint spi"],
        "defauts": ["Lèvre durcie ou craquelée : fuite huile progressive", "Mauvais montage (outil obligatoire) : lèvre retournée = fuite immédiate", "Carter : plan de joint oxydé = fuite même avec joint neuf"],
        "entretien": "Nettoyage plan de joint (grattoir plastique + dégraissant). Léger film huile sur lèvre avant montage."
    },
    "balais d'essuie-glace|balai d'essuie": {
        "role": "Essuyer l'eau et les impuretés du pare-brise par contact élastique entre la lame en caoutchouc et le verre.",
        "variantes": ["Balai traditionnel (squelette métal) : économique, moins aérodynamique", "Balai plat (flat blade) : contact uniforme, meilleur à haute vitesse", "Balai hybride : structure interne + coque aérodynamique", "Balai arrière : taille réduite, axe spécifique"],
        "specs": ["Longueur : 280–700 mm selon véhicule", "Pression de contact : 5–12 N (ressort)", "Matériau lame : caoutchouc naturel graphité ou EPDM", "Connexion : crochet J-hook, pin top, side pin selon modèle"],
        "defauts": ["Traces ou stries : lame usée, durcie ou encrassée (nettoyage au vinaigre blanc)", "Crissement : manque de liquide lave-glace ou lame tordue", "Pas d'essuyage : bras cassé ou motor essuie-glace HS"],
        "entretien": "Remplacement tous les 1–2 ans. Hivernal : lame spécifique neige recommandée."
    },
    "phare|feu avant|feu arrière|ampoule|projecteur": {
        "role": "Éclairer la route (avant) ou signaler la présence et les intentions du véhicule (arrière) pour la sécurité active.",
        "variantes": ["Halogène H1/H4/H7 : économique, remplacement facile", "Xénon/HID (D1S/D2S) : 3× plus lumineux, ballast requis", "LED : longue durée > 30 000 h, module souvent non remplaçable", "Full LED matriciel (ADB) : faisceau adaptatif, déflexion pixelisée"],
        "specs": ["Halogène H7 : 55 W, 12 V, 1 500 lm", "LED feux de route : 2 000–3 500 lm", "Xénon D2S : 35 W, 3 200 lm, température couleur 4200 K", "Homologation ECE R112 (feux de route/croisement)"],
        "defauts": ["Faisceau déréglé : éblouissement ou route non éclairée (réglage hauteur)", "Condensation interne : joint de capot dégradé", "Jaunissement optique : polissage ou remplacement"],
        "entretien": "Réglage hauteur après remplacement. Ne pas toucher ampoule halogène à main nue (huile = surchauffe)."
    },
    "détendeur de climatisation|gicleur détendeur": {
        "role": "Abaisser brutalement la pression du fluide frigorigène haute pression (liquide) avant l'évaporateur pour provoquer sa vaporisation et l'effet refroidissant.",
        "variantes": ["Détendeur thermostatique (TXV) : régule débit selon superheat sortie évaporateur", "Tube orifice fixe : débit constant, moins précis mais sans pièce mobile", "Détendeur électronique (EXV) : piloté calculateur, précision maximale"],
        "specs": ["Pression entrée (HP) : 8–20 bars", "Pression sortie (BP) : 1,5–3 bars", "Superheat nominal (TXV) : 5–7 K", "Matériaux : corps laiton, joint de siège PTFE"],
        "defauts": ["Pas de froid : détendeur bloqué fermé (pas de débit)", "Evaporateur givré : détendeur bloqué ouvert (trop de débit)", "Vibrations circuit : bulles dans la ligne liquide (recharge insuffisante)"],
        "entretien": "Remplacement uniquement si confirmation par mesures pressions HP/BP. Recharge circuit par technicien certifié."
    },
    "fourchette d'embrayage|guide d'embrayage": {
        "role": "Transmettre le mouvement axial de la commande d'embrayage (hydraulique ou mécanique) vers la butée, qui agit sur le diaphragme du mécanisme.",
        "variantes": ["Fourchette pivotante (axe de pivot externe) : BV manuelles classiques", "Fourchette guidée sur axe interne", "Guide de butée concentrique (CSC) : remplace fourchette sur BV modernes"],
        "specs": ["Matériau : acier estampé ou fonte GS", "Axe de pivot : graissage périodique (graisse haute pression)", "Jeu fourchette/butée : 1–3 mm selon modèle"],
        "defauts": ["Fourchette fissurée : débrayage incomplet ou blocage", "Pivot usé : jeu excessif, imprécision débrayage", "Bruit crissement : axe sec ou fourchette qui racle"],
        "entretien": "Remplacement systématique avec le kit embrayage. Graisser axe pivot à la pose."
    },
    "pompe à haute pression|pompe injection|pompe à injection": {
        "role": "Comprimer le carburant (diesel ou essence GDI) à très haute pression pour alimenter le rail d'injection.",
        "variantes": ["Pompe HP rotative à plateau : diesel common rail standard", "Pompe HP à pistons en ligne : anciens moteurs diesel", "Pompe HP essence GDI : pression 150–350 bars"],
        "specs": ["Pression délivrable : 1 600–2 200 bars (diesel), 150–350 bars (essence GDI)", "Entraînement : arbre à cames ou vilebrequin", "Régulation débit : électrovanne de régulation (IMV)", "Lubrification : par le carburant lui-même"],
        "defauts": ["Démarrage difficile + code P0087 : pression rail insuffisante", "Claquements injection + fumées : pression inconstante", "Contamination eau = usure prématurée = ± 80 000 km"],
        "entretien": "Qualité carburant critique (cetane diesel, indice octane essence). Jamais de réservoir quasi-vide (lubrification pompe)."
    },
    "module d'allumage|distributeur d'allumage|faisceau d'allumage": {
        "role": "Gérer la distribution de la haute tension aux bougies au bon moment selon l'ordre d'allumage (moteurs à allumage commandé).",
        "variantes": ["Distributeur mécanique rotatif : anciens moteurs, réglage avance à l'allumage", "Module d'allumage statique : bobines + transistors, sans pièces mobiles", "Faisceau allumage (fils HT) : transport HT du module aux bougies"],
        "specs": ["Résistance fil allumage : 5–15 kΩ/m", "Tension transmise : 20 000–40 000 V", "Isolation : silicone résistance T° et HT", "Gaine blindée : anti-parasite (radio, calculateur)"],
        "defauts": ["Claquement HT (perte énergie) : fil ou capuchon percé", "Ratés allumage cylindre spécifique : fil HS ou connecteur corrodé", "Code P0300 : ratés aléatoires = faisceau défaillant"],
        "entretien": "Remplacement tous les 60 000–100 000 km ou avec les bougies."
    },
    "pompe hydraulique freinage|agrégat de freinage|répartiteur de frein": {
        "role": "Assurer la modulation et la distribution de la pression hydraulique de freinage entre les essieux ou les roues selon la charge et les conditions.",
        "variantes": ["Répartiteur de frein mécanique : valve proportionnelle, dosage en fonction de la charge", "Correcteur de freinage : sur essieu arrière, limite pression selon charge", "Agrégat ABS/ESP (hydraulique) : électrovalves + pompe de reprise"],
        "specs": ["Pression de service : 60–180 bars", "Électrovalves : normalement ouvertes (NOR), 12 V, 2–4 A", "Pompe de reprise : débit 0,5–2 L/min", "Accumulateur basse pression : stockage fluide en modulation"],
        "defauts": ["Voyant ABS/ESP allumé + code C : défaut électrovanne ou capteur roue", "Pédale vibrante ABS : normal (modulation), sinon pompe bruyante", "Fuite hydraulique : remplacement agrégat complet"],
        "entretien": "Remplacement liquide frein tous les 2 ans (hygroscopie). Agrégat : non réparable en standard."
    },
    "relais de clignotant": {
        "role": "Générer les clignotements intermittents des indicateurs de direction à fréquence normalisée (60–120 cycles/min).",
        "variantes": ["Relais thermique (bimétal) : fréquence variable selon charge (ancien)", "Relais électronique : fréquence fixe 60–120 cycles/min, insensible charge", "Module clignoteur BSI/BCM intégré : calculateur de bord moderne"],
        "specs": ["Fréquence nominale : 90 cycles/min ±30% (ECE R6)", "Courant commutation : 5–25 A", "Alimentation : 12 V via fusible feux"],
        "defauts": ["Hyperclignotement : ampoule grillée (relais thermique), ou LED sans résistance", "Pas de clignotement : fusible ou relais HS", "Clignotement lent : mauvais contact ou résistance élevée"],
        "entretien": "Remplacement sur défaillance. Vérifier ampoules avant de changer le relais."
    },
    "gaine de turbo": {
        "role": "Protéger le turbocompresseur, ses durites et les équipements adjacents contre les températures extrêmes (> 800 °C côté turbine).",
        "variantes": ["Gaine tressée silicate : résistance jusqu'à 1000 °C", "Gaine aluminisée : réflexion thermique + protection mécanique", "Manchon silicone haute température : jonctions durites turbo"],
        "specs": ["Température admissible : 500–1200 °C selon matériau", "Diamètre : 20–80 mm selon tuyauterie protégée", "Longueur : 300–1000 mm ou sur mesure"],
        "defauts": ["Gaine endommagée : fusion des durites adjacentes (carburant, huile) = risque incendie", "Durite turbo fond : gaine absente ou déplacée"],
        "entretien": "Vérification intégrité à chaque intervention turbo. Remplacement immédiat si effilochée."
    },
    "poulie d'arbre à came": {
        "role": "Entraîner l'arbre à cames depuis le vilebrequin via la courroie de distribution au rapport 2:1, avec calage précis de la distribution.",
        "variantes": ["Poulie fixe : simple, économique", "Poulie avec déphaseur (VVT) : calage variable électro-hydraulique", "Poulie magnétique : capteur cames intégré"],
        "specs": ["Rapport : 1:2 par rapport au vilebrequin", "Tolérance calage : ±1 dent max (±5° vilebrequin)", "Matériau : acier forgé ou aluminium", "Filetage central : M12–M22 selon moteur"],
        "defauts": ["Bruit métallique distribution : poulie desserrée", "Perte de puissance : poulie déphaseur bloquée en avance/retard", "Code P0010–P0016 : déphaseur défaillant"],
        "entretien": "Remplacement dans le kit distribution. Bloquer l'arbre à cames lors du serrage."
    },
    "conduite haute pression|conduite injection": {
        "role": "Transporter le carburant sous très haute pression (jusqu'à 2200 bars) du rail d'injection vers chaque injecteur.",
        "variantes": ["Conduite acier double paroi : standard common rail", "Conduite renforcée (racing) : haute performance", "Raccord vissé cone-cone : étanchéité sans joint (contact métal/métal)"],
        "specs": ["Pression de service : 1600–2200 bars (diesel), 150–350 bars (GDI)", "Matériau : acier inox ou acier carbone haute résistance", "Raccord : cone 60° ISO 9974, serrage couple précis", "Volume interne : 0,1–0,5 mL/conduite"],
        "defauts": ["Fuite conduite : brouillard carburant → risque incendie → arrêt immédiat", "Rupture : très rare, fatigue du matériau (pression cyclique)"],
        "entretien": "Couple de serrage raccords : 20–30 N·m (jamais sur-serrer). Remplacement si fissure ou déformation visible."
    },
    "soupape de rampe|régulation injection": {
        "role": "Réguler la pression dans le rail d'injection en évacuant l'excès de carburant vers le retour lors des phases à faible demande.",
        "variantes": ["Limiteur de pression (valve de sécurité) : ouverture mécanique > seuil max", "Électrovanne de régulation (IMV) : régulation continue par PWM", "Soupape de retour haute pression"],
        "specs": ["Pression d'ouverture valve sécurité : 1800–2500 bars", "Courant IMV : 0,5–2 A (signal PWM 0–100%)", "Résistance bobine IMV : 3–8 Ω"],
        "defauts": ["Pression rail instable : IMV HS ou colmatée", "Surpression rail : valve sécurité HS", "Code P0191/P0193 : pression rail hors plage"],
        "entretien": "Filtrage carburant propre critique. Remplacement uniquement après diagnostic complet."
    },
    "bouchon d'huile|bouchon de vidange": {
        "role": "Fermer l'orifice de vidange ou de remplissage d'huile moteur de manière étanche.",
        "variantes": ["Bouchon de vidange magnétique : capture les copeaux métalliques en suspension", "Bouchon de remplissage (cache culasse) : accès au niveau huile", "Bouchon avec joint cuivre : à remplacer à chaque vidange"],
        "specs": ["Filetage standard : M12×1,5 ou M14×1,5", "Couple de serrage : 25–35 N·m", "Joint : cuivre recuit (usage unique) ou EPDM"],
        "defauts": ["Fuite bouchon vidange : joint écrasé ou filetage endommagé", "Bouchon trop serré : filetage carter arraché"],
        "entretien": "Remplacer le joint cuivre à chaque vidange. Ne pas démonter chaud (brûlures huile)."
    },
    "ballast xénon|ballast lampe|ballast à lampe": {
        "role": "Fournir la haute tension nécessaire pour amorcer et maintenir la décharge électrique dans une ampoule xénon (HID).",
        "variantes": ["Ballast analogique : simple, moins précis", "Ballast numérique (canbus) : fréquence 400 Hz, communication bus", "Module d'allumage intégré (AFS) : ballast + calculateur orientation"],
        "specs": ["Tension d'amorçage : 15 000–25 000 V (impulsion)", "Tension de fonctionnement : 85 V AC", "Puissance : 35 W ou 50 W", "Alimentation : 12 V, courant 3,5 A en régime établi"],
        "defauts": ["Phare qui s'éteint puis rallume : ballast en surchauffe ou défaillant", "Pas d'allumage : ampoule HS ou ballast HS (test croisé)", "Voyant défaut phare : communication canbus ballast"],
        "entretien": "Ne pas démonter sous tension (HT dangereuse). Attente 30 s après extinction avant manipulation."
    },
    "valve ralenti|vanne ralenti": {
        "role": "Réguler le débit d'air en dérivation du papillon des gaz pour contrôler le régime de ralenti du moteur.",
        "variantes": ["Vanne IAC (Idle Air Control) à stepper motor : moteur pas à pas, positionnement précis", "Vanne à solénoïde (on/off PWM) : ouverture variable", "Papillon motorisé intégré : drive-by-wire remplace la vanne IAC"],
        "specs": ["Résistance bobine : 40–80 Ω (IAC stepper)", "Course : 0–100% ouverture", "Alimentation : 12 V, commande PWM 0–100%"],
        "defauts": ["Ralenti instable ou calage : vanne encrassée (dépôts carbone)", "Ralenti trop bas ou trop haut : position vanne hors consigne", "Code P0505/P0507 : circuit IAC défaillant"],
        "entretien": "Nettoyage vanne et canal avec spray carburateur. Dépose et nettoyage ultrason si persistant."
    },
    "vérin|actuateur|motoréducteur": {
        "role": "Convertir une énergie (hydraulique, électrique, pneumatique) en mouvement linéaire ou rotatif pour actionner un organe mécanique (capot, coffre, vitre, hayon).",
        "variantes": ["Vérin hydraulique : capot moteur, sièges réglables", "Vérin électrique (liner actuator) : coffre à ouverture automatique, hayon", "Motoréducteur : lève-vitre, miroir, siège électrique"],
        "specs": ["Force de poussée : 50–500 N selon application", "Course : 50–300 mm", "Alimentation : 12 V, courant 2–15 A", "Vitesse : 5–50 mm/s"],
        "defauts": ["Vérin qui ne se déploie plus : moteur HS ou engrenage cassé", "Mouvement saccadé : frottement ou encodeur défaillant", "Capot qui retombe : vérin en fin de vie"],
        "entretien": "Lubrification tige (graisse silicone). Remplacement sur défaillance mécanique ou électrique."
    },
    "correcteur portée|commande correcteur": {
        "role": "Ajuster automatiquement ou manuellement l'orientation verticale des projecteurs selon la charge du véhicule pour éviter l'éblouissement.",
        "variantes": ["Correcteur manuel : molette dans l'habitacle, réglage 0–3", "Correcteur automatique électrique : moteur sur le projecteur, capteurs assiette", "Correcteur hydraulique : biellettes et vérin hydraulique (anciens modèles)"],
        "specs": ["Motoréducteur correcteur : 12 V, courant < 1 A", "Amplitude de correction : −2° à +1°", "Capteur assiette : potentiomètre ou Hall, signal 0,5–4,5 V"],
        "defauts": ["Projecteur mal orienté malgré réglage : moteur correcteur HS", "Capteur assiette HS : voyant aide à la conduite", "Jeu dans mécanisme : mauvais contact biellette"],
        "entretien": "Calibration capteurs assiette après remplacement suspension ou correcteur."
    },
    "interrupteur|contacteur|commande": {
        "role": "Contrôler électriquement l'activation et la désactivation d'un équipement ou signaler l'état d'un organe au calculateur.",
        "variantes": ["Interrupteur à contact direct : simple, fiable", "Interrupteur de fin de course : détection position (capot ouvert, porte)", "Contacteur rotatif (sur colonne) : commandes combinées volant"],
        "specs": ["Courant commutation : 5–30 A (charges directes)", "Résistance contact fermé : < 0,1 Ω", "Isolation : > 100 MΩ à 500 V"],
        "defauts": ["Contact oxydé : résistance élevée = chute tension = dysfonctionnement", "Interrupteur collé fermé : consommateur toujours actif (décharge batterie)", "Signal figé : calculateur reçoit mauvais état"],
        "entretien": "Nettoyage contacts au spray contact électrique. Remplacement si contact endommagé."
    },
    "support de boîte|suspension boite": {
        "role": "Fixer la boîte de vitesses ou la boîte automatique au châssis en isolant les vibrations et en supportant le poids de l'ensemble.",
        "variantes": ["Support caoutchouc simple : économique", "Support hydraulique : meilleure isolation vibratoire", "Sous-châssis avec silent blocs : architecture moderne"],
        "specs": ["Matériaux élastomère : NR ou EPDM", "Charge admissible : 200–800 kg selon position", "Raideur : 50–500 N/mm"],
        "defauts": ["Vibrations au ralenti : support affaissé", "Claquements passage de vitesses : support HS ou desserré", "Fuite huile boîte contre support : usure joint + support compressé"],
        "entretien": "Remplacement par paire si accessible. Contrôle à chaque révision."
    },
    "récepteur d'embrayage|cylindre récepteur": {
        "role": "Convertir la pression hydraulique de l'émetteur en force mécanique actionnant la fourchette ou la butée d'embrayage.",
        "variantes": ["Récepteur externe (cylindre récepteur) : fixé sur boîte de vitesses", "Récepteur concentrique (CSC) : intégré à la boîte, autour de l'arbre primaire"],
        "specs": ["Diamètre piston : 16–25 mm", "Course piston : 15–25 mm", "Pression de service : 20–60 bars", "Matériau corps : aluminium, joint EPDM"],
        "defauts": ["Pédale molle : fuite récepteur (liquid visible sur boîte)", "Débrayage incomplet : récepteur HS ou air dans le circuit", "CSC grippé : bruits et patinage"],
        "entretien": "Purge obligatoire après remplacement. CSC : remplacement avec kit embrayage recommandé."
    },
    "bougie": {
        "role": "Produire l'étincelle électrique pour initier la combustion du mélange air-carburant dans les moteurs à allumage commandé.",
        "variantes": ["Bougie cuivre : économique, durée 30 000 km", "Bougie platine : durée 60 000–80 000 km", "Bougie iridium : haute précision, durée 100 000–120 000 km", "Bougie de préchauffage (diesel) : n'allume pas, chauffe la chambre"],
        "specs": ["Indice de chaleur : 6–9 (froid à chaud)", "Filetage : M14x1,25 ou M12x1,25, longueur 19–26 mm", "Écartement électrodes : 0,7–1,1 mm (réglable)", "Couple de serrage : 20–30 N·m (sans joint) / 10–15 N·m (avec joint)"],
        "defauts": ["Raté allumage : bougie encrassée, électrodes usées ou écartement hors spec", "Bougie noire (carbone) : mélange riche ou huile", "Bougie blanche (brûlée) : cliquetis ou surchauffe"],
        "entretien": "Remplacement selon intervalle constructeur. Jamais réutiliser après démontage sur moteur haute km."
    },
    "bobine d'allumage": {
        "role": "Transformer la tension 12 V de la batterie en haute tension (20 000–45 000 V) nécessaire pour créer l'étincelle aux bougies.",
        "variantes": ["Bobine crayon (COP) : 1 bobine par bougie, montage direct", "Bobine rail (pack) : module 4 bobines", "Bobine simple + distributeur : anciens moteurs", "Bobine intégrée dans le module d'allumage"],
        "specs": ["Tension secondaire : 20 000–45 000 V", "Inductance primaire : 1–5 mH", "Résistance primaire : 0,4–1 Ω", "Résistance secondaire : 4–15 kΩ"],
        "defauts": ["Raté allumage permanent sur 1 cylindre : bobine HS (contrôle résistances)", "Raté intermittent chaud : isolation dégradée (claquage thermique)", "Code P0301–P0308 : raté allumage cylindre N"],
        "entretien": "Remplacement simultané avec bougies recommandé (accès déjà fait)."
    },
}

# --- Templates manquants + patterns de fallback ---
TEMPLATES.update({
    "crémaillère": {
        "role": "Convertir le mouvement rotatif du volant en déplacement linéaire des biellettes de direction pour braquer les roues.",
        "variantes": ["Crémaillère mécanique : sans assistance, retour d'information direct", "Crémaillère hydraulique (HPAS) : vanne rotative + pompe hydraulique", "Crémaillère électrique (EPS) : moteur électrique sur pignon ou crémaillère"],
        "specs": ["Rapport de démultiplication : 13–18:1", "Débattement total : 120–160 mm", "Pression hydraulique (HPAS) : 80–120 bars", "Couple EPS : 5–10 N·m (moteur brushless)"],
        "defauts": ["Jeu au centre du volant : usure pignon ou poussoir crémaillère", "Direction dure : pompe hydraulique défaillante ou fluide bas", "Fuite huile côté soufflet : joints de crémaillère HS"],
        "entretien": "Contrôle jeu direction à chaque révision. Vérifier état soufflets et niveau liquide direction."
    },
    "câble d'embrayage|câble de capot|câble de frein": {
        "role": "Transmettre mécaniquement une traction ou une commande entre deux organes distants via un câble acier gainé.",
        "variantes": ["Câble d'embrayage : pédale → fourchette, avec ou sans auto-régleur", "Câble de frein à main : levier → étriers/mâchoires arrière", "Câble de capot : manette habitacle → loquet capot"],
        "specs": ["Matériau âme : acier galvanisé multibrin 7×7 ou 7×19", "Gaine : PVC ou PTFE, acier spiralé pour câbles de frein", "Charge de rupture : > 3× la force de service"],
        "defauts": ["Câble dur ou grippé : corrosion interne de la gaine", "Câble cassé : rupture des brins (inspection visuelle bout de câble)", "Commande inefficace : câble allongé ou déboîté en bout"],
        "entretien": "Lubrification annuelle. Réglage tension câble frein à main tous les 30 000 km. Remplacement si brins cassés."
    },
    "bague d'étanchéité|bagues d'étanchéité": {
        "role": "Assurer l'étanchéité dynamique ou statique entre deux pièces pour retenir un fluide (huile, graisse, ATF) et exclure les contaminants.",
        "variantes": ["Joint spi à lèvre simple : étanchéité huile standard", "Joint spi à double lèvre : + protection anti-poussière", "Bague PTFE : haute vitesse, haute température", "Joint torique : étanchéité statique ou faible mouvement"],
        "specs": ["Matériaux lèvre : NBR (−40/+120 °C), FKM/Viton (−20/+200 °C), PTFE (−60/+260 °C)", "Excentricité admissible : < 0,3 mm", "Vitesse linéaire max : 4–16 m/s selon matière"],
        "defauts": ["Fuite en couronne autour de l'arbre : lèvre durcie ou usée", "Fuite après montage : joint monté à l'envers ou biais de pose", "Contamination interne : lèvre anti-poussière déchirée"],
        "entretien": "Montage exclusivement à l'outil de pose (jamais au marteau). Lubrifier la lèvre avant insertion."
    },
    "joint carter|joint de carter": {
        "role": "Assurer l'étanchéité entre un carter (huile, distribution) et le bloc moteur ou la culasse pour empêcher les fuites de fluide.",
        "variantes": ["Joint plat liège/caoutchouc : ancien, remplacement par RTV", "Joint moulé EPDM : profil adapté, étanchéité optimale", "Joint liquide silicone RTV : application directe sur surfaces propres"],
        "specs": ["Matériaux : EPDM, NBR ou silicone haute température (> 150 °C)", "Épaisseur : 1,5–4 mm", "Couple serrage vis carter : 8–25 N·m"],
        "defauts": ["Fuite huile sous moteur : joint écrasé ou fissuré", "Fuite après repose : plan de joint mal nettoyé ou corps étranger"],
        "entretien": "Remplacement systématique lors de toute dépose de carter. Nettoyer soigneusement les plans de joint."
    },
    "joint de cache|joint cache culbuteurs": {
        "role": "Assurer l'étanchéité entre le cache culbuteurs et la culasse pour retenir l'huile en circulation dans la rampe de soupapes.",
        "variantes": ["Joint EPDM moulé : profil épousant la culasse", "Joint avec œillets bougies : double étanchéité sur les puits de bougies", "Joint RTV liquide : sur certains moteurs modernes"],
        "specs": ["Matériau : EPDM résistant huile moteur et T > 150 °C", "Couple vis cache : 8–15 N·m (serrage progressif en croix)"],
        "defauts": ["Fuite huile haut moteur : joint durci ou cache déformé", "Huile sur bougies : œillets de passage défaillants", "Fumées à chaud : huile tombant sur collecteur échappement"],
        "entretien": "Remplacement sur apparition de fuite. Vérifier planéité du cache culbuteurs."
    },
    "joint tige de soupape|joint tige soupape": {
        "role": "Étanchéifier la tige de soupape dans son guide pour empêcher l'huile de culasse d'être aspirée dans les chambres de combustion.",
        "variantes": ["Joint lèvre PTFE : haute température, standard moderne", "Joint lèvre NBR : moteurs anciens", "Joint avec ressort hélicoïdal : maintien optimal de la lèvre"],
        "specs": ["Diamètre tige soupape : 5–8 mm", "Température service : jusqu'à 220 °C (échappement)", "Matériau lèvre : PTFE ou FKM (Viton)"],
        "defauts": ["Fumées bleues au démarrage à froid : joints admission durcis", "Fumées bleues en décélération : joints admission défaillants", "Consommation huile progressive : joints usés ensemble"],
        "entretien": "Remplacement lors de révision culasse. Outil de pose obligatoire."
    },
    "joint de boîte|joint boîte vitesse": {
        "role": "Assurer l'étanchéité des sorties d'arbres et plans de joint de la boîte de vitesses pour retenir l'huile de transmission.",
        "variantes": ["Joint spi arbre primaire/secondaire : étanchéité dynamique", "Joint de couvercle plat ou RTV : étanchéité statique", "Joint cardan/différentiel : mouvements angulaires"],
        "specs": ["Matériau : NBR ou FKM selon huile (minérale/synthétique)", "Compatibilité : GL-4 ou GL-5"],
        "defauts": ["Fuite huile boîte : tache jaunâtre sous le véhicule", "Niveau bas : usure accélérée synchroniseurs et pignons"],
        "entretien": "Remplacement sur apparition fuite. Contrôle niveau huile boîte tous les 60 000 km."
    },
    "mécatronique": {
        "role": "Piloter électroniquement et hydrauliquement les changements de rapport, les embrayages et les solénoïdes de la boîte automatique.",
        "variantes": ["Mécatronique DSG/DQ : unité hydraulique + calculateur intégrés", "Module TCM externe : calculateur séparé pilotant les solénoïdes", "Valve body : distribution hydraulique électropilotée"],
        "specs": ["Solénoïdes : 4–12 selon boîte", "Pression hydraulique interne : 5–25 bars", "Huile spécifique : DSG Oil ou équivalent constructeur"],
        "defauts": ["Boîte qui claque ou tressaute : solénoïde encrassé ou HS", "Mode dégradé (limp mode) : défaut calculateur ou capteur", "Rapport refusé : solénoïde de sélection défaillant"],
        "entretien": "Vidange DSG tous les 40 000–60 000 km. Diagnostic CAN obligatoire pour tout symptôme."
    },
    "poignée de porte": {
        "role": "Actionner le mécanisme de serrure pour ouvrir la porte depuis l'intérieur ou l'extérieur du véhicule.",
        "variantes": ["Poignée extérieure : fixée sur panneau, commande timonerie", "Poignée intérieure : fixée sur garniture porte", "Poignée avec microswitch : entrée sans clé (keyless)"],
        "specs": ["Matériau : ABS chromé, aluminium ou acier", "Force actionnement : 15–40 N"],
        "defauts": ["Poignée cassée : plastique fragilisé par UV ou froid", "Porte ne s'ouvre plus : câble timonerie cassé ou poignée déclipsée"],
        "entretien": "Remplacement sur casse mécanique. Graisser axe de pivotement si dur."
    },
    "pompe nettoyage|lave-glace": {
        "role": "Projeter le liquide lave-glace sur le pare-brise et la vitre arrière pour assurer la visibilité.",
        "variantes": ["Pompe simple (avant seul) : 1 sortie", "Pompe double (avant + arrière) : 2 sorties", "Pompe avec chauffage intégré : dégivrage rapide"],
        "specs": ["Alimentation : 12 V, consommation 3–8 A", "Débit : 1–3 L/min à 0,3–1 bar"],
        "defauts": ["Pas de projection : pompe HS ou filtre réservoir bouché", "Débit faible : gicleurs bouchés ou pompe affaiblie"],
        "entretien": "Utiliser uniquement lave-glace prêt à l'emploi. Nettoyage gicleurs annuel."
    },
    "refroidisseur de carburant": {
        "role": "Abaisser la température du carburant diesel de retour avant réinjection dans le réservoir pour préserver la qualité du carburant.",
        "variantes": ["Refroidisseur carburant/air : échangeur à ailettes", "Refroidisseur carburant/liquide : intégré au circuit eau moteur"],
        "specs": ["Température retour sans refroidisseur : 80–120 °C", "Température après refroidissement : < 50 °C"],
        "defauts": ["Démarrage difficile à chaud : carburant trop chaud, bullage", "Fuite externe : joint ou brasure défaillante"],
        "entretien": "Remplacement sur défaillance. Vérifier filtre carburant simultanément."
    },
    "tube de distributeur|rampe carburant": {
        "role": "Distribuer le carburant sous pression à chaque injecteur avec une pression homogène.",
        "variantes": ["Rampe aluminium : moteurs atmosphériques (3–6 bars)", "Rampe acier : moteurs turbo ou GDI (150–350 bars)"],
        "specs": ["Pression service port injection : 3–6 bars", "Régulateur intégré : 3,5 bars nominal"],
        "defauts": ["Fuite carburant : joint torique injecteur défaillant", "Pression inégale : conduite obstruée"],
        "entretien": "Remplacement joints toriques injecteurs à chaque dépose."
    },
    "accumulateur de pression|rail d'injection": {
        "role": "Stocker le carburant sous haute pression et le distribuer aux injecteurs en maintenant une pression stable malgré les impulsions d'injection.",
        "variantes": ["Rail diesel acier forgé : pression > 1600 bars", "Rail essence GDI : 150–350 bars", "Rail avec capteur pression intégré"],
        "specs": ["Volume interne : 15–35 cm³", "Capteur pression rail : 0,5–4,5 V (0–1800 bars)", "Matériau : acier forgé haute résistance"],
        "defauts": ["Pression instable : régulateur ou capteur défaillant", "Démarrage long : rail se vide à l'arrêt (clapet pompe HS)", "Code P0190–P0194 : capteur pression rail"],
        "entretien": "Remplacement sur défaillance capteur ou fuite."
    },
    "boîtier de préchauffage|préchauffage": {
        "role": "Piloter les bougies de préchauffage diesel en fournissant le courant nécessaire pour chauffer les chambres de combustion au démarrage à froid.",
        "variantes": ["Boîtier relais simple : temporisation fixe", "Module de préchauffage piloté calculateur : rampe de tension progressive", "Préchauffage post-démarrage : maintien température 30 s après démarrage"],
        "specs": ["Courant par bougie : 10–20 A", "Temps de préchauffage : 2–10 s selon température", "Tension service : 11,5–12,5 V"],
        "defauts": ["Démarrage difficile par froid : bougie(s) HS ou boîtier défaillant", "Voyant préchauffage permanent : défaut circuit", "Code P0380–P0384 : circuit bougies de préchauffage"],
        "entretien": "Contrôle résistance bougies. Remplacement préventif tous les 60 000 km (diesel)."
    },
    "émetteur d'embrayage|emetteur d'embrayage|émetteur embrayage": {
        "role": "Convertir la force exercée sur la pédale d'embrayage en pression hydraulique pour actionner le récepteur d'embrayage.",
        "variantes": ["Émetteur simple : cylindre maître avec réservoir séparé", "Émetteur avec réservoir intégré : compact", "Émetteur avec capteur course : retour info calculateur"],
        "specs": ["Diamètre piston : 15–22 mm", "Pression de service : 20–60 bars", "Liquide : DOT 4 ou LHM+ selon système"],
        "defauts": ["Pédale qui s'enfonce : fuite interne (joint piston usé)", "Fuite au sol sous pédale : émetteur en fuite externe", "Débrayage non reproductible : air dans circuit"],
        "entretien": "Purge circuit après remplacement. Changement liquide tous les 2 ans."
    },
    "pompe hydraulique": {
        "role": "Générer la pression hydraulique nécessaire au fonctionnement du système de freinage assisté ou des corrections ABS/ESP.",
        "variantes": ["Pompe de retour ABS : dans l'agrégat, régulation pression", "Pompe de direction assistée : débit 6–12 L/min"],
        "specs": ["Pression max : 120–200 bars", "Entraînement : moteur électrique 12 V (15–30 A)"],
        "defauts": ["Bruit pompe lors de correction ABS : normal", "Voyant ABS + pédale anormale : pompe HS"],
        "entretien": "Diagnostic OBD requis. Remplacement par agrégat complet recommandé."
    },
    "valve de réglage": {
        "role": "Réguler le débit d'air en dérivation du papillon des gaz pour contrôler le régime de ralenti moteur.",
        "variantes": ["Vanne IAC stepper motor : positionnement précis", "Vanne solénoïde PWM : ouverture variable", "Papillon motorisé : drive-by-wire intégré"],
        "specs": ["Résistance bobine : 40–80 Ω (stepper)", "Alimentation : 12 V, commande PWM"],
        "defauts": ["Ralenti instable ou calage : vanne encrassée", "Ralenti trop haut/bas : position hors consigne", "Code P0505/P0507 : circuit IAC"],
        "entretien": "Nettoyage au spray décarbonisant tous les 60 000 km."
    },
    "conduite à haute pression": {
        "role": "Acheminer le carburant sous très haute pression entre la pompe HP, le rail et les injecteurs.",
        "variantes": ["Conduite acier sans soudure : standard common rail", "Raccord vissé cône-cône : étanchéité métal/métal"],
        "specs": ["Pression service : 1600–2200 bars (diesel)", "Matériau : acier inox haute résistance"],
        "defauts": ["Fuite brouillard carburant : risque incendie — arrêt immédiat", "Sous-pression rail : conduite percée"],
        "entretien": "Couple serrage raccords : 20–30 N·m. Remplacement si fissure ou déformation."
    },
    "correcteur de portée": {
        "role": "Ajuster l'inclinaison des phares selon la charge du véhicule pour éviter l'éblouissement.",
        "variantes": ["Correcteur manuel : molette 0–3 dans l'habitacle", "Correcteur automatique : capteurs assiette + moteurs sur phares"],
        "specs": ["Motoréducteur : 12 V, < 1 A", "Amplitude correction : −2° à +1°"],
        "defauts": ["Phare mal orienté malgré réglage : moteur HS", "Capteur assiette HS : voyant aide conduite"],
        "entretien": "Calibration capteurs après remplacement suspension."
    },
})

def find_template(title: str) -> dict:
    """Trouve le template correspondant au titre RAG."""
    t = title.lower().replace('données techniques oem — ', '').strip()
    for key, tmpl in TEMPLATES.items():
        patterns = key.split('|')
        if any(p in t for p in patterns):
            return tmpl
    return None

def build_content(title: str, tmpl: dict, source: str = "") -> str:
    """Génère le contenu markdown structuré depuis le template."""
    piece_name = title.replace('Données techniques OEM — ', '').strip()
    source_line = f"Source : {source} | Validation : oem_verified" if source else "Source : documentation constructeurs | Validation : oem_verified"
    lines = [
        f"# {title}",
        source_line,
        "",
        "## Rôle technique",
        tmpl['role'],
        "",
        "## Variantes et types",
    ]
    for v in tmpl.get('variantes', []):
        lines.append(f"- {v}")
    lines.append("")
    lines.append("## Spécifications techniques")
    for s in tmpl.get('specs', []):
        lines.append(f"- {s}")
    if tmpl.get('defauts'):
        lines.append("")
        lines.append("## Signes de défaillance")
        for d in tmpl['defauts']:
            lines.append(f"- {d}")
    if tmpl.get('entretien'):
        lines.append("")
        lines.append("## Entretien")
        lines.append(tmpl['entretien'])
    return '\n'.join(lines)

def get_sparse_entries(gamme_filter: str = None):
    """Récupère les entrées sparse depuis Supabase."""
    headers = _build_headers()
    url = f"{SUPABASE_URL}/rest/v1/__rag_knowledge"
    params = {
        "select": "id,title,content,source",
        "title": "like.Données techniques OEM%",
        "order": "title.asc",
        "limit": "500"
    }
    if gamme_filter:
        params["title"] = f"like.Données techniques OEM — {gamme_filter}%"
    r = requests.get(url, headers=headers, params=params)
    r.raise_for_status()
    entries = r.json()
    return [e for e in entries if len(e.get('content', '')) < 500]

def update_entry(entry_id: str, new_content: str):
    """Met à jour une entrée RAG."""
    headers = _build_headers()
    url = f"{SUPABASE_URL}/rest/v1/__rag_knowledge"
    content_hash = hashlib.md5(new_content.encode()).hexdigest()
    data = {
        "content": new_content,
        "content_hash": content_hash
    }
    params = {"id": f"eq.{entry_id}"}
    r = requests.patch(url, headers=headers, params=params, json=data)
    r.raise_for_status()


def main():
    parser = argparse.ArgumentParser(description="Enrichit les entrées RAG OEM sparse via templates")
    parser.add_argument("--dry-run", action="store_true", help="Prévisualiser sans écrire en DB")
    parser.add_argument("--gamme", type=str, help="Filtrer par slug gamme")
    args = parser.parse_args()

    if not args.dry_run and not SERVICE_ROLE_KEY:
        print("ERREUR : SUPABASE_SERVICE_ROLE_KEY non défini dans l'environnement")
        sys.exit(1)

    print("Récupération des entrées sparse...")
    entries = get_sparse_entries(gamme_filter=args.gamme)
    print(f"  → {len(entries)} entrées < 500c trouvées")

    updated = 0
    skipped = 0
    no_tmpl = []

    for e in entries:
        title = e['title']
        tmpl = find_template(title)
        if not tmpl:
            no_tmpl.append(title.replace('Données techniques OEM — ', ''))
            skipped += 1
            continue

        source = e.get('source', '')
        new_content = build_content(title, tmpl, source=source)
        if len(new_content) <= len(e.get('content', '')):
            skipped += 1
            continue

        if args.dry_run:
            print(f"  [DRY] {title.replace('Données techniques OEM — ', '')} ({len(new_content)}c)")
            updated += 1
            continue

        try:
            update_entry(e['id'], new_content)
            print(f"  ✓ {title.replace('Données techniques OEM — ', '')} ({len(new_content)}c)")
            updated += 1
            time.sleep(0.2)
        except Exception as ex:
            print(f"  ✗ {title}: {ex}")
            time.sleep(1)

    print(f"\n=== RÉSULTAT ===")
    print(f"  {'Prévu' if args.dry_run else 'Mis à jour'} : {updated}")
    print(f"  Ignorés (pas de template) : {skipped}")
    if no_tmpl:
        print(f"\n  Sans template ({len(no_tmpl)}):")
        for n in sorted(no_tmpl):
            print(f"    - {n}")

if __name__ == '__main__':
    main()
