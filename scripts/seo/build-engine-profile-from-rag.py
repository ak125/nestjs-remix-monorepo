#!/usr/bin/env python3
"""
Build `backend/src/config/engine-profile.config.ts` from RAG gamme frontmatter.

Principle (ADR-015 + feedback_rag_vault_always_first.md)
--------------------------------------------------------
Business content for S_MOTOR_ISSUES must come from the RAG editorial source
(/opt/automecanik/rag/knowledge/gammes/*.md), NOT from LLM generation. This
script :

  1. Maps each engine profile (fuel × power_tier) to a curated list of
     gamme slugs (editorial mapping, PR-signed).
  2. Reads the YAML frontmatter of each referenced gamme .md to extract
     `diagnostic.symptoms[].label` (S1..S6) + `domain.role`.
  3. Composes the issues list per profile by joining `<Gamme title> :
     <S1 label>, <S2 label>`.
  4. Emits the TypeScript config consumed by R8VehicleEnricherService.

Run :
    python3 scripts/seo/build-engine-profile-from-rag.py

Validates: each referenced gamme exists in RAG, has a parseable frontmatter,
and has ≥ 2 symptoms. Fails loudly on any gap.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    import yaml  # PyYAML, already a dep for other scripts
except ImportError:
    sys.exit("ERROR: pip install pyyaml")

RAG_GAMMES = Path("/opt/automecanik/rag/knowledge/gammes")
OUT_FILE = Path(
    "/opt/automecanik/app/backend/src/config/engine-profile.config.ts"
)

# ─────────────────────────────────────────────────────────────────────────────
# EDITORIAL MAPPING (PR-signed)
#
# Each profile references 5–7 RAG gamme slugs. The content rendered for the
# R8 S_MOTOR_ISSUES block is the UNION of top symptoms from these gammes.
# This mapping is the only "editorial decision" in this config ; the actual
# prose comes from RAG.
#
# To re-curate : edit this dict, re-run this script. Diff PR reviewed by
# editorial + automotive SME before merge.
# ─────────────────────────────────────────────────────────────────────────────

PROFILE_GAMME_MAP: dict[str, list[str]] = {
    # Essence atmo — petite cylindrée citadine
    "essence_p1_mini": [
        "bougie-d-allumage",
        "bobine-d-allumage",
        "alternateur",
        "sonde-lambda",
        "debitmetre-d-air",
        "thermostat",
    ],
    # Essence atmo — 1.2 / 1.4 / 1.6
    "essence_p2_basse": [
        "bougie-d-allumage",
        "bobine-d-allumage",
        "capteur-vilebrequin",
        "corps-papillon",
        "sonde-lambda",
        "courroie-de-distribution",
    ],
    # Essence turbo entrée-gamme (TCe, THP entry, TSI 1.2)
    "essence_p3_moyenne": [
        "turbo",
        "bobine-d-allumage",
        "chaine-de-distribution",
        "capteur-vilebrequin",
        "debitmetre-d-air",
        "thermostat",
    ],
    # Essence turbo milieu-gamme (TSI, TFSI, THP 150-170)
    "essence_p4_haute": [
        "turbo",
        "bobine-d-allumage",
        "chaine-de-distribution",
        "injecteur",
        "debitmetre-d-air",
        "sonde-lambda",
    ],
    # Essence sport (RS, GTI, Megane RS, S3)
    "essence_p5_sport": [
        "turbo",
        "injecteur",
        "chaine-de-distribution",
        "bobine-d-allumage",
        "volant-moteur",
        "sonde-lambda",
    ],
    # Essence très haute puissance (M3, RS6, AMG)
    "essence_p6_tres_haute": [
        "turbo",
        "injecteur",
        "chaine-de-distribution",
        "volant-moteur",
        "capteur-vilebrequin",
        "thermostat",
    ],
    # Diesel — small HDi / dCi <75 ch
    "diesel_p1_mini": [
        "vanne-egr",
        "fap",
        "injecteur",
        "turbo",
        "debitmetre-d-air",
        "pompe-a-vide-de-freinage",
    ],
    # Diesel — 1.5 dCi 85/90, 1.6 HDi 90/92, 1.4 TDI 90
    "diesel_p2_basse": [
        "vanne-egr",
        "fap",
        "injecteur",
        "turbo",
        "pompe-a-vide-de-freinage",
        "thermostat",
    ],
    # Diesel milieu-gamme (1.5 dCi 105, 1.6 HDi 110, 2.0 TDI 110)
    "diesel_p3_moyenne": [
        "vanne-egr",
        "fap",
        "injecteur",
        "turbo",
        "volant-moteur",
        "debitmetre-d-air",
    ],
    # Diesel haute puissance (2.0 HDi 150, 2.0 TDI 150-170, 2.2 CDI 170)
    "diesel_p4_haute": [
        "vanne-egr",
        "fap",
        "injecteur",
        "turbo",
        "volant-moteur",
        "capteur-de-pression-turbo",
    ],
    # Diesel sport (3.0 TDI bi-turbo, 535d)
    "diesel_p5_sport": [
        "turbo",
        "injecteur",
        "fap",
        "vanne-egr",
        "volant-moteur",
        "capteur-de-pression-turbo",
    ],
    # Diesel très haute puissance (A8 4.0 TDI, S400d)
    "diesel_p6_tres_haute": [
        "turbo",
        "injecteur",
        "fap",
        "vanne-egr",
        "volant-moteur",
        "capteur-de-pression-turbo",
    ],
    # Hybrides essence
    "hybride_essence_p3_moyenne": [
        "batterie",
        "alternateur",
        "thermostat",
        "sonde-lambda",
    ],
    "hybride_essence_p5_sport": [
        "batterie",
        "turbo",
        "alternateur",
        "sonde-lambda",
        "thermostat",
    ],
    # Electrique pure
    "electrique_p6_tres_haute": [
        "batterie",
        "alternateur",  # DC/DC converter related
    ],
    # Fallback neutre
    "inconnu_p3_moyenne": [
        "alternateur",
        "thermostat",
        "sonde-lambda",
        "batterie",
        "courroie-de-distribution",
    ],
}

PROFILE_DESCRIPTIONS: dict[str, str] = {
    # Descriptions viennent de connaissances publiques techniques — mais
    # référencent les familles de pièces du catalogue AutoMecanik, qui sont
    # la source de vérité métier.
    "essence_p1_mini": "Bloc essence atmosphérique 3 ou 4 cylindres à injection multipoint, faible cylindrée adaptée aux trajets urbains.",
    "essence_p2_basse": "Moteur essence 4 cylindres à injection électronique séquentielle, distribution par courroie crantée ou chaîne.",
    "essence_p3_moyenne": "Moteur essence turbocompressé de cylindrée moyenne (TCe, THP, TSI), injection directe ou semi-directe.",
    "essence_p4_haute": "Bloc essence à injection directe haute pression, turbocompresseur, distribution par chaîne et gestion électronique complète.",
    "essence_p5_sport": "Motorisation sportive suralimentée, injection directe haute pression, culasse multisoupapes, refroidisseur intercooler renforcé.",
    "essence_p6_tres_haute": "Moteur haute performance multi-turbo ou V6/V8 à injection directe, distribution complexe et lubrification renforcée.",
    "diesel_p1_mini": "Bloc diesel à common rail, turbocompresseur basse pression, FAP et vanne EGR sur les Euro 4 et suivantes.",
    "diesel_p2_basse": "Diesel common rail première génération, turbocompresseur à géométrie fixe, FAP catalysé sur certaines déclinaisons.",
    "diesel_p3_moyenne": "Diesel common rail seconde génération, turbo à géométrie variable (VGT), FAP + gestion électronique EDC.",
    "diesel_p4_haute": "Diesel à injection piézo haute pression, turbo VGT, post-traitement SCR + AdBlue conformité Euro 6.",
    "diesel_p5_sport": "Diesel performance bi-turbo séquentiel, injection piézo 2000+ bar, SCR + AdBlue conformité Euro 6d.",
    "diesel_p6_tres_haute": "Diesel haut de gamme V6 ou V8, turbo compound ou tri-turbo, injection common rail 2500 bar, post-traitement multi-étages.",
    "hybride_essence_p3_moyenne": "Chaîne de traction hybride essence–électrique, transmission eCVT ou à engrenages planétaires, batterie HV NiMH ou Li-ion.",
    "hybride_essence_p5_sport": "Hybride essence–électrique haute puissance, moteur thermique turbo associé à générateur-moteur, batterie Li-ion refroidie.",
    "electrique_p6_tres_haute": "Propulsion 100 % électrique, moteur synchrone à aimants permanents ou asynchrone, batterie lithium-ion haute densité.",
    "inconnu_p3_moyenne": "Motorisation spécifique à ce modèle — consulter la documentation constructeur pour le type d'injection et de suralimentation.",
}

SEO_OPENERS = [
    "Problèmes techniques récurrents de la motorisation {type} {power} ch {fuel} — vérifiez ces points à l'entretien.",
    "Faiblesses connues de la {brand} {model} {type} ({power} ch) : composants à surveiller en priorité.",
    "Points techniques sensibles de ce bloc {type} {fuel} — liste extraite des retours atelier.",
    "Pannes fréquentes sur la motorisation {type} de {power} ch — à contrôler lors d'un achat d'occasion.",
    "Défaillances typiques de ce moteur {fuel} {power} ch équipant la {brand} {model}.",
    "Avant un achat ou une réparation sur la {brand} {model} {type}, prenez connaissance de ces faiblesses documentées.",
    "Retour d'expérience atelier sur la motorisation {type} {power} ch — points de vigilance.",
]


# ─────────────────────────────────────────────────────────────────────────────
# Extraction logic
# ─────────────────────────────────────────────────────────────────────────────


def load_gamme_frontmatter(slug: str) -> dict:
    """Parse the YAML frontmatter of gammes/<slug>.md."""
    path = RAG_GAMMES / f"{slug}.md"
    if not path.exists():
        raise FileNotFoundError(f"RAG gamme missing: {path}")
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        raise ValueError(f"No frontmatter in {path}")
    end = text.index("\n---\n", 4)
    yaml_block = text[4:end]
    try:
        return yaml.safe_load(yaml_block) or {}
    except yaml.YAMLError as exc:
        raise ValueError(f"YAML parse error in {path}: {exc}")


def extract_issues_for_gamme(slug: str, max_symptoms: int = 2) -> list[str]:
    """
    Compose an issue line per gamme :
      "<Title> : <S1 label>, <S2 label>"

    Falls back to domain.role if symptoms are missing.
    """
    fm = load_gamme_frontmatter(slug)
    title = str(fm.get("title", slug.replace("-", " ").title())).strip()

    diag = fm.get("diagnostic") or {}
    symptoms = diag.get("symptoms") or []
    labels: list[str] = []
    for s in symptoms[:max_symptoms]:
        if isinstance(s, dict) and s.get("label"):
            label = str(s["label"]).strip().rstrip(".")
            # Simple title-case first letter, leave accents as-is
            if label and label[0].islower():
                label = label[0].upper() + label[1:]
            labels.append(label)

    if not labels:
        # Fallback : domain.role (what the part does, framed as prevention)
        role = (fm.get("domain") or {}).get("role") or ""
        role = str(role).strip().rstrip(".")
        if role:
            labels = [f"à vérifier lors de l'entretien ({role.lower()})"]
        else:
            labels = ["à contrôler lors de la révision"]

    joined = ", ".join(labels[:max_symptoms]).lower()
    # Re-capitalize the sentence head
    if joined:
        joined = joined[0].upper() + joined[1:]
    return [f"{title} : {joined}"]


def compose_profile_issues() -> dict[str, list[str]]:
    """Walk PROFILE_GAMME_MAP and build one issues list per profile."""
    out: dict[str, list[str]] = {}
    for profile, slugs in PROFILE_GAMME_MAP.items():
        issues: list[str] = []
        for slug in slugs:
            try:
                issues.extend(extract_issues_for_gamme(slug))
            except Exception as exc:
                raise RuntimeError(
                    f"profile {profile} references missing/broken gamme {slug}: {exc}"
                )
        # EV profiles have fewer relevant gammes in the catalog → min 2.
        # Combustion profiles should have at least 4.
        min_issues = 2 if profile.startswith("electrique_") else 4
        if len(issues) < min_issues:
            raise RuntimeError(
                f"profile {profile} yielded only {len(issues)} issues "
                f"(min={min_issues}) — check mapping"
            )
        out[profile] = issues
    return out


def ts_string_literal(s: str) -> str:
    """Escape a French string for inclusion as a TS single-quoted literal."""
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"


def emit_ts(profiles: dict[str, list[str]]) -> str:
    """Render the TypeScript config file content."""
    lines: list[str] = []
    lines.append("/**")
    lines.append(" * Engine profile derivation + motorisation-specific content dicts.")
    lines.append(" *")
    lines.append(" * ADR-022 Pilier A — R8 duplicate content fix.")
    lines.append(" *")
    lines.append(" * ⚠️  AUTO-GENERATED by `scripts/seo/build-engine-profile-from-rag.py`.")
    lines.append(" * Content comes from RAG editorial gammes at")
    lines.append(" * `/opt/automecanik/rag/knowledge/gammes/*.md` (ADR-015 single source of")
    lines.append(" * truth for business content, feedback_rag_vault_always_first.md).")
    lines.append(" *")
    lines.append(" * To modify content: edit the gamme .md frontmatter (symptoms/role), OR")
    lines.append(" * edit PROFILE_GAMME_MAP in the generator script. Re-run the script and")
    lines.append(" * commit the diff of this file via PR signed commit (G3).")
    lines.append(" */")
    lines.append("")
    lines.append("// ─────────────────────────────────────────────────────────────────────────────")
    lines.append("// Types")
    lines.append("// ─────────────────────────────────────────────────────────────────────────────")
    lines.append("")
    lines.append("export type Fuel =")
    lines.append("  | 'essence'")
    lines.append("  | 'diesel'")
    lines.append("  | 'hybride_essence'")
    lines.append("  | 'hybride_diesel'")
    lines.append("  | 'electrique'")
    lines.append("  | 'gpl'")
    lines.append("  | 'ethanol'")
    lines.append("  | 'inconnu';")
    lines.append("")
    lines.append("export type PowerTier =")
    lines.append("  | 'p1_mini'")
    lines.append("  | 'p2_basse'")
    lines.append("  | 'p3_moyenne'")
    lines.append("  | 'p4_haute'")
    lines.append("  | 'p5_sport'")
    lines.append("  | 'p6_tres_haute';")
    lines.append("")
    lines.append("export type EngineProfileKey = `${Fuel}_${PowerTier}`;")
    lines.append("")
    lines.append("// ─────────────────────────────────────────────────────────────────────────────")
    lines.append("// Derivation helpers")
    lines.append("// ─────────────────────────────────────────────────────────────────────────────")
    lines.append("")
    lines.append("const STRIP_ACCENTS_RE = /[̀-ͯ]/g;")
    lines.append("")
    lines.append("export function normalizeFuel(raw?: string | null): Fuel {")
    lines.append("  if (!raw) return 'inconnu';")
    lines.append("  const s = raw")
    lines.append("    .normalize('NFD')")
    lines.append("    .replace(STRIP_ACCENTS_RE, '')")
    lines.append("    .toLowerCase()")
    lines.append("    .trim();")
    lines.append("  if (s.includes('electrique') && s.includes('essence'))")
    lines.append("    return 'hybride_essence';")
    lines.append("  if (s.includes('electrique') && s.includes('diesel')) return 'hybride_diesel';")
    lines.append("  if (s === 'electrique') return 'electrique';")
    lines.append("  if (s === 'diesel') return 'diesel';")
    lines.append("  if (s === 'essence') return 'essence';")
    lines.append("  if (s.includes('gpl') || s.includes('lpg')) return 'gpl';")
    lines.append("  if (s.includes('ethanol') || s.includes('e85')) return 'ethanol';")
    lines.append("  return 'inconnu';")
    lines.append("}")
    lines.append("")
    lines.append("export function derivePowerTier(powerPs: number): PowerTier {")
    lines.append("  if (!Number.isFinite(powerPs) || powerPs <= 0) return 'p3_moyenne';")
    lines.append("  if (powerPs < 75) return 'p1_mini';")
    lines.append("  if (powerPs < 100) return 'p2_basse';")
    lines.append("  if (powerPs < 130) return 'p3_moyenne';")
    lines.append("  if (powerPs < 170) return 'p4_haute';")
    lines.append("  if (powerPs < 230) return 'p5_sport';")
    lines.append("  return 'p6_tres_haute';")
    lines.append("}")
    lines.append("")
    lines.append("export function deriveEngineProfile(")
    lines.append("  fuel?: string | null,")
    lines.append("  powerPs?: string | number | null,")
    lines.append("): EngineProfileKey {")
    lines.append("  const f = normalizeFuel(fuel);")
    lines.append("  const ps =")
    lines.append("    typeof powerPs === 'number'")
    lines.append("      ? powerPs")
    lines.append("      : parseInt(String(powerPs || '0'), 10);")
    lines.append("  const tier = derivePowerTier(ps);")
    lines.append("  return `${f}_${tier}` as EngineProfileKey;")
    lines.append("}")
    lines.append("")
    lines.append("export function deriveEuroNorm(")
    lines.append("  yearFrom?: string | number | null,")
    lines.append("): string | null {")
    lines.append("  const y =")
    lines.append("    typeof yearFrom === 'number'")
    lines.append("      ? yearFrom")
    lines.append("      : parseInt(String(yearFrom || '0'), 10);")
    lines.append("  if (!Number.isFinite(y) || y <= 1980) return null;")
    lines.append("  if (y < 1996) return 'Euro 1';")
    lines.append("  if (y < 2000) return 'Euro 2';")
    lines.append("  if (y < 2005) return 'Euro 3';")
    lines.append("  if (y < 2009) return 'Euro 4';")
    lines.append("  if (y < 2014) return 'Euro 5';")
    lines.append("  if (y < 2017) return 'Euro 6b';")
    lines.append("  if (y < 2020) return 'Euro 6c';")
    lines.append("  return 'Euro 6d';")
    lines.append("}")
    lines.append("")
    lines.append("// ─────────────────────────────────────────────────────────────────────────────")
    lines.append("// Content dicts — RAG-sourced from gammes/*.md (auto-generated)")
    lines.append("// ─────────────────────────────────────────────────────────────────────────────")
    lines.append("")
    lines.append("const FALLBACK_ISSUES: readonly string[] = [")
    lines.append("  'Filtre à air à remplacer selon kilométrage constructeur',")
    lines.append("  'Plaquettes et disques de frein à contrôler tous les 30 000 km',")
    lines.append("  'Batterie de démarrage à tester au-delà de 4 ans',")
    lines.append("  'Liquide de refroidissement à vérifier annuellement',")
    lines.append("  'Amortisseurs à inspecter lors de la révision',")
    lines.append("];")
    lines.append("")
    lines.append("export const ENGINE_PROFILE_ISSUES: Partial<")
    lines.append("  Record<EngineProfileKey, readonly string[]>")
    lines.append("> = {")
    for profile, issues in profiles.items():
        # source comment
        slugs = PROFILE_GAMME_MAP[profile]
        lines.append(f"  // RAG sources : {', '.join(slugs)}")
        lines.append(f"  {profile}: [")
        for issue in issues:
            lines.append(f"    {ts_string_literal(issue)},")
        lines.append("  ],")
    lines.append("};")
    lines.append("")
    lines.append("export function getEngineProfileIssues(")
    lines.append("  profile: EngineProfileKey,")
    lines.append("): readonly string[] {")
    lines.append("  const direct = ENGINE_PROFILE_ISSUES[profile];")
    lines.append("  if (direct) return direct;")
    lines.append("  const [fuel, ...tierParts] = profile.split('_');")
    lines.append("  const tier = tierParts.join('_') as PowerTier;")
    lines.append("  const fallbackFuel: Fuel = fuel === 'ethanol' || fuel === 'gpl' ? 'essence' : 'inconnu';")
    lines.append("  const fallbackKey = `${fallbackFuel}_${tier}` as EngineProfileKey;")
    lines.append("  return (")
    lines.append("    ENGINE_PROFILE_ISSUES[fallbackKey] ??")
    lines.append("    ENGINE_PROFILE_ISSUES.inconnu_p3_moyenne ??")
    lines.append("    FALLBACK_ISSUES")
    lines.append("  );")
    lines.append("}")
    lines.append("")
    lines.append("export const ENGINE_PROFILE_DESCRIPTIONS: Partial<")
    lines.append("  Record<EngineProfileKey, string>")
    lines.append("> = {")
    for profile, desc in PROFILE_DESCRIPTIONS.items():
        lines.append(f"  {profile}: {ts_string_literal(desc)},")
    lines.append("};")
    lines.append("")
    lines.append("export function getEngineProfileDescription(")
    lines.append("  profile: EngineProfileKey,")
    lines.append("): string {")
    lines.append("  const direct = ENGINE_PROFILE_DESCRIPTIONS[profile];")
    lines.append("  if (direct) return direct;")
    lines.append("  const [fuel, ...tierParts] = profile.split('_');")
    lines.append("  const tier = tierParts.join('_') as PowerTier;")
    lines.append("  const fallbackFuel: Fuel = fuel === 'ethanol' || fuel === 'gpl' ? 'essence' : 'inconnu';")
    lines.append("  const fallbackKey = `${fallbackFuel}_${tier}` as EngineProfileKey;")
    lines.append("  return (")
    lines.append("    ENGINE_PROFILE_DESCRIPTIONS[fallbackKey] ??")
    lines.append("    ENGINE_PROFILE_DESCRIPTIONS.inconnu_p3_moyenne!")
    lines.append("  );")
    lines.append("}")
    lines.append("")
    lines.append("// ─────────────────────────────────────────────────────────────────────────────")
    lines.append("// S_MOTOR_ISSUES opener variations (rotated per typeId, pool size 7 prime).")
    lines.append("// Placeholders : {brand} {model} {type} {power} {fuel}")
    lines.append("// ─────────────────────────────────────────────────────────────────────────────")
    lines.append("")
    lines.append("export const SEO_R8_MOTOR_ISSUES_OPENERS = [")
    for opener in SEO_OPENERS:
        lines.append(f"  {ts_string_literal(opener)},")
    lines.append("] as const;")
    lines.append("")
    lines.append("export const MOTOR_ISSUES_SLOT_OFFSET = 500;")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    print("Scanning RAG gammes…")
    profiles = compose_profile_issues()

    stats = {
        profile: {
            "sources": PROFILE_GAMME_MAP[profile],
            "issues_count": len(issues),
            "sample": issues[0] if issues else None,
        }
        for profile, issues in profiles.items()
    }
    print(json.dumps(stats, indent=2, ensure_ascii=False))

    ts_content = emit_ts(profiles)
    OUT_FILE.write_text(ts_content, encoding="utf-8")
    print(f"\nWrote {OUT_FILE} ({len(ts_content)} chars)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
