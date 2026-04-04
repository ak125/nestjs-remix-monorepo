#!/usr/bin/env python3
"""
rag-enrich-from-web-corpus.py — Enrichit les gammes .md depuis le corpus web OEM existant.

Lit les 1273 fichiers dans /opt/automecanik/rag/knowledge/web/,
mappe chaque fichier vers les gammes correspondantes,
extrait les données techniques (normes, matériaux, valeurs, types),
et injecte dans le frontmatter des gammes.

Usage:
  python3 scripts/rag/rag-enrich-from-web-corpus.py [--dry-run] [--gamme disque-de-frein] [--force]
"""

import os
import re
import json
import argparse
from collections import defaultdict
from datetime import datetime

WEB_DIR = "/opt/automecanik/rag/knowledge/web"
WEB_CATALOG_DIR = "/opt/automecanik/rag/knowledge/web-catalog"
GAMMES_DIR = "/opt/automecanik/rag/knowledge/gammes"

# === MAPPING GAMME → TERMES DE RECHERCHE ===
# Chaque gamme a des termes FR + EN qui matchent dans le contenu web
GAMME_KEYWORDS = {
    "disque-de-frein": ["disque de frein", "disques de frein", "brake disc", "brake rotor", "disque ventilé", "disque plein"],
    "plaquette-de-frein": ["plaquette de frein", "plaquettes de frein", "brake pad", "garniture de frein"],
    "etrier-de-frein": ["étrier de frein", "etrier de frein", "étriers de frein", "brake caliper", "caliper"],
    "machoires-de-frein": ["mâchoire de frein", "machoire de frein", "mâchoires de frein", "brake shoe"],
    "tambour-de-frein": ["tambour de frein", "tambours de frein", "brake drum", "frein à tambour"],
    "flexible-de-frein": ["flexible de frein", "flexibles de frein", "brake hose", "durite de frein"],
    "maitre-cylindre-de-frein": ["maître-cylindre", "maitre-cylindre", "maîtres-cylindres", "master cylinder"],
    "servo-frein": ["servo-frein", "servofrein", "brake booster", "mastervac"],
    "cable-de-frein-a-main": ["câble de frein", "cable de frein", "frein de stationnement", "frein à main", "hand brake"],
    "cylindre-de-roue": ["cylindre de roue", "cylindres de roue", "wheel cylinder"],
    "agregat-de-freinage": ["abs", "esp", "bloc hydraulique", "agrégat de freinage", "agregat"],
    "temoin-d-usure": ["témoin d'usure", "temoin d'usure", "wear indicator", "wear sensor"],
    "repartiteur-de-frein": ["répartiteur de frein", "correcteur de freinage"],
    "filtre-a-air": ["filtre à air", "filtre a air", "air filter"],
    "filtre-a-huile": ["filtre à huile", "filtre a huile", "oil filter"],
    "filtre-d-habitacle": ["filtre d'habitacle", "filtre habitacle", "filtre à pollen", "cabin filter"],
    "filtre-a-carburant": ["filtre à carburant", "filtre a carburant", "fuel filter", "filtre gasoil"],
    "filtre-de-boite-auto": ["filtre de boîte", "filtre boite auto", "transmission filter"],
    "bobine-d-allumage": ["bobine d'allumage", "bobine allumage", "ignition coil"],
    "bougie-d-allumage": ["bougie d'allumage", "bougies d'allumage", "spark plug"],
    "bougie-de-prechauffage": ["bougie de préchauffage", "bougie prechauffage", "glow plug"],
    "injecteur": ["injecteur", "injecteurs", "injector", "common rail"],
    "pompe-a-carburant": ["pompe à carburant", "pompe a carburant", "fuel pump", "pompe de gavage"],
    "pompe-a-haute-pression": ["pompe haute pression", "pompe HP", "high pressure pump"],
    "capteur-abs": ["capteur abs", "capteur de vitesse de roue", "abs sensor", "wheel speed sensor"],
    "sonde-lambda": ["sonde lambda", "lambda", "oxygen sensor"],
    "debitmetre-d-air": ["débitmètre", "debitmetre", "air mass", "maf", "mass air flow"],
    "capteur-vilebrequin": ["capteur vilebrequin", "capteur pmh", "crankshaft sensor"],
    "sonde-de-refroidissement": ["sonde de refroidissement", "capteur température liquide", "coolant sensor"],
    "alternateur": ["alternateur", "alternator", "charging system"],
    "demarreur": ["démarreur", "demarreur", "starter", "démarrage"],
    "amortisseur": ["amortisseur", "amortisseurs", "shock absorber"],
    "courroie-de-distribution": ["courroie de distribution", "timing belt", "distribution"],
    "courroie-d-accessoire": ["courroie d'accessoire", "courroie poly", "serpentine belt", "poly v"],
    "support-moteur": ["support moteur", "supports moteur", "engine mount", "silent bloc moteur"],
    "bras-de-suspension": ["bras de suspension", "control arm", "silent bloc"],
    "rotule-de-direction": ["rotule de direction", "tie rod", "biellette de direction"],
    "rotule-de-suspension": ["rotule de suspension", "ball joint"],
    "biellette-de-barre-stabilisatrice": ["biellette de barre", "stabilizer link", "barre stabilisatrice"],
    "roulement-de-roue": ["roulement de roue", "roulements de roue", "wheel bearing", "moyeu"],
    "balais-d-essuie-glace": ["balai d'essuie", "essuie-glace", "wiper blade", "balais essuie"],
    "thermostat": ["thermostat", "calorstat"],
    "radiateur-de-refroidissement": ["radiateur de refroidissement", "radiateur moteur", "coolant radiator"],
    "pompe-a-eau": ["pompe à eau", "pompe a eau", "water pump", "pompe de refroidissement"],
    "kit-d-embrayage": ["embrayage", "clutch", "kit embrayage"],
    "volant-moteur": ["volant moteur", "dual mass", "bimasse", "flywheel", "dmf"],
    "catalyseur": ["catalyseur", "catalytic converter", "pot catalytique"],
    "fap": ["fap", "filtre à particules", "filtre particules", "dpf"],
    "vanne-egr": ["vanne egr", "egr", "recirculation gaz"],
    "turbo": ["turbo", "turbocompresseur", "turbocharger"],
    "compresseur-de-climatisation": ["compresseur de climatisation", "compresseur clim", "ac compressor"],
    "batterie": ["batterie", "battery", "agm", "efb"],

    # === FREINAGE (suite) ===
    "accessoires-de-machoire": ["accessoires de mâchoire", "accessoire frein à tambour", "brake shoe accessories"],
    "accessoires-de-plaquette": ["accessoires de plaquette", "hardware kit plaquette", "brake pad accessories", "kit visserie plaquette"],
    "kit-de-freins-arriere": ["kit de freins arrière", "kit frein arrière", "rear brake kit", "kit frein complet"],
    "pompe-a-vide-de-freinage": ["pompe à vide de freinage", "vacuum pump brake", "pompe vide frein", "servovide"],
    "pompe-hydraulique-systeme-de-freinage": ["pompe hydraulique freinage", "brake hydraulic pump", "pompe ABS freinage"],

    # === SUSPENSION / DIRECTION ===
    "amortisseur-de-direction": ["amortisseur de direction", "steering damper", "stabilisateur de direction"],
    "barre-de-direction": ["barre de direction", "track rod", "barre direction", "relay rod"],
    "barre-stabilisatrice": ["barre stabilisatrice", "sway bar", "anti-roll bar", "barre anti-roulis", "stabilizer bar"],
    "butee-elastique-d-amortisseur": ["butée élastique d'amortisseur", "bump stop", "butée caoutchouc amortisseur", "coupelle amortisseur"],
    "cremailliere-de-direction": ["crémaillière de direction", "rack and pinion", "steering rack", "rack de direction"],
    "kit-de-butee-de-suspension": ["kit de butée de suspension", "strut mount kit", "kit butée amortisseur", "kit coupelle amortisseur"],
    "ressort-de-suspension": ["ressort de suspension", "suspension spring", "coil spring", "ressort hélicoïdal"],
    "sphere-de-suspension": ["sphère de suspension", "hydropneumatic sphere", "accumulateur suspension", "suspension hydraulique"],
    "colonne-de-direction": ["colonne de direction", "steering column", "axe de direction"],
    "detecteur-de-l-angle-de-braquage": ["capteur angle de braquage", "steering angle sensor", "détecteur angle braquage", "SAS sensor"],
    "pompe-de-direction-assistee": ["pompe de direction assistée", "power steering pump", "pompe direction", "pompe servo-direction"],
    "soufflet-de-direction": ["soufflet de direction", "steering boot", "soufflet crémaillière", "steering rack gaiter"],

    # === TRANSMISSION / EMBRAYAGE ===
    "butee-d-embrayage": ["butée d'embrayage", "clutch release bearing", "roulement butée embrayage", "butée de débrayage"],
    "cable-d-embrayage": ["câble d'embrayage", "clutch cable", "cable embrayage"],
    "cardan": ["cardan", "CV joint", "joint homocinétique", "axle shaft", "tripode cardan"],
    "emetteur-d-embrayage": ["émetteur d'embrayage", "clutch master cylinder", "maître-cylindre embrayage"],
    "fourchette-d-embrayage": ["fourchette d'embrayage", "clutch fork", "levier embrayage"],
    "guide-d-embrayage": ["guide d'embrayage", "clutch guide tube", "douille guidage embrayage"],
    "joint-arbre-longitudinal": ["joint arbre longitudinal", "propshaft joint", "joint arbre de transmission"],
    "palier-d-arbre-de-transmission": ["palier d'arbre de transmission", "propshaft center bearing", "palier central arbre"],
    "recepteur-d-embrayage": ["récepteur d'embrayage", "clutch slave cylinder", "cylindre récepteur embrayage"],
    "soufflet-de-cardan": ["soufflet de cardan", "CV joint boot", "soufflet joint homocinétique", "gaiter cardan"],
    "trepied-arbre-de-commande": ["trépied arbre de commande", "tripod joint", "tripode transmission"],
    "support-de-boite-vitesse": ["support de boîte de vitesse", "gearbox mount", "silent bloc boîte de vitesse"],
    "suspension-boite-vitesse-automatique": ["suspension boîte de vitesse automatique", "automatic transmission mount", "support boîte auto"],
    "tringle-de-vitesses": ["tringle de vitesses", "gear linkage", "commande de vitesse"],

    # === DISTRIBUTION / CHAÎNE ===
    "chaine-de-distribution": ["chaîne de distribution", "timing chain", "chaîne de distribution moteur"],
    "galet-enrouleur-de-courroie-d-accessoire": ["galet enrouleur courroie accessoire", "idler pulley accessory belt", "poulie enrouleur accessoire"],
    "galet-enrouleur-de-courroie-de-distribution": ["galet enrouleur courroie distribution", "idler pulley timing belt", "poulie enrouleur distribution"],
    "galet-tendeur-de-courroie-d-accessoire": ["galet tendeur courroie accessoire", "tensioner pulley accessory belt", "tendeur courroie accessoire"],
    "galet-tendeur-de-courroie-de-distribution": ["galet tendeur courroie distribution", "tensioner pulley timing belt", "tendeur courroie distribution"],
    "kit-de-chaine-de-distribution": ["kit de chaîne de distribution", "timing chain kit", "kit chaîne distribution", "chaîne de distribution kit"],
    "kit-de-distribution": ["kit de distribution", "timing kit", "kit courroie distribution", "kit de courroie de distribution"],

    # === MOTEUR / CULASSE ===
    "arbre-a-came": ["arbre à cames", "camshaft", "arbre de distribution cames"],
    "carter-d-huile": ["carter d'huile", "oil pan", "carter inférieur moteur"],
    "culbuteur": ["culbuteur", "rocker arm", "culbuteur soupape moteur"],
    "guide-de-soupape": ["guide de soupape", "valve guide", "guide soupape moteur"],
    "joint-carter-de-distribution": ["joint carter de distribution", "timing cover gasket", "joint carter distribution"],
    "joint-chemise-de-cylindre": ["joint de chemise de cylindre", "cylinder liner seal", "O-ring chemise"],
    "joint-de-boite-vitesse": ["joint de boîte de vitesses", "gearbox gasket", "joint d'étanchéité boîte"],
    "joint-de-cache-culbuteurs": ["joint de cache-culbuteurs", "rocker cover gasket", "valve cover gasket", "joint culbuteur"],
    "joint-de-carter-d-huile": ["joint de carter d'huile", "oil pan gasket", "joint carter huile"],
    "joint-de-collecteur": ["joint de collecteur", "manifold gasket", "joint collecteur admission"],
    "joint-de-culasse": ["joint de culasse", "head gasket", "cylinder head gasket", "joint culasse moteur"],
    "joint-de-pompe-d-injection": ["joint de pompe d'injection", "injection pump gasket", "joint pompe injection"],
    "joint-d-injecteur": ["joint d'injecteur", "injector seal", "joint cuivre injecteur", "rondelle injecteur"],
    "joint-tige-de-soupape": ["joint de tige de soupape", "valve stem seal", "joint spi soupape"],
    "pochette-joints-moteur": ["pochette de joints moteur", "engine gasket set", "kit joints moteur", "jeu de joints moteur"],
    "poussoir-de-soupape": ["poussoir de soupape", "valve lifter", "hydraulic tappet", "poussoir hydraulique soupape"],
    "kit-de-poussoir-culbuteur": ["kit de poussoir culbuteur", "tappet kit", "kit poussoirs culbuteurs"],
    "poulie-d-arbre-a-came": ["poulie d'arbre à cames", "camshaft pulley", "poulie de distribution arbre à cames"],
    "poulie-vilebrequin": ["poulie vilebrequin", "crankshaft pulley", "damper pulley", "poulie harmonique"],
    "soupape-d-admission": ["soupape d'admission", "intake valve", "soupape admission moteur"],
    "soupape-d-echappement": ["soupape d'échappement", "exhaust valve", "soupape échappement moteur"],
    "vis-de-culasse": ["vis de culasse", "head bolt", "boulon de culasse", "cheville de culasse"],

    # === ÉCHAPPEMENT ===
    "collecteur-d-echappement": ["collecteur d'échappement", "exhaust manifold", "collecteur échappement"],
    "joint-d-echappement": ["joint d'échappement", "exhaust gasket", "joint d'emboitement échappement"],
    "silencieux": ["silencieux", "muffler", "pot d'échappement", "exhaust silencer", "silencieux d'échappement"],
    "tube-d-echappement": ["tube d'échappement", "exhaust pipe", "tuyau d'échappement moteur"],

    # === REFROIDISSEMENT ===
    "bouchon-de-radiateur": ["bouchon de radiateur", "radiator cap", "bouchon de pression radiateur"],
    "bride-de-liquide-de-refroidissement": ["bride de liquide de refroidissement", "coolant flange", "bride thermostat refroidissement"],
    "durite-de-refroidissement": ["durite de refroidissement", "coolant hose", "durite radiateur refroidissement"],
    "moteur-electrique-de-ventilateur": ["moteur électrique de ventilateur", "fan motor", "moteur ventilateur refroidissement"],
    "radiateur-de-chauffage": ["radiateur de chauffage", "heater core", "radiateur habitacle chauffage"],
    "radiateur-d-huile": ["radiateur d'huile", "oil cooler", "échangeur d'huile moteur"],
    "refroidisseur-de-carburant": ["refroidisseur de carburant", "fuel cooler", "échangeur carburant"],
    "vase-d-expansion": ["vase d'expansion", "expansion tank", "réservoir liquide refroidissement", "coolant reservoir"],
    "ventilateur-de-refroidissement": ["ventilateur de refroidissement", "cooling fan", "ventilateur radiateur"],

    # === ALIMENTATION / CARBURANT ===
    "accumulateur-de-pression": ["accumulateur de pression", "pressure accumulator", "accumulateur hydraulique"],
    "accumulateur-de-pression-de-carburant": ["accumulateur de pression de carburant", "fuel pressure accumulator", "accumulateur carburant"],
    "bouchon-reservoir-de-carburant": ["bouchon de réservoir de carburant", "fuel cap", "bouchon réservoir essence"],
    "conduite-a-haute-pression-d-injection": ["conduite haute pression injection", "high pressure fuel line", "conduite injection HP"],
    "corps-papillon": ["corps papillon", "throttle body", "papillon des gaz", "corps de papillon"],
    "gicleur-detendeur": ["gicleur détendeur", "expansion valve", "détendeur TXV", "TXV carburant"],
    "intercooler": ["intercooler", "échangeur air-air", "refroidisseur de suralimentation", "air charge cooler"],
    "pompe-a-injection": ["pompe à injection", "injection pump", "pompe diesel injection"],
    "pompe-d-amorcage": ["pompe d'amorçage", "priming pump", "pompe de gavage amorçage"],
    "regulateur-de-pression-carburant": ["régulateur de pression carburant", "fuel pressure regulator", "FPR carburant"],
    "soupape-de-rampe-commune-d-injection": ["soupape de rampe commune", "common rail pressure relief", "soupape limiteur pression rail"],
    "tuyau-carburant-de-fuite": ["tuyau carburant de fuite", "fuel return hose", "tuyau de retour carburant"],
    "tube-de-distributeur-carburant": ["tube distributeur carburant", "fuel rail", "rampe d'injection carburant"],
    "valve-de-reglage-du-ralenti": ["valve de réglage du ralenti", "idle air control valve", "valve ralenti IAC"],

    # === CAPTEURS ===
    "capteur-controle-de-pression-des-pneus": ["capteur pression pneus", "TPMS", "tire pressure sensor", "capteur TPMS"],
    "capteur-d-allumage": ["capteur d'allumage", "ignition pickup sensor", "capteur allumage"],
    "capteur-d-arbre-a-cames": ["capteur d'arbre à cames", "camshaft position sensor", "CMP sensor arbre cames"],
    "capteur-de-cognement": ["capteur de cognement", "knock sensor", "capteur cliquetis", "detonation sensor"],
    "capteur-de-pedale-d-accelerateur": ["capteur de pédale d'accélérateur", "accelerator pedal sensor", "capteur pédale gaz"],
    "capteur-de-pluie": ["capteur de pluie", "rain sensor", "capteur pluie pare-brise"],
    "capteur-de-pression-common-rail": ["capteur de pression common rail", "rail pressure sensor", "capteur pression rampe injection"],
    "capteur-de-pression-turbo": ["capteur de pression turbo", "boost pressure sensor", "MAP sensor turbo"],
    "capteur-impulsion": ["capteur d'impulsion", "pulse sensor", "capteur impulsion moteur"],
    "capteur-niveau-de-liquide-de-refroidissement": ["capteur niveau liquide refroidissement", "coolant level sensor", "capteur niveau liquide"],
    "capteur-niveau-d-huile-moteur": ["capteur niveau d'huile moteur", "oil level sensor", "capteur niveau huile"],
    "capteur-parctronic": ["capteur parctronic", "parking sensor", "capteur de recul radar"],
    "capteur-position-papillon": ["capteur position papillon", "throttle position sensor", "TPS papillon"],
    "capteur-pression-de-carburant": ["capteur pression de carburant", "fuel pressure sensor", "capteur pression essence"],
    "capteur-pression-de-gaz-d-echappement": ["capteur pression gaz échappement", "exhaust backpressure sensor", "capteur pression FAP"],
    "capteur-pression-d-huile": ["capteur pression d'huile", "oil pressure sensor", "pressostat huile capteur"],
    "capteur-pression-du-tuyau-d-admission": ["capteur pression tuyau admission", "MAP sensor admission", "capteur manifold pression"],
    "capteur-pression-et-temperature-d-huile": ["capteur pression température huile", "oil pressure temperature sensor", "capteur combiné huile"],
    "capteur-temperature-d-air-admission": ["capteur température air admission", "intake air temperature sensor", "IAT sensor admission"],
    "capteur-temperature-de-carburant": ["capteur température carburant", "fuel temperature sensor", "capteur température essence"],
    "capteur-temperature-de-climatisation": ["capteur température climatisation", "AC temperature sensor", "capteur température clim"],
    "capteur-temperature-d-huile": ["capteur température d'huile", "oil temperature sensor", "capteur température huile moteur"],
    "capteur-temperature-interieure": ["capteur température intérieure", "interior temperature sensor", "capteur habitacle température"],

    # === CLIMATISATION ===
    "bouteille-deshydratante": ["bouteille déshydratante", "receiver drier", "filtre déshydratant climatisation", "dessiccateur clim"],
    "condenseur-de-climatisation": ["condenseur de climatisation", "AC condenser", "condenseur clim", "condenseur A/C"],
    "conduite-de-climatisation": ["conduite de climatisation", "AC pipe", "tuyau climatisation", "conduite réfrigérante"],
    "detendeur-de-climatisation": ["détendeur de climatisation", "expansion valve AC", "détendeur clim TXV"],
    "evaporateur-de-climatisation": ["évaporateur de climatisation", "AC evaporator", "évaporateur clim A/C"],
    "pressostat-de-climatisation": ["pressostat de climatisation", "AC pressure switch", "pressostat clim réfrigérant"],
    "pulseur-d-air-d-habitacle": ["pulseur d'air d'habitacle", "cabin blower motor", "fan blower habitacle", "moteur pulseur"],

    # === ALLUMAGE ===
    "distributeur-d-allumage": ["distributeur d'allumage", "ignition distributor", "distributeur allumage HT"],
    "faisceau-d-allumage": ["faisceau d'allumage", "ignition cable set", "fils d'allumage bougies", "spark plug leads"],
    "module-d-allumage": ["module d'allumage", "ignition module", "allumeur électronique module"],

    # === ÉLECTRIQUE / ÉCLAIRAGE ===
    "ampoule-eclairage-interieur": ["ampoule éclairage intérieur", "interior light bulb", "ampoule habitacle"],
    "ampoule-feu-arriere": ["ampoule feu arrière", "rear light bulb", "bulb tail light arrière"],
    "ampoule-feu-avant": ["ampoule feu avant", "headlight bulb", "ampoule phare avant"],
    "ampoule-feu-clignotant": ["ampoule feu clignotant", "indicator bulb", "ampoule clignotant"],
    "ampoule-feu-de-position": ["ampoule feu de position", "sidelight bulb", "ampoule veilleuse position"],
    "ampoule-feu-de-recul": ["ampoule feu de recul", "reverse light bulb", "ampoule marche arrière"],
    "ampoule-feu-eclaireur-de-plaque": ["ampoule feu éclaireur plaque", "license plate bulb", "ampoule plaque immatriculation"],
    "ampoule-feu-stop": ["ampoule feu stop", "brake light bulb", "ampoule stop frein"],
    "avertisseur-sonore": ["avertisseur sonore", "car horn", "klaxon", "avertisseur acoustique"],
    "ballast-a-lampe-xenon": ["ballast lampe xénon", "xenon ballast", "HID ballast", "ballast D1S D2S xénon"],
    "feu-arriere": ["feu arrière", "rear light", "feux arrière", "bloc optique arrière"],
    "feu-avant": ["feu avant", "headlight", "phare avant", "optique avant"],
    "feu-clignotant": ["feu clignotant", "indicator light", "turn signal", "répétiteur clignotant"],
    "interrupteur-des-feux-de-freins": ["interrupteur des feux de freins", "brake light switch", "contacteur stop feux"],
    "interrupteur-position-de-marche": ["interrupteur position de marche", "ignition switch", "contacteur d'allumage"],
    "interrupteur-verrouilage-des-portes": ["interrupteur verrouillage des portes", "door lock switch", "contacteur serrure porte"],
    "neiman": ["neiman", "steering lock", "antivol de direction", "verrou de direction", "ignition lock cylinder"],
    "parctronic": ["parctronic", "parking sensor system", "aide au stationnement", "radar de stationnement"],
    "phares-antibrouillard": ["phares antibrouillard", "fog light", "antibrouillard avant", "front fog lamp"],
    "poulie-d-alternateur": ["poulie d'alternateur", "alternator pulley", "poulie roue libre alternateur", "OAP decoupler"],
    "relais-de-clignotant": ["relais de clignotant", "flasher relay", "relais clignotant feux"],

    # === CARROSSERIE / CONFORT ===
    "attelage": ["attelage", "tow bar", "crochet d'attelage", "trailer hitch"],
    "bouchon-de-vidange": ["bouchon de vidange", "drain plug", "bouchon vidange huile moteur"],
    "bouchon-d-huile-moteur": ["bouchon d'huile moteur", "oil filler cap", "bouchon de remplissage huile"],
    "bouchon-vase-d-expansion": ["bouchon vase d'expansion", "coolant reservoir cap", "bouchon expansion radiateur"],
    "boulon-de-roue": ["boulon de roue", "wheel bolt", "visserie roue", "écrou de roue"],
    "commande-correcteur-de-portee": ["commande correcteur de portée", "headlamp leveling switch", "correcteur phare commande"],
    "commande-d-eclairage": ["commande d'éclairage", "light switch", "commutateur feux éclairage"],
    "commande-d-essuie-glace": ["commande d'essuie-glace", "wiper switch", "commutateur essuie-glace"],
    "commande-de-ventilation": ["commande de ventilation", "fan speed switch", "commande chauffage ventilation"],
    "contacteur-de-feu-de-recul": ["contacteur feu de recul", "reverse light switch", "contacteur marche arrière"],
    "contacteur-demarreur": ["contacteur démarreur", "starter relay switch", "relais démarreur contacteur"],
    "correcteur-de-portee": ["correcteur de portée des phares", "headlight leveling motor", "correcteur optique phare"],
    "faisceau-d-attelage": ["faisceau d'attelage", "towbar wiring harness", "kit électrique attelage", "faisceau remorque"],
    "jauge-de-niveau-d-huile": ["jauge de niveau d'huile", "oil dipstick", "jauge d'huile moteur"],
    "leve-vitre": ["lève-vitre", "window regulator", "lève-glace électrique", "moteur lève-vitre"],
    "moyeu-de-roue": ["moyeu de roue", "wheel hub", "moyeu roulement roue"],
    "poignee-de-porte": ["poignée de porte", "door handle", "poignée extérieure porte"],
    "retroviseur-exterieur": ["rétroviseur extérieur", "door mirror", "rétroviseur latéral"],
    "serrure-de-porte": ["serrure de porte", "door lock", "serrure porte voiture"],
    "verin-capot-moteur": ["vérin capot moteur", "hood strut", "amortisseur de capot"],
    "verin-de-coffre": ["vérin de coffre", "trunk strut", "boot strut hayon"],
    "verin-vitre-arriere": ["vérin vitre arrière", "rear window strut", "vérin hayon vitre"],
    "vis-de-disque": ["vis de disque", "brake disc bolt", "vis de retenue disque frein"],

    # === ESSUIE-GLACE / NETTOYAGE ===
    "bras-d-essuie-glace": ["bras d'essuie-glace", "wiper arm", "bras essuie-glace pare-brise"],
    "moteur-d-essuie-glace": ["moteur d'essuie-glace", "wiper motor", "moteur mécanisme essuie-glace"],
    "pompe-nettoyage-des-phares": ["pompe nettoyage des phares", "headlamp washer pump", "pompe lave-phare"],
    "pompe-nettoyage-des-vitres": ["pompe nettoyage des vitres", "windscreen washer pump", "pompe lave-glace"],
    "tringlerie-d-essuie-glace": ["tringlerie d'essuie-glace", "wiper linkage", "mécanisme tringlerie essuie-glace"],

    # === MOTEUR ÉLECTRIQUE / VANNES / JOINTS D'ÉTANCHÉITÉ ===
    "electrovanne": ["électrovanne", "solenoid valve", "valve solenoide", "electrovalve"],
    "palpeur-de-regime-gestion-moteur": ["palpeur de régime moteur", "engine speed sensor management", "capteur régime gestion moteur"],
    "valve-de-turbo": ["valve de turbo", "turbo bypass valve", "dump valve turbo", "wastegate valve"],
    "valve-magnetique": ["valve magnétique", "magnetic valve", "électrovanne magnétique"],
    "soupape-d-air-secondaire": ["soupape d'air secondaire", "secondary air valve", "valve air secondaire"],
    "soupape-d-aspiration-d-air-secondaire": ["soupape aspiration air secondaire", "secondary air intake valve", "air secondary system"],
    "soupape-reaspiration-des-gaz-d-echappement": ["soupape réaspiration gaz d'échappement", "exhaust gas recirculation valve EGR secondaire"],
    "tuyau-ventilation-de-carter-moteur": ["tuyau ventilation carter moteur", "crankcase ventilation hose", "PCV hose reniflard"],
    "gaine-de-turbo": ["gaine de turbo", "turbo hose", "durite turbo intercooler", "flexible turbo"],
    "pompe-a-air": ["pompe à air", "secondary air pump", "pompe air secondaire injection"],
    "bague-d-etancheite-boite-automatique": ["bague d'étanchéité boîte automatique", "automatic gearbox seal", "joint étanchéité ATF"],
    "bague-d-etancheite-cardan": ["bague d'étanchéité cardan", "CV shaft seal", "joint d'étanchéité arbre cardan"],
    "bagues-d-etancheite-moteur": ["bagues d'étanchéité moteur", "engine oil seals set", "kit bagues étanchéité moteur"],
    "mecatronique-boite-automatique": ["mécatronique boîte automatique", "automatic transmission mechatronics", "mecatronic DSG boîte"],
    "pressostat-d-huile": ["pressostat d'huile", "oil pressure switch", "pressostat pression huile"],
    "boitier-de-prechauffage": ["boîtier de préchauffage", "glow plug control unit", "boîtier bougies préchauffage"],
}

