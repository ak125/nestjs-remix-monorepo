import { z } from "zod";

/**
 * Schema version for the Repository Control Plane registry.
 *
 * SemVer strict — bump rules per ADR-058 §4 Schema Evolution Policy :
 * - Patch (clarification, doc, typo) : aucune notice.
 * - Minor (ajout champ optionnel, nouvelle enum value backward-compat) :
 *   30 jours notice via vault MOC-Repository-Control-Plane.md.
 * - Major (champ obligatoire, enum value retirée, restructure) : ADR dédié +
 *   60 jours sunset + migration scripts (outillage formel = V1.5+).
 */
export const SchemaVersion = "1.0.0" as const;

export const SchemaVersionSchema = z.literal(SchemaVersion);
