# SEO Content Enrichment - Task Summary

## Objective
Enrich R4 Reference and R5 Diagnostic generators with real content from RAG knowledge files.

## Files Modified

### 1. `/opt/automecanik/app/backend/src/modules/seo/services/reference.service.ts`

**Changes:**
- Added imports: `import * as fs from 'fs'` and `import * as path from 'path'`
- Added constant: `RAG_GAMMES_DIR = '/opt/automecanik/rag/knowledge/gammes'`
- Added method: `parseRagGammeFile(pgAlias: string)` to parse RAG markdown files
- Enhanced `generateFromGammes()` to:
  - Read RAG files for each gamme
  - Extract `role_summary`, `must_be_true`, `must_not_contain_concepts`, `symptoms`, `diagnostic_tree`
  - Build enriched content HTML from RAG data
  - Look up related R5 diagnostics for cross-linking
  - Populate fields: `definition`, `role_mecanique`, `confusions_courantes`, `symptomes_associes`, `regles_metier`, `content_html`, `related_references`

**RAG Parsing Logic:**
- Parses YAML frontmatter from markdown files
- Tries multiple filename patterns: `{pg_alias}.md`, `{pg_alias with spaces}.md`
- Extracts structured data using regex patterns
- Handles missing files gracefully (returns null)

**Example Output:**
```typescript
{
  slug: 'alternateur',
  title: 'Alternateur : Définition, rôle et composition',
  meta_description: 'Alternateur: Recharger la batterie et alimenter les équipements électriques du véhicule moteur tournant. Guide complet.',
  definition: 'Le alternateur recharger la batterie et alimenter les équipements électriques du véhicule moteur tournant. C\'est une pièce essentielle du système automobile.',
  role_mecanique: 'Recharger la batterie et alimenter les équipements électriques du véhicule moteur tournant',
  confusions_courantes: ['demarrage', 'demarreur', 'lancer le moteur'],
  symptomes_associes: ['Voyant batterie allume moteur tournant', 'Batterie qui se decharge'],
  regles_metier: ['recharger', 'alimenter', 'fournir du courant'],
  content_html: '<div class="reference-content">...</div>',
  related_references: [123, 456]
}
```

### 2. `/opt/automecanik/app/backend/src/modules/seo/services/diagnostic.service.ts`

**Changes:**
- Added imports: `import * as fs from 'fs'` and `import * as path from 'path'`
- Added constant: `RAG_DIAGNOSTIC_DIR = '/opt/automecanik/rag/knowledge/diagnostic'`
- Added method: `parseRagDiagnosticFile(pgAlias: string)` to parse RAG diagnostic markdown
- Added method: `estimateRepairCosts(pgAlias: string)` to provide cost estimates
- Modified `generateFromTemplates()` to:
  - Fetch ALL gammes (not just 10 hardcoded ones)
  - Log the total number of gammes being processed
- Enhanced `generateDiagnosticsForGammes()` to:
  - Parse RAG diagnostic files for symptoms and causes
  - Look up related R4 references for cross-linking
  - Build recommended actions from RAG causes data
  - Estimate repair costs based on gamme type
  - Populate fields: `symptom_description`, `sign_description`, `related_references`, `recommended_actions`, `estimated_repair_cost_min/max`, `estimated_repair_duration`

**RAG Parsing Logic (Diagnostics):**
- Parses markdown files with symptom/cause structure
- Tries multiple filename patterns: `{pg_alias}.md`, `bruits-{pg_alias}.md`
- Extracts symptoms: label, when, characteristic
- Extracts causes: name, probability, solution, urgency
- Uses regex to match markdown sections with bullet points

**Cost Estimation:**
- Maps gamme types to repair cost ranges (min/max)
- Includes duration estimates (e.g., '3-5h')
- Covers 12 common gamme types (embrayage, freinage, distribution, etc.)
- Default fallback: 80-400€, 1-3h

**Example Output:**
```typescript
{
  slug: 'bruit-alternateur',
  title: 'Bruit de alternateur: causes et solutions',
  meta_description: 'Diagnostic bruit alternateur: symptômes, causes, solutions. Guide complet par AutoMecanik.',
  symptom_description: '<p><strong>Grincement aigu</strong> — Au freinage. Son métallique aigu.</p>',
  sign_description: '<p><strong>Plaquettes usées</strong> (probabilité: 70%) — Remplacement des plaquettes.</p>',
  related_references: ['alternateur'],
  recommended_actions: [
    { action: 'Remplacement des plaquettes', urgency: 'high', skill_level: 'professional', duration: '1-2h' }
  ],
  estimated_repair_cost_min: 200,
  estimated_repair_cost_max: 500,
  estimated_repair_duration: '1-3h'
}
```

## RAG Knowledge Structure

### Gamme Files (`/opt/automecanik/rag/knowledge/gammes/`)
- 230+ markdown files with YAML frontmatter
- Structure: title, slug, mechanical_rules (role_summary, must_be_true, must_not_contain_concepts), symptoms, diagnostic_tree
- Example: `alternateur.md`, `kit-d-embrayage.md`

### Diagnostic Files (`/opt/automecanik/rag/knowledge/diagnostic/`)
- ~20 markdown files with structured diagnostic data
- Structure: symptoms (with Quand/Caractéristique), causes (with Probabilité/Solution/Urgence)
- Example: `bruits-freinage.md`, `amortisseurs.md`

## Testing Recommendations

1. **Test R4 Generation:**
```bash
curl -X POST http://localhost:3000/api/seo/reference/generate
```

2. **Test R5 Generation:**
```bash
curl -X POST http://localhost:3000/api/seo/diagnostic/generate
```

3. **Verify RAG Parsing:**
```bash
# Check if files exist
ls -la /opt/automecanik/rag/knowledge/gammes/ | head -20
ls -la /opt/automecanik/rag/knowledge/diagnostic/ | head -20

# Test parsing logic by checking generated entries
curl http://localhost:3000/api/seo/reference/alternateur
curl http://localhost:3000/api/seo/diagnostic/bruit-alternateur
```

4. **Verify Database Entries:**
```sql
-- Check R4 entries
SELECT slug, title, role_mecanique, confusions_courantes, symptomes_associes
FROM __seo_reference
WHERE is_published = false
LIMIT 5;

-- Check R5 entries
SELECT slug, title, estimated_repair_cost_min, estimated_repair_cost_max,
       recommended_actions
FROM __seo_observable
WHERE is_published = false
LIMIT 5;
```

## Benefits

1. **Richer Content:** Real mechanical knowledge instead of placeholder text
2. **Cross-Linking:** Automatic R4↔R5 linking for better SEO
3. **Cost Estimates:** Realistic repair cost ranges for user guidance
4. **Recommended Actions:** Actionable next steps from RAG diagnostic data
5. **Scalability:** Now processes ALL gammes (not just 10 hardcoded ones)
6. **SEO Value:** More substantive content = better search rankings

## Important Notes

- All generated entries remain in DRAFT mode (`is_published: false`)
- Manual review required before publishing
- RAG files are read-only (no modifications to knowledge base)
- Graceful handling of missing RAG files (fallback to templates)
- No external dependencies added (uses built-in Node.js `fs` module)