# === PATTERNS D'EXTRACTION TECHNIQUE ===
NORM_RE = re.compile(r'(ECE\s*R\s*\d+|SAE\s*J\s*\d+|FMVSS[^,]*|ISO\s*\d+|DIN\s*\d+|DOT\s*[345]\.[01]?)', re.IGNORECASE)
MATERIAL_RE = re.compile(r'(fonte\s+(?:grise|GG\s*\d+|GJL[^,]*)|acier\s+inox(?:ydable)?|aluminium(?:\s+forgé)?|HNBR|EPDM|kevlar|aramide|céramique|carbone-céramique|silicone|caoutchouc\s+nitrile|FPM|Viton|polyamide\s*(?:renforcé)?|cordié?rite|platine|titane|zircone|graphite)', re.IGNORECASE)
VALUE_RE = re.compile(r'(\d+[\.,]?\d*)\s*(bars?|Nm|ohms?|kΩ|MΩ|°C|mm|µm|microns?|%|kW|A|V|Hz|kg|litres?|km)', re.IGNORECASE)
TYPE_RE = re.compile(r'(ventilé|plein|perforé|rainuré|composite|bi-matière|organique|semi-métallique|céramique|hydraulique|pneumatique|électrique|inductif|Hall|piézo|mono.?tube|bi.?tube|Low.?Met|NAO|trapézoïdal|poly.?V)', re.IGNORECASE)

