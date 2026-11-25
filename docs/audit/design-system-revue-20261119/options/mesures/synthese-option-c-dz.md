| Bouton | Option | Repos (fond / texte : ratio) | Survol | Focus (anneau : ratio anneau/page) | Bouton / page au repos | Désactivé simulé |
|---|---|---|---|---|---|---|
| r2-produit-390 · Ajouter … au panier | A | #F97316 / #0F1E38 : 5.93 | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | 2.8 | #F97316 / #0F1E38 : 5.93 |
| r2-produit-390 · Ajouter … au panier | B | #C2410C / #FFFFFF : 5.18 | #9A3412 / #FFFFFF : 7.31 | 2px solid #0F1E38 : 16.63 | 5.18 | #C2410C / #FFFFFF : 5.18 |
| r2-produit-390 · Ajouter … au panier | C | #1E8449 / #FFFFFF : 4.72 | #196F3D / #FFFFFF : 6.21 | 2px solid #0F1E38 : 16.63 | 4.72 | #1E8449 / #FFFFFF : 4.72 |
| r2-produit-390 · Panier (bouton collant) | A | #F97316 / #0F1E38 : 5.93 | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | 2.8 | #F97316 / #0F1E38 : 5.93 |
| r2-produit-390 · Panier (bouton collant) | B | #C2410C / #FFFFFF : 5.18 | #9A3412 / #FFFFFF : 7.31 | 2px solid #0F1E38 : 16.63 | 5.18 | #C2410C / #FFFFFF : 5.18 |
| r2-produit-390 · Panier (bouton collant) | C | #1E8449 / #FFFFFF : 4.72 | #196F3D / #FFFFFF : 6.21 | 2px solid #0F1E38 : 16.63 | 4.72 | #1E8449 / #FFFFFF : 4.72 |
| r2-produit-1440 · Ajouter … au panier | A | #F97316 / #0F1E38 : 5.93 | #EA580C / #0F1E38 : 4.67 | 2px solid #0F1E38 : 16.63 | 2.8 | #F97316 / #0F1E38 : 5.93 |
| r2-produit-1440 · Ajouter … au panier | B | #C2410C / #FFFFFF : 5.18 | #9A3412 / #FFFFFF : 7.31 | 2px solid #0F1E38 : 16.63 | 5.18 | #C2410C / #FFFFFF : 5.18 |
| r2-produit-1440 · Ajouter … au panier | C | #1E8449 / #FFFFFF : 4.72 | #196F3D / #FFFFFF : 6.21 | 2px solid #0F1E38 : 16.63 | 4.72 | #1E8449 / #FFFFFF : 4.72 |

| Passage | Résidus hors jeu C, repos | Résidus C, survol forcé | Éléments survolés |
|---|---|---|---|
| r2-produit-390 | 0 | 0 | 367 |
| r2-produit-1440 | 0 | 0 | 367 |

| Passage · écran | Verts hors achat, AVANT | Verts hors achat, C | Toute la page, AVANT / C |
|---|---|---|---|
| r2-produit-390 · premier-ecran (défilement 0) | 2 | 1 | 53 / 1 |
| r2-produit-390 · ecran-du-bouton-ajouter (défilement 1079) | 11 | 1 |  |
| r2-produit-1440 · premier-ecran (défilement 0) | 8 | 1 | 56 / 1 |
| r2-produit-1440 · ecran-du-bouton-ajouter (défilement 708) | 16 | 1 |  |

**r2-produit-390, premier écran** (défilement 0 px ; bouton d'achat visible : « Panier ») — 1 élément(s) vert(s) hors bouton d'achat. Capture : [`captures/verts-r2-produit-390-c-premier-ecran-annote.webp`](captures/verts-r2-produit-390-c-premier-ecran-annote.webp)

| N° | Élément | Texte | Couleur(s) verte(s) | Position (x, y, l, h) |
|---|---|---|---|---|
| 1 (achat) | `button` `relative py-3 px-4 bg-orange-500 hover:bg-orange-600 text-bl` | Panier | fond #1E8449 | 16, 738, 109, 50 |
| 2 | `span` `absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full bor` | — | fond #1E8449 | 362, 692, 12, 12 |

**r2-produit-390, premier écran où « Ajouter » est entier** (défilement 1079 px ; bouton d'achat visible : « Ajouter », « Ajouter », « Panier ») — 1 élément(s) vert(s) hors bouton d'achat. Capture : [`captures/verts-r2-produit-390-c-ecran-du-bouton-ajouter-annote.webp`](captures/verts-r2-produit-390-c-ecran-du-bouton-ajouter-annote.webp)

| N° | Élément | Texte | Couleur(s) verte(s) | Position (x, y, l, h) |
|---|---|---|---|---|
| 1 (achat) | `button` `flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[` | Ajouter | fond #1E8449 | 102, 591, 75, 44 |
| 2 (achat) | `button` `flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[` | Ajouter | fond #1E8449 | 289, 591, 75, 44 |
| 3 (achat) | `button` `relative py-3 px-4 bg-orange-500 hover:bg-orange-600 text-bl` | Panier | fond #1E8449 | 16, 738, 109, 50 |
| 4 | `span` `absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full bor` | — | fond #1E8449 | 362, 692, 12, 12 |

**r2-produit-1440, premier écran** (défilement 0 px ; bouton d'achat visible : aucun entièrement visible) — 1 élément(s) vert(s) hors bouton d'achat. Capture : [`captures/verts-r2-produit-1440-c-premier-ecran-annote.webp`](captures/verts-r2-produit-1440-c-premier-ecran-annote.webp)

| N° | Élément | Texte | Couleur(s) verte(s) | Position (x, y, l, h) |
|---|---|---|---|---|
| 1 | `span` `absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full bor` | — | fond #1E8449 | 1404, 820, 12, 12 |

**r2-produit-1440, premier écran où « Ajouter » est entier** (défilement 708 px ; bouton d'achat visible : « Ajouter », « Ajouter », « Ajouter ») — 1 élément(s) vert(s) hors bouton d'achat. Capture : [`captures/verts-r2-produit-1440-c-ecran-du-bouton-ajouter-annote.webp`](captures/verts-r2-produit-1440-c-ecran-du-bouton-ajouter-annote.webp)

| N° | Élément | Texte | Couleur(s) verte(s) | Position (x, y, l, h) |
|---|---|---|---|---|
| 1 (achat) | `button` `flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[` | Ajouter | fond #1E8449 | 625, 630, 98, 44 |
| 2 (achat) | `button` `flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[` | Ajouter | fond #1E8449 | 931, 630, 98, 44 |
| 3 (achat) | `button` `flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[` | Ajouter | fond #1E8449 | 1236, 630, 98, 44 |
| 4 | `span` `absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full bor` | — | fond #1E8449 | 1404, 820, 12, 12 |
