# Page Roles — Canon final R0 a R8 + gouvernance G1 a G5

## Regle de separation role / gouvernance

Les roles `R*` decrivent des **surfaces metier ou usages fonctionnels / editoriaux a promesse centrale exclusive**.

La gouvernance ne constitue ni un role editorial, ni une surface metier, ni une destination utilisateur principale.
Elle forme une couche transverse de controle intervenant pour :

- verifier la purete de role
- controler la qualite
- mesurer la diversite
- prevenir la cannibalisation
- decider publication / hold / block
- tracer les ecarts et escalades

En consequence, la gouvernance ne doit pas etre numerotee dans la meme serie que les roles `R*`.

---

## Matrice canonique des roles

- `R0_HOME` = page d'accueil
- `R1_ROUTER` = page gamme / orientation vers la bonne piece pour le bon vehicule
- `R2_PRODUCT` = surface transactionnelle produit / listing ou selection commercialement exploitable
- `R3_CONSEILS` = conseils / how-to / entretien / remplacement / verifications generiques
- `R4_REFERENCE` = reference / definition / fiche encyclopedique technique
- `R5_DIAGNOSTIC` = orientation symptome / panne / causes probables / triage
- `R6_GUIDE_ACHAT` = guide d'achat / aide au choix / securisation avant commande
- `R7_BRAND` = hub constructeur / surface marque
- `R8_VEHICLE` = hub / fiche vehicule

---

## Couche canonique de gouvernance transverse

- `G1` = Purete
- `G2` = Diversite
- `G3` = Anti-cannibalisation
- `G4` = Publication Control
- `G5` = Review / Escalation

---

## Regles d'implementation

1. Aucun agent, script, brief, contract ou pipeline ne doit traiter `G*` comme un role metier.
2. Tout contenu genere doit cibler un role `R*`, jamais une couche `G*`.
3. Toute decision de validation, blocage, score, review ou publication releve de `G*`, jamais d'un role `R*`.
4. Les collisions entre surfaces se reglent par les controles `G*`, pas par la creation d'un faux role supplementaire.
5. Une couche `G*` peut bloquer, limiter, scorer, exclure ou escalader un contenu, mais ne constitue jamais sa promesse centrale.

---

## Frontieres rapides

### R1_ROUTER
Promesse : aider a trouver la bonne piece pour le bon vehicule.
Interdits :
- diagnostic
- how-to
- definition encyclopedique
- guide d'achat
- transactionnel R2

### R2_PRODUCT
Promesse : convertir sur une offre / selection produit.
Interdits :
- selection vehicule comme promesse centrale R1
- procedure R3
- definition R4
- diagnostic R5

### R3_CONSEILS
Promesse : aider a agir correctement sur une operation ou un controle generique.
Interdits :
- definition centrale R4
- arbre de diagnostic R5
- choix achat R6
- transactionnel R2
- dependance forte vehicule/km/historique → TOOL

### R4_REFERENCE
Promesse : expliquer ce qu'est un organe / terme / concept technique.
Interdits :
- how-to
- diagnostic
- transactionnel
- surface achat
- angle vehicule specifique fort

### R5_DIAGNOSTIC
Promesse : aider a orienter un probleme a partir d'un symptome.
Interdits :
- procedure detaillee R3
- definition centrale R4
- achat R6
- transactionnel R2
- personnalisation profonde sans contexte suffisant → TOOL

### R6_GUIDE_ACHAT
Promesse : securiser une decision d'achat sans erreur.
Interdits :
- procedure R3
- diagnostic R5
- definition centrale R4
- transactionnel R2 direct
- contenu support generique

### R7_BRAND
Promesse : orienter et structurer l'acces a l'univers d'une marque.
Interdits :
- how-to
- diagnostic
- definition encyclopedique d'organe
- transactionnel pur

### R8_VEHICLE
Promesse : structurer l'acces a un vehicule / ses variantes / ses contextes compatibles.
Interdits :
- transactionnel pur
- guide d'achat central
- diagnostic central
- reference encyclopedique centrale

---

## Reroute canonique

- si le besoin est surtout procedure → `R3_CONSEILS`
- si le besoin est surtout definition → `R4_REFERENCE`
- si le besoin est surtout symptome / panne → `R5_DIAGNOSTIC`
- si le besoin est surtout choix avant commande → `R6_GUIDE_ACHAT`
- si le besoin est surtout transaction → `R2_PRODUCT`
- si le besoin depend fortement du vehicule exact, du kilometrage ou de l'historique → `TOOL`

---

## Regle finale

Mieux vaut bloquer proprement, rerouter proprement ou escalader en `G5` que produire une surface hybride ou fausse.