# OEM domains — fournisseurs OEM/Tier-1 validés
# Source : am_2022_suppliers (sup_display=1) + fournisseurs actifs ___xtr_supplier
OEM_DOMAINS = {
    # ── Freinage ─────────────────────────────────────────────────────────────
    'bremboparts.com', 'ate-freinage.fr', 'textar.com', 'ferodo.com',
    'boschaftermarket.com',
    # ── Filtration / injection ────────────────────────────────────────────────
    'mann-filter.com', 'filtron.eu', 'wixfilters.com', 'fram.com',
    'mahle.com', 'mahle-aftermarket.com',
    # ── Électrique / allumage / capteurs ─────────────────────────────────────
    'boschwiperblades.com', 'denso-am.eu', 'hella.com',
    'ngk.com',                              # bougies, sondes lambda
    'continental-aftermarket.com',          # VDO, capteurs
    'meatdoria.com',                        # sondes, capteurs
    'topran.de',                            # capteurs, boitiers
    # ── Transmission / distribution / courroies ───────────────────────────────
    'hutchinson.com', 'gates.com', 'dayco.com', 'contitech.de',
    # ── Suspension / direction ────────────────────────────────────────────────
    'meyle.com',                            # rotules, triangles, direction
    'moog-suspension-parts.com',            # rotules, biellettes
    'lemfoerder.de',                        # direction, suspension
    # ── Amortisseurs / ressorts ───────────────────────────────────────────────
    'sachs.de',                             # amortisseurs, embrayage
    'monroe.com',                           # amortisseurs, ressorts
    'kyb-europe.com',                       # amortisseurs
    'bilstein.com',                         # amortisseurs haute perf
    # ── Joints / étanchéité ───────────────────────────────────────────────────
    'victorreinz.com',                      # joints culasse, carter
    'elring.com',                           # joints
    'corteco.com',                          # joints d'étanchéité
    'swag-online.com',                      # joints, visserie
    # ── Roulements / étanchéité mécanique ────────────────────────────────────
    'skf.com',                              # roulements, joints
    # ── Refroidissement ──────────────────────────────────────────────────────
    'nissens.com',                          # condenseurs, radiateurs
    'nrf.eu',                               # refroidissement
    # ── Pompes / carburant ───────────────────────────────────────────────────
    'airtex.eu',                            # pompes à carburant, à eau
    # ── Embrayage ────────────────────────────────────────────────────────────
    'aisin-europe.com',                     # embrayage, freinage
    # ── Vérins de carrosserie ─────────────────────────────────────────────────
    'stabilus.com',                         # vérins capot/coffre
    # ── Généralistes Tier-1 ───────────────────────────────────────────────────
    'febi.com',                             # joints, suspension, boitiers
    'valeo.com', 'valeoservice.fr',         # éclairage, embrayage, essuie-glaces
    'sofima-aftermarket.com', 'aftermarket.zf.com',
    'delphiautoparts.com', 'gpa26.com', 'profauto.fr',
    # ── Source encyclopédique ─────────────────────────────────────────────────
    'fr.wikipedia.org',
}

