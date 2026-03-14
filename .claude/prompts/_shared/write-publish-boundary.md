# WRITE / PUBLISH BOUNDARY (bloc partage)

Le prompt produit un artefact structure.

## Ce que le prompt NE decide JAMAIS

- la publication
- l'indexation
- la promotion
- l'overwrite d'une version existante
- la suppression d'un contenu existant

Ces decisions relevent de G4/G5 et des services de persistance controlee.

## Qui decide

| Decision | Responsable |
|----------|------------|
| Publication | Service de persistance (content-refresh.processor.ts) |
| Indexation | SEO service + sitemap generator |
| Promotion | Service marketing / CMS |
| Overwrite | Validator + human review gate |
| Suppression | Admin gate uniquement |
