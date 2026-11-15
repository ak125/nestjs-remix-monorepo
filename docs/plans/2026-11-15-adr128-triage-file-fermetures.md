# Fermetures décidées sur le triage de la file (ADR-128 D6)

Liste des 165 lignes « fermer » de `docs/plans/2026-11-15-adr128-triage-file.md`, fermées sur décision de l'owner du
2026-11-15 (section « Décision de l'owner » du plan). #745 en est exclue : elle reste ouverte,
reçoit `dept:07-seo` et un commentaire.

Ce document se lit ; il ne s'exécute pas. Les commandes sont produites par
`scripts/ops/triage-file-apply.sh`, à blanc par défaut, et lancées par l'owner avec `--apply`.
Chaque fermeture porte le commentaire « Fermeture décidée par l’owner le 2026-11-15 sur le
triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne N. Preuve : … », où N et la preuve sont ceux de
la ligne du plan.

- Ordre : les doublons (#1037 et #1063, `--duplicate-of 1113`) d'abord, puis les autres
  fermetures, #1113 comprise.
- Raison : `completed` pour les lignes « fermer (résolue) » ; `not planned` pour les instantanés
  remplacés et les rapports sans reste à faire.
- Le script ignore et liste une issue fermée ou modifiée depuis le relevé du
  2026-11-15T12:10:47Z.
- Retour arrière : `gh issue reopen <n> --repo ak125/nestjs-remix-monorepo`.

## Décompte

| Famille | Fermetures | forte | moyenne | faible |
|---|---|---|---|---|
| digest du matin | 131 | 131 | 0 | 0 |
| bilan hebdomadaire des PR | 25 | 0 | 25 | 0 |
| autre | 9 | 4 | 4 | 1 |
| **Total** | **165** | **135** | **29** | **1** |

La confiance est celle du classement par département. Pour les bilans hebdomadaires, elle porte
sur le département (23 ou 02), pas sur la fermeture : chaque bilan est remplacé par #1975.

## Confiance forte

### digest du matin (131)

| Issue | Ligne du plan | Confiance | Fermeture | Titre |
|---|---|---|---|---|
| #587 | 124 | forte | `--reason "not planned"` | Morning health digest — 2026-05-18 |
| #619 | 127 | forte | `--reason "not planned"` | Morning health digest — 2026-05-19 |
| #651 | 129 | forte | `--reason "not planned"` | Morning health digest — 2026-05-20 |
| #666 | 130 | forte | `--reason "not planned"` | Morning health digest — 2026-05-21 |
| #688 | 131 | forte | `--reason "not planned"` | Morning health digest — 2026-05-22 |
| #742 | 132 | forte | `--reason "not planned"` | Morning health digest — 2026-05-25 |
| #760 | 136 | forte | `--reason "not planned"` | Morning health digest — 2026-05-26 |
| #767 | 137 | forte | `--reason "not planned"` | Morning health digest — 2026-05-27 |
| #777 | 138 | forte | `--reason "not planned"` | Morning health digest — 2026-05-28 |
| #790 | 140 | forte | `--reason "not planned"` | Morning health digest — 2026-05-29 |
| #807 | 141 | forte | `--reason "not planned"` | Morning health digest — 2026-06-01 |
| #818 | 143 | forte | `--reason "not planned"` | Morning health digest — 2026-06-02 |
| #829 | 144 | forte | `--reason "not planned"` | Morning health digest — 2026-06-03 |
| #843 | 145 | forte | `--reason "not planned"` | Morning health digest — 2026-06-04 |
| #859 | 146 | forte | `--reason "not planned"` | Morning health digest — 2026-06-05 |
| #894 | 147 | forte | `--reason "not planned"` | Morning health digest — 2026-06-08 |
| #912 | 149 | forte | `--reason "not planned"` | Morning health digest — 2026-06-09 |
| #914 | 150 | forte | `--reason "not planned"` | Morning health digest — 2026-06-10 |
| #933 | 151 | forte | `--reason "not planned"` | Morning health digest — 2026-06-11 |
| #944 | 152 | forte | `--reason "not planned"` | Morning health digest — 2026-06-12 |
| #985 | 153 | forte | `--reason "not planned"` | Morning health digest — 2026-06-15 |
| #999 | 155 | forte | `--reason "not planned"` | Morning health digest — 2026-06-16 |
| #1011 | 156 | forte | `--reason "not planned"` | Morning health digest — 2026-06-17 |
| #1023 | 157 | forte | `--reason "not planned"` | Morning health digest — 2026-06-18 |
| #1027 | 158 | forte | `--reason "not planned"` | Morning health digest — 2026-06-19 |
| #1095 | 161 | forte | `--reason "not planned"` | Morning health digest — 2026-06-22 |
| #1112 | 163 | forte | `--reason "not planned"` | Morning health digest — 2026-06-23 |
| #1127 | 165 | forte | `--reason "not planned"` | Morning health digest — 2026-06-24 |
| #1137 | 166 | forte | `--reason "not planned"` | Morning health digest — 2026-06-25 |
| #1155 | 167 | forte | `--reason "not planned"` | Morning health digest — 2026-06-26 |
| #1191 | 168 | forte | `--reason "not planned"` | Morning health digest — 2026-06-29 |
| #1193 | 170 | forte | `--reason "not planned"` | Morning health digest — 2026-06-30 |
| #1194 | 171 | forte | `--reason "not planned"` | Morning health digest — 2026-07-01 |
| #1204 | 172 | forte | `--reason "not planned"` | Morning health digest — 2026-07-02 |
| #1210 | 173 | forte | `--reason "not planned"` | Morning health digest — 2026-07-03 |
| #1235 | 174 | forte | `--reason "not planned"` | Morning health digest — 2026-07-06 |
| #1239 | 176 | forte | `--reason "not planned"` | Morning health digest — 2026-07-07 |
| #1241 | 177 | forte | `--reason "not planned"` | Morning health digest — 2026-07-08 |
| #1245 | 178 | forte | `--reason "not planned"` | Morning health digest — 2026-07-09 |
| #1246 | 179 | forte | `--reason "not planned"` | Morning health digest — 2026-07-10 |
| #1247 | 180 | forte | `--reason "not planned"` | Morning health digest — 2026-07-13 |
| #1262 | 182 | forte | `--reason "not planned"` | Morning health digest — 2026-07-14 |
| #1279 | 183 | forte | `--reason "not planned"` | Morning health digest — 2026-07-15 |
| #1287 | 184 | forte | `--reason "not planned"` | Morning health digest — 2026-07-16 |
| #1291 | 185 | forte | `--reason "not planned"` | Morning health digest — 2026-07-17 |
| #1310 | 186 | forte | `--reason "not planned"` | Morning health digest — 2026-07-20 |
| #1312 | 188 | forte | `--reason "not planned"` | Morning health digest — 2026-07-21 |
| #1313 | 189 | forte | `--reason "not planned"` | Morning health digest — 2026-07-22 |
| #1314 | 190 | forte | `--reason "not planned"` | Morning health digest — 2026-07-23 |
| #1315 | 191 | forte | `--reason "not planned"` | Morning health digest — 2026-07-24 |
| #1320 | 192 | forte | `--reason "not planned"` | Morning health digest — 2026-07-27 |
| #1322 | 194 | forte | `--reason "not planned"` | Morning health digest — 2026-07-28 |
| #1323 | 195 | forte | `--reason "not planned"` | Morning health digest — 2026-07-29 |
| #1325 | 196 | forte | `--reason "not planned"` | Morning health digest — 2026-07-30 |
| #1326 | 197 | forte | `--reason "not planned"` | Morning health digest — 2026-07-31 |
| #1330 | 198 | forte | `--reason "not planned"` | Morning health digest — 2026-08-03 |
| #1333 | 200 | forte | `--reason "not planned"` | Morning health digest — 2026-08-04 |
| #1334 | 201 | forte | `--reason "not planned"` | Morning health digest — 2026-08-05 |
| #1336 | 202 | forte | `--reason "not planned"` | Morning health digest — 2026-08-06 |
| #1337 | 203 | forte | `--reason "not planned"` | Morning health digest — 2026-08-07 |
| #1340 | 204 | forte | `--reason "not planned"` | Morning health digest — 2026-08-10 |
| #1343 | 206 | forte | `--reason "not planned"` | Morning health digest — 2026-08-11 |
| #1345 | 207 | forte | `--reason "not planned"` | Morning health digest — 2026-08-12 |
| #1346 | 208 | forte | `--reason "not planned"` | Morning health digest — 2026-08-13 |
| #1351 | 209 | forte | `--reason "not planned"` | Morning health digest — 2026-08-14 |
| #1356 | 210 | forte | `--reason "not planned"` | Morning health digest — 2026-08-17 |
| #1359 | 212 | forte | `--reason "not planned"` | Morning health digest — 2026-08-18 |
| #1360 | 213 | forte | `--reason "not planned"` | Morning health digest — 2026-08-19 |
| #1361 | 214 | forte | `--reason "not planned"` | Morning health digest — 2026-08-20 |
| #1362 | 215 | forte | `--reason "not planned"` | Morning health digest — 2026-08-21 |
| #1363 | 216 | forte | `--reason "not planned"` | Morning health digest — 2026-08-24 |
| #1365 | 218 | forte | `--reason "not planned"` | Morning health digest — 2026-08-25 |
| #1366 | 219 | forte | `--reason "not planned"` | Morning health digest — 2026-08-26 |
| #1367 | 220 | forte | `--reason "not planned"` | Morning health digest — 2026-08-27 |
| #1368 | 221 | forte | `--reason "not planned"` | Morning health digest — 2026-08-28 |
| #1369 | 222 | forte | `--reason "not planned"` | Morning health digest — 2026-08-31 |
| #1372 | 224 | forte | `--reason "not planned"` | Morning health digest — 2026-09-01 |
| #1381 | 225 | forte | `--reason "not planned"` | Morning health digest — 2026-09-02 |
| #1386 | 226 | forte | `--reason "not planned"` | Morning health digest — 2026-09-03 |
| #1394 | 227 | forte | `--reason "not planned"` | Morning health digest — 2026-09-04 |
| #1402 | 228 | forte | `--reason "not planned"` | Morning health digest — 2026-09-07 |
| #1415 | 230 | forte | `--reason "not planned"` | Morning health digest — 2026-09-08 |
| #1420 | 231 | forte | `--reason "not planned"` | Morning health digest — 2026-09-09 |
| #1435 | 232 | forte | `--reason "not planned"` | Morning health digest — 2026-09-10 |
| #1449 | 233 | forte | `--reason "not planned"` | Morning health digest — 2026-09-11 |
| #1487 | 234 | forte | `--reason "not planned"` | Morning health digest — 2026-09-14 |
| #1489 | 236 | forte | `--reason "not planned"` | Morning health digest — 2026-09-15 |
| #1490 | 237 | forte | `--reason "not planned"` | Morning health digest — 2026-09-16 |
| #1501 | 238 | forte | `--reason "not planned"` | Morning health digest — 2026-09-17 |
| #1517 | 239 | forte | `--reason "not planned"` | Morning health digest — 2026-09-18 |
| #1525 | 240 | forte | `--reason "not planned"` | Morning health digest — 2026-09-21 |
| #1527 | 242 | forte | `--reason "not planned"` | Morning health digest — 2026-09-22 |
| #1528 | 243 | forte | `--reason "not planned"` | Morning health digest — 2026-09-23 |
| #1558 | 244 | forte | `--reason "not planned"` | Morning health digest — 2026-09-24 |
| #1579 | 245 | forte | `--reason "not planned"` | Morning health digest — 2026-09-25 |
| #1583 | 246 | forte | `--reason "not planned"` | Morning health digest — 2026-09-28 |
| #1594 | 248 | forte | `--reason "not planned"` | Morning health digest — 2026-09-29 |
| #1621 | 249 | forte | `--reason "not planned"` | Morning health digest — 2026-09-30 |
| #1653 | 250 | forte | `--reason "not planned"` | Morning health digest — 2026-10-01 |
| #1693 | 251 | forte | `--reason "not planned"` | Morning health digest — 2026-10-02 |
| #1734 | 252 | forte | `--reason "not planned"` | Morning health digest — 2026-10-05 |
| #1739 | 254 | forte | `--reason "not planned"` | Morning health digest — 2026-10-06 |
| #1740 | 255 | forte | `--reason "not planned"` | Morning health digest — 2026-10-07 |
| #1744 | 256 | forte | `--reason "not planned"` | Morning health digest — 2026-10-08 |
| #1746 | 257 | forte | `--reason "not planned"` | Morning health digest — 2026-10-09 |
| #1765 | 258 | forte | `--reason "not planned"` | Morning health digest — 2026-10-12 |
| #1772 | 260 | forte | `--reason "not planned"` | Morning health digest — 2026-10-13 |
| #1781 | 261 | forte | `--reason "not planned"` | Morning health digest — 2026-10-14 |
| #1799 | 262 | forte | `--reason "not planned"` | Morning health digest — 2026-10-15 |
| #1810 | 263 | forte | `--reason "not planned"` | Morning health digest — 2026-10-16 |
| #1836 | 264 | forte | `--reason "not planned"` | Morning health digest — 2026-10-19 |
| #1851 | 266 | forte | `--reason "not planned"` | Morning health digest — 2026-10-20 |
| #1853 | 267 | forte | `--reason "not planned"` | Morning health digest — 2026-10-21 |
| #1864 | 268 | forte | `--reason "not planned"` | Morning health digest — 2026-10-22 |
| #1872 | 269 | forte | `--reason "not planned"` | Morning health digest — 2026-10-23 |
| #1890 | 270 | forte | `--reason "not planned"` | Morning health digest — 2026-10-26 |
| #1903 | 272 | forte | `--reason "not planned"` | Morning health digest — 2026-10-27 |
| #1907 | 273 | forte | `--reason "not planned"` | Morning health digest — 2026-10-28 |
| #1917 | 275 | forte | `--reason "not planned"` | Morning health digest — 2026-10-29 |
| #1923 | 276 | forte | `--reason "not planned"` | Morning health digest — 2026-10-30 |
| #1951 | 278 | forte | `--reason "not planned"` | Morning health digest — 2026-11-02 |
| #1953 | 280 | forte | `--reason "not planned"` | Morning health digest — 2026-11-03 |
| #1955 | 281 | forte | `--reason "not planned"` | Morning health digest — 2026-11-04 |
| #1959 | 282 | forte | `--reason "not planned"` | Morning health digest — 2026-11-05 |
| #1962 | 283 | forte | `--reason "not planned"` | Morning health digest — 2026-11-06 |
| #1971 | 284 | forte | `--reason "not planned"` | Morning health digest — 2026-11-09 |
| #1985 | 286 | forte | `--reason "not planned"` | Morning health digest — 2026-11-10 |
| #2001 | 287 | forte | `--reason "not planned"` | Morning health digest — 2026-11-10 |
| #2002 | 288 | forte | `--reason "not planned"` | Morning health digest — 2026-11-10 |
| #2005 | 289 | forte | `--reason "not planned"` | Morning health digest — 2026-11-11 |
| #2034 | 290 | forte | `--reason "not planned"` | Morning health digest — 2026-11-12 |

### autre (4)

| Issue | Ligne du plan | Confiance | Fermeture | Titre |
|---|---|---|---|---|
| #203 | 112 | forte | `--reason completed` | Soak report PR #190 alias TS — verdict YELLOW (J+1) |
| #439 | 122 | forte | `--reason completed` | ADR-024 promotion blocked at J+14 — données de mesure indisponibles (tooling… |
| #744 | 134 | forte | `--reason completed` | fix(edge): Caddy >Cache-Control replace mode (PROD duplicate header) |
| #1916 | 274 | forte | `--reason completed` | Sitemap regen failed - 2026-10-29 |

## Confiance moyenne ou faible

### bilan hebdomadaire des PR (25)

| Issue | Ligne du plan | Confiance | Fermeture | Titre |
|---|---|---|---|---|
| #588 | 125 | moyenne | `--reason "not planned"` | Weekly PR hygiene W21 — 2026-05-18 (🔀 Rebase cascade (oldest stack first)) |
| #743 | 133 | moyenne | `--reason "not planned"` | Weekly PR hygiene W22 — 2026-05-25 (🔀 Rebase cascade (oldest stack first)) |
| #808 | 142 | moyenne | `--reason "not planned"` | Weekly PR hygiene W23 — 2026-06-01 (🧪 PR-8b-2 cleanup (≤ 5 files)) |
| #895 | 148 | moyenne | `--reason "not planned"` | Weekly PR hygiene W24 — 2026-06-08 (🔀 Rebase cascade (oldest stack first)) |
| #986 | 154 | moyenne | `--reason "not planned"` | Weekly PR hygiene W25 — 2026-06-15 (🔀 Rebase cascade (oldest stack first)) |
| #1099 | 162 | moyenne | `--reason "not planned"` | Weekly PR hygiene W26 — 2026-06-22 (🔀 Rebase cascade (oldest stack first)) |
| #1192 | 169 | moyenne | `--reason "not planned"` | Weekly PR hygiene W27 — 2026-06-29 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… |
| #1236 | 175 | moyenne | `--reason "not planned"` | Weekly PR hygiene W28 — 2026-07-06 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… |
| #1248 | 181 | moyenne | `--reason "not planned"` | Weekly PR hygiene W29 — 2026-07-13 (🔀 Rebase cascade (oldest stack first)) |
| #1311 | 187 | moyenne | `--reason "not planned"` | Weekly PR hygiene W30 — 2026-07-20 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… |
| #1321 | 193 | moyenne | `--reason "not planned"` | Weekly PR hygiene W31 — 2026-07-27 (🧹 Hygiene week — batch-close stale PRs) |
| #1331 | 199 | moyenne | `--reason "not planned"` | Weekly PR hygiene W32 — 2026-08-03 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… |
| #1341 | 205 | moyenne | `--reason "not planned"` | Weekly PR hygiene W33 — 2026-08-10 (🧹 Hygiene week — batch-close stale PRs) |
| #1357 | 211 | moyenne | `--reason "not planned"` | Weekly PR hygiene W34 — 2026-08-17 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… |
| #1364 | 217 | moyenne | `--reason "not planned"` | Weekly PR hygiene W35 — 2026-08-24 (🧹 Hygiene week — batch-close stale PRs) |
| #1370 | 223 | moyenne | `--reason "not planned"` | Weekly PR hygiene W36 — 2026-08-31 (🧹 Hygiene week — batch-close stale PRs) |
| #1403 | 229 | moyenne | `--reason "not planned"` | Weekly PR hygiene W37 — 2026-09-07 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… |
| #1488 | 235 | moyenne | `--reason "not planned"` | Weekly PR hygiene W38 — 2026-09-14 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… |
| #1526 | 241 | moyenne | `--reason "not planned"` | Weekly PR hygiene W39 — 2026-09-21 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… |
| #1585 | 247 | moyenne | `--reason "not planned"` | Weekly PR hygiene W40 — 2026-09-28 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… |
| #1736 | 253 | moyenne | `--reason "not planned"` | Weekly PR hygiene W41 — 2026-10-05 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… |
| #1766 | 259 | moyenne | `--reason "not planned"` | Weekly PR hygiene W42 — 2026-10-12 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… |
| #1843 | 265 | moyenne | `--reason "not planned"` | Weekly PR hygiene W43 — 2026-10-19 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… |
| #1894 | 271 | moyenne | `--reason "not planned"` | Weekly PR hygiene W44 — 2026-10-26 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… |
| #1952 | 279 | moyenne | `--reason "not planned"` | Weekly PR hygiene W45 — 2026-11-02 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… |

### autre (5)

| Issue | Ligne du plan | Confiance | Fermeture | Titre |
|---|---|---|---|---|
| #582 | 123 | faible | `--reason "not planned"` | Closure 2026-05-17 — 4 PRs sitemap/auth/PR-9a MERGED + 13 stales closed (T+0… |
| #650 | 128 | moyenne | `--reason "not planned"` | Closure 2026-05-17 — T+48h SLO digest (verdict: HOLD) |
| #1037 | 159 | moyenne | `--duplicate-of 1113` | PR-2 prereqs monitor — Gate 1 bloqué (vault hors scope session) |
| #1063 | 160 | moyenne | `--duplicate-of 1113` | PR-2 daily monitor: GATE 1 bloquée — governance-vault hors scope session |
| #1113 | 164 | moyenne | `--reason "not planned"` | PR-2 monitor BLOCKED — governance-vault not in session scope (GATE 1 unverifi… |