# === EXCLUSIONS DE TYPES PAR GAMME ===
# Évite les faux positifs cross-gamme (ex: types de disque dans une page plaquette)
GAMME_TYPE_EXCLUSIONS = {
    # Plaquettes : exclure les types qui décrivent les disques ou systèmes de freinage
    "plaquette-de-frein":     {"ventilé", "plein", "perforé", "rainuré", "hydraulique", "pneumatique", "électrique"},
    "machoires-de-frein":     {"ventilé", "plein", "perforé", "rainuré", "hydraulique", "pneumatique", "électrique"},
    # Disques : exclure les types qui décrivent les plaquettes/systèmes
    "disque-de-frein":        {"pneumatique", "électrique", "hydraulique", "NAO", "Low.?Met"},
    "tambour-de-frein":       {"ventilé", "perforé", "rainuré", "NAO"},
    # Filtres : exclure les types mécaniques
    "filtre-a-air":           {"ventilé", "perforé", "hydraulique", "pneumatique"},
    "filtre-a-huile":         {"ventilé", "perforé", "hydraulique", "pneumatique"},
    "filtre-d-habitacle":     {"ventilé", "perforé", "hydraulique", "pneumatique"},
    "filtre-a-carburant":     {"ventilé", "perforé", "hydraulique", "pneumatique"},
    # Électrique : exclure les types mécaniques
    "alternateur":            {"ventilé", "plein", "perforé", "rainuré", "NAO"},
    "demarreur":              {"ventilé", "plein", "perforé", "rainuré", "NAO"},
    "bobine-d-allumage":      {"ventilé", "plein", "perforé", "rainuré", "NAO"},
}


