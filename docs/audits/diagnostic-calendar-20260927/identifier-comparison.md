# Comparaison des identifiants entretien / calendrier

Date : 2026-09-27. Projet Supabase : cxpojprgwgubzjyqzmoq.

## Conclusion

Aucune correspondance d'identité opération → intervalle KG n'est prouvée par les champs et liens examinés. Une jointure fiable des 30 opérations actives vers les 19 intervalles actifs ne peut pas être construite sans ajouter une correspondance explicite validée. Ni les libellés, ni leur proximité, ni les gammes de pièces ne prouvent l'identité d'une opération.

## Preuves et méthode

- Preuve antérieure réutilisée : C:\Users\Marwane\.codex\artifacts\diagnostic-maintenance-20260927\sql-evidence.json. Elle confirme 30 opérations et 19 intervalles ; elle contient les slugs et intervalles des opérations mais pas les identifiants ni les liens KG nécessaires à la jointure.
- Trois requêtes supplémentaires, chacune encadrée par BEGIN READ ONLY / COMMIT. Aucun appel de fonction métier ni mutation.
- Q1 : colonnes et contraintes des tables concernées ; Q2 : 30 opérations, 19 intervalles, métadonnées et liens incidents actifs ; Q3 : égalités exactes, collisions, contraintes entrantes et liens tous états.
- Données brutes, SQL exact et résultats normalisés : identifier-sql-evidence.json.

## Correspondances explicites

La liste des correspondances d'identité est vide : aucun operation.slug = MaintenanceInterval.node_alias ; aucune FK entre ces deux ensembles ; aucun identifiant d'opération dans node_data des 19 intervalles ; aucun kg_edge incident à ces 19 nœuds, y compris inactif.

Deux égalités textuelles existent entre un alias de gamme de pièces et un alias d'intervalle. Elles ne constituent pas des liens d'identité d'opération :

| Opération | ID | Gamme / pg_id | Intervalle KG | UUID |
|---|---:|---|---|---|
| battery_replacement | 5 | batterie / 1 | batterie | 1abaebe6-8496-493a-8b8c-8a9be0dadf75 |
| amortisseur_replacement | 28 | amortisseur / 854 | amortisseur | 9adb388f-39ec-4fc3-8bb1-b219a00a48b4 |

related_pg_id identifie une gamme catalogue. Les intervalles n'ont aucun pg_id associé dans leurs métadonnées et aucun lien vers un nœud Part. Utiliser ces deux égalités comme mapping opération serait une inférence sémantique non garantie par le schéma.

## Collisions et lacunes

- Gamme 424 / filtre-d-habitacle réutilisée par filtre_habitacle_replacement (35) et filtre_habitacle_clim (39). La gamme n'est donc pas une clé unique d'opération.
- Gamme 475 / « Durite de refroidissement » réutilisée par coolant_flush (13) et coolant_hose_inspection (16). Les deux opérations distinctes partagent une gamme ; le libellé de gamme ne suffit pas à choisir.
- Les 19 node_data sont vides ou contiennent des listes de texte libre operations (par exemple « Vidange huile », « Filtre huile »), parfois oil_type ou warning. Aucune de ces valeurs n'est une référence structurelle à __diag_maintenance_operation.
- Tous les tableaux sources des 19 intervalles sont vides. Toutes les lignes sélectionnées ont status=active et is_active=true.
- Les 30 opérations restent sans correspondance d'identité explicite, de même que les 19 intervalles. Une ressemblance de libellé n'a pas été comptée comme correspondance.
- __diag_maintenance_symptom_link.operation_id référence bien les opérations, mais l'autre extrémité référence __diag_symptom, pas kg_nodes. Elle ne fournit pas de pont opération → intervalle.
- Les FK entrantes sur kg_nodes trouvées sont celles de kg_edges, kg_diagnostic_cases, kg_rag_mapping et kg_reasoning_cache ; aucune ne référence les opérations d'entretien.
- La recherche de colonnes publiques nommées operation_id / operation_slug / maintenance...node ne trouve que __diag_maintenance_symptom_link.operation_id. Limite : ce contrôle borné ne prétend pas exclure toute convention textuelle dans des tables sans référence structurée ; une telle convention ne constituerait de toute façon pas la jointure explicite actuellement recherchée.

## Inventaire des 30 opérations actives