def read_web_file(filepath):
    """Lit un fichier web .md et retourne frontmatter + body."""
    with open(filepath) as f:
        raw = f.read()
    parts = raw.split('---', 2)
    if len(parts) < 3:
        return {}, ''
    fm = {}
    for line in parts[1].split('\n'):
        if ':' in line:
            k, v = line.split(':', 1)
            fm[k.strip()] = v.strip().strip("'\"")
    return fm, parts[2].strip()


def _is_valid_value(num_str, unit):
    """Filtre les faux positifs dans VALUE_RE (ex: codes catalogue matchant l'unité A)."""
    unit_lower = unit.lower()
    if unit_lower == 'a':
        clean = num_str.replace(',', '.').replace(' ', '')
        # Rejeter si le nombre a des zéros en tête (ex: 0162, 00340 → réf. catalogue)
        if re.match(r'^0\d', clean):
            return False
        # Rejeter 0 et 1 A (bruit sans valeur technique)
        try:
            fval = float(clean)
            if fval <= 1:
                return False
            # Rejeter si la valeur dépasse 1000 A (irréaliste pour pièces auto)
            if fval > 1000:
                return False
        except ValueError:
            return False
    return True


def extract_technical_data(body, source_url):
    """Extrait les données techniques d'un body de fichier web."""
    raw_values = [(v, u) for v, u in VALUE_RE.findall(body) if _is_valid_value(v, u)]
    data = {
        'norms': list(set(NORM_RE.findall(body))),
        'materials': list(set(MATERIAL_RE.findall(body))),
        'values': list(set(f"{v} {u}" for v, u in raw_values)),
        'types': list(set(TYPE_RE.findall(body))),
        'source_url': source_url,
    }
    # Score de richesse
    data['richness'] = len(data['norms']) + len(data['materials']) + len(data['values']) + len(data['types'])
    return data


def build_gamme_mapping():
    """Mappe chaque gamme vers ses fichiers web OEM par contenu.
    Cherche dans WEB_DIR + WEB_CATALOG_DIR (les deux corpus OEM).
    """
    mapping = defaultdict(list)  # gamme_slug → [(file, domain, technical_data)]

    corpus_dirs = [WEB_DIR, WEB_CATALOG_DIR]
    for corpus_dir in corpus_dirs:
        if not os.path.isdir(corpus_dir):
            continue
        for f in sorted(os.listdir(corpus_dir)):
            if not f.endswith('.md'):
                continue
            fp = os.path.join(corpus_dir, f)
            fm, body = read_web_file(fp)
            if not body or len(body) < 200:
                continue

            source_url = fm.get('source_url', '')
            domain = source_url.split('/')[2] if '//' in source_url else ''
            is_oem = any(d in domain for d in OEM_DOMAINS)
            if not is_oem:
                continue

            body_lower = body.lower()
            tech_data = extract_technical_data(body, source_url)

            # Mapping direct via slug_gamme (fichiers Wikipedia + corpus tagués)
            direct_slug = fm.get('slug_gamme', '').strip()
            if direct_slug:
                mapping[direct_slug].append({
                    'file': f,
                    'domain': domain.replace('www.', ''),
                    'tech_data': tech_data,
                })
                continue  # Pas besoin de keyword matching si slug direct

            for slug, keywords in GAMME_KEYWORDS.items():
                for kw in keywords:
                    if kw.lower() in body_lower:
                        mapping[slug].append({
                            'file': f,
                            'domain': domain.replace('www.', ''),
                            'tech_data': tech_data,
                        })
                        break

    return mapping