| ID | Slug opération | pg_id | Alias de gamme |
|---:|---|---:|---|
| 1 | brake_pads_replacement | 402 | plaquette-de-frein |
| 2 | brake_disc_replacement | 82 | disque-de-frein |
| 3 | brake_fluid_change | 479 | liquide-de-frein |
| 4 | brake_caliper_overhaul | 78 | etrier-de-frein |
| 5 | battery_replacement | 1 | batterie |
| 6 | battery_terminal_cleaning | null | null |
| 7 | alternator_check | 4 | alternateur |
| 8 | glow_plug_replacement | 243 | bougie-de-prechauffage |
| 13 | coolant_flush | 475 | Durite de refroidissement |
| 14 | water_pump_replacement | 1260 | Pompe à eau |
| 15 | thermostat_replacement | 316 | Thermostat |
| 16 | coolant_hose_inspection | 475 | Durite de refroidissement |
| 24 | kit_distribution_replacement | 307 | kit-de-distribution |
| 25 | courroie_accessoires_replacement | 305 | courroie-trapezoidale-a-nervures |
| 26 | kit_embrayage_replacement | 3825 | embrayage |
| 27 | volant_moteur_replacement | 577 | volant-moteur |
| 28 | amortisseur_replacement | 854 | amortisseur |
| 29 | silentbloc_replacement | 251 | silentbloc-de-bras-de-suspension |
| 30 | pompe_direction_replacement | 12 | pompe-de-direction-assistee |
| 31 | controle_echappement | 429 | catalyseur |
| 32 | filtre_huile_replacement | 7 | filtre-a-huile |
| 33 | filtre_air_replacement | 8 | filtre-a-air |
| 34 | filtre_carburant_replacement | 9 | filtre-a-carburant |
| 35 | filtre_habitacle_replacement | 424 | filtre-d-habitacle |
| 36 | bougie_allumage_replacement | 686 | bougie-d-allumage |
| 37 | injecteur_nettoyage | 3902 | injecteur |
| 38 | recharge_clim | 447 | compresseur-de-climatisation |
| 39 | filtre_habitacle_clim | 424 | filtre-d-habitacle |
| 40 | soufflet_cardan_replacement | 193 | soufflet-de-cardan |
| 41 | controle_eclairage | 1457 | ampoule |

## Inventaire des 19 intervalles actifs

| Alias KG | UUID | km | mois |
|---|---|---:|---:|
| amortisseur | 9adb388f-39ec-4fc3-8bb1-b219a00a48b4 | 90000 | 72 |
| batterie | 1abaebe6-8496-493a-8b8c-8a9be0dadf75 | null | 60 |
| bougies-essence | 15630ba3-9ec4-4ba7-98dd-2585cea52337 | 60000 | null |
| bougies-prechauffage | e8a9f475-542f-4be0-ad0b-b0e3581d6540 | 100000 | null |
| controle-freinage | 31481b76-d2bd-44d3-8743-06895b94738b | 20000 | 12 |
| distribution | 789ca78e-46de-4f3b-9160-2f58a89fa4cd | 120000 | 72 |
| filtre-air | 493f4c66-a95c-4be8-9355-6060b6a83e0b | 30000 | 24 |
| filtre-habitacle | 20762eec-ab2c-4009-87e6-ddd2acf328a3 | 15000 | 12 |
| filtre-huile | 27ed8c7f-2a0b-4cb6-87d5-70267f6f4d9b | 15000 | 12 |
| liquide-frein | ba300db8-d1ba-40fc-af31-77101ce06c7d | null | 24 |
| liquide-refroidissement | 9a24dfa8-c368-4dd1-97a1-f75bfde51b2a | 60000 | 48 |
| pneu | bbf2a05e-954d-4df6-ba97-a7bc03513bfc | 45000 | 60 |
| recharge-clim | 5275357d-3b63-4e27-a533-1250075d6eb8 | null | 24 |
| remplacement-disques-frein-avant | 58140117-0cc9-4b76-a144-7a358366b96a | 70000 | null |
| remplacement-plaquettes-frein-avant | b8df2110-e874-4027-bae6-d22cf81ec4ef | 40000 | null |
| vidange-bva | eaabfe33-7210-404c-aedd-1225d42e2929 | 60000 | null |
| vidange-bvm | b7048a36-48a4-4f7c-8146-2bdee2733e0f | 60000 | null |
| vidange-diesel | fb3272bb-f7a7-42ab-9915-a674fdbaf8af | 20000 | 24 |
| vidange-essence | 2856a3a4-46f3-4bd5-883c-78a58c0dfe3b | 15000 | 12 |

## Décision d'intégration

Conserver les identifiants et historiques des opérations du parcours entretien dans leur source existante. Pour le calendrier KG, afficher ses intervalles génériques sans déduire un historique personnalisé en joignant ces deux ensembles. Une unification future exigerait des liens explicites validés et une politique pour les relations une-à-plusieurs ; aucune correspondance constructeur n'a été inventée ici.