def build_enrichment_block(slug, files_data):
    """Construit le bloc phase5_enrichment YAML depuis les données web OEM."""
    # Agréger les données de tous les fichiers
    all_norms = set()
    all_materials = set()
    all_values = set()
    all_types = set()
    sources = set()

    for fd in files_data:
        td = fd['tech_data']
        all_norms.update(td['norms'])
        all_materials.update(td['materials'])
        all_values.update(td['values'])
        all_types.update(td['types'])
        sources.add(fd['domain'])

    # Appliquer les exclusions de types propres à la gamme
    exclusions = GAMME_TYPE_EXCLUSIONS.get(slug, set())
    if exclusions:
        excl_pattern = re.compile(
            '|'.join(re.escape(e) if '.' not in e else e for e in exclusions),
            re.IGNORECASE
        )
        all_types = {t for t in all_types if not excl_pattern.fullmatch(t)}

    # Bloc source-only autorisé : source OEM confirmée même sans specs extractibles
    # (contenu marketing/descriptif sans normes/matériaux/valeurs/types dans le regex)
    has_tech_data = bool(all_norms or all_materials or all_values or all_types)

    source_str = ' + '.join(sorted(sources))
    lines = [
        "phase5_enrichment:",
        f"  _source: {source_str}",
        "  _validation_status: oem_verified",
        f"  _enriched_at: '{datetime.now().strftime('%Y-%m-%d')}'",
        f"  _web_files_count: {len(files_data)}",
        f"  _has_tech_data: {'true' if has_tech_data else 'false'}",
    ]

    if all_types:
        lines.append("  types_variants:")
        for t in sorted(all_types):
            lines.append(f"  - type: '{t}'")
            lines.append(f"    source_ref: corpus RAG web OEM")

    if all_norms or all_values:
        lines.append("  technical_notes:")
        for n in sorted(all_norms):
            safe = n.replace("'", "''")
            lines.append(f"    norme_{n.lower().replace(' ','_')}: '{safe}'")
        for v in sorted(all_values)[:15]:  # Max 15 valeurs
            safe_k = re.sub(r'[^a-z0-9_]', '_', v.lower().replace(' ', '_'))
            lines.append(f"    val_{safe_k}: '{v}'")

    if all_materials:
        lines.append("  materials:")
        for m in sorted(all_materials):
            lines.append(f"  - materiau: '{m}'")
            lines.append(f"    source_ref: corpus RAG web OEM")

    return '\n'.join(lines) + '\n'


def inject_into_gamme(gamme_path, block):
    """Injecte le bloc phase5_enrichment dans le frontmatter d'une gamme."""
    with open(gamme_path) as f:
        content = f.read()

    # Supprimer l'ancien bloc phase5 LLM s'il existe
    if 'phase5_enrichment:' in content:
        start = content.index('phase5_enrichment:')
        rest = content[start:]
        lines = rest.split('\n')
        end_offset = 0
        for i, line in enumerate(lines):
            if i == 0:
                continue
            if line and not line.startswith(' ') and not line.startswith('#'):
                end_offset = sum(len(l) + 1 for l in lines[:i])
                break
        if end_offset == 0:
            end_offset = len(rest)
        content = content[:start] + content[start + end_offset:]

    # Insérer le nouveau bloc avant conseil_v5: ou ---
    if 'conseil_v5:' in content:
        content = content.replace('conseil_v5:', block + 'conseil_v5:')
    else:
        first = content.index('---')
        second = content.index('---', first + 3)
        content = content[:second] + block + content[second:]

    # Update lifecycle
    content = re.sub(r"last_enriched_by: [^\n]+",
                     "last_enriched_by: script:rag-enrich-from-web-corpus", content, count=1)

    with open(gamme_path, 'w') as f:
        f.write(content)


PROTECTED_STATUSES = {'manually_curated', 'expert_reviewed'}


def get_current_validation_status(gamme_path: str) -> str | None:
    """Lit le _validation_status actuel dans le bloc phase5_enrichment."""
    try:
        with open(gamme_path) as f:
            content = f.read()
        m = re.search(r'_validation_status:\s*(\S+)', content)
        return m.group(1).strip() if m else None
    except OSError:
        return None


def main():
    parser = argparse.ArgumentParser(description="Enrichit gammes depuis corpus web OEM")
    parser.add_argument('--dry-run', action='store_true', help="Ne pas écrire, juste rapport")
    parser.add_argument('--gamme', type=str, help="Enrichir une seule gamme")
    parser.add_argument('--force', action='store_true',
                        help='Écraser les gammes déjà oem_verified (défaut: skip)')
    args = parser.parse_args()

    print("Étape 1 : Mapping gammes → fichiers web OEM...")
    mapping = build_gamme_mapping()

    print(f"  {len(mapping)} gammes avec fichiers web OEM")
    print(f"  {sum(len(v) for v in mapping.values())} fichiers mappés total")

    print("\nÉtape 2 : Extraction données techniques + enrichissement...")

    ok = 0
    skip_no_data = 0
    skip_filter = 0
    skip_protected = 0
    skip_already = 0

    for slug in sorted(mapping.keys()):
        if args.gamme and slug != args.gamme:
            skip_filter += 1
            continue

        gamme_path = os.path.join(GAMMES_DIR, f"{slug}.md")
        if not os.path.exists(gamme_path):
            continue

        current_status = get_current_validation_status(gamme_path)

        # Statuts protégés : jamais écrasés
        if current_status in PROTECTED_STATUSES:
            print(f"  [SKIP] {slug} — protected status: {current_status}")
            skip_protected += 1
            continue

        # oem_verified : skip sauf si --force
        if current_status == 'oem_verified' and not args.force:
            skip_already += 1
            continue

        files_data = mapping[slug]
        block = build_enrichment_block(slug, files_data)

        if not block:
            skip_no_data += 1
            continue

        sources = set(fd['domain'] for fd in files_data)
        n_rich = sum(1 for fd in files_data if fd['tech_data']['richness'] > 3)

        if args.dry_run:
            print(f"  [DRY] {slug} — {len(files_data)} fichiers, {n_rich} riches, sources: {', '.join(sorted(sources)[:3])}")
        else:
            inject_into_gamme(gamme_path, block)
            print(f"  [OK]  {slug} — {len(files_data)} fichiers, {n_rich} riches, sources: {', '.join(sorted(sources)[:3])}")
        ok += 1

    print(f"\nRésultat : {ok} gammes enrichies | {skip_no_data} sans données | {skip_filter} filtrées | {skip_protected} protégées | {skip_already} déjà oem_verified")

    # Rapport gammes sans couverture
    covered = set(mapping.keys())
    all_gammes = set(f[:-3] for f in os.listdir(GAMMES_DIR) if f.endswith('.md'))
    missing = all_gammes - covered
    print(f"\nGammes sans fichier web OEM : {len(missing)}")
    if len(missing) <= 30:
        for s in sorted(missing):
            print(f"  - {s}")


if __name__ == '__main__':
    main()
