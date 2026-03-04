import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Merge-patch structure for enriching an existing RAG .md file.
 * JSON output from the LLM classifier.
 */
export interface RagMergePatch {
  /** Source reference for attribution (e.g., "BT-110 Da Silva") */
  source_ref: string;
  /** Truth level (L1, L2, L3) */
  truth_level: string;
  /** Items to APPEND to existing YAML array fields */
  yaml_array_appends: Record<string, string[]>;
  /** Enrichments to existing YAML fields (step index → text to append) */
  yaml_field_enrichments: Record<
    string,
    Array<{ key: string; append: string }>
  >;
  /** New YAML blocks to add (key → object) */
  new_yaml_blocks: Record<string, unknown>;
  /** New markdown sections to insert in the body */
  markdown_sections: Array<{
    title: string;
    content: string;
    after?: string;
  }>;
  /** Confidence score 0-100 from the LLM */
  confidence: number;
}

/**
 * PDF → RAG classifier using direct Groq fetch.
 * Zero NestJS module dependency — reads GROQ_API_KEY from env.
 * Context: ONLY internal files (RAG .md + PDF text). No external APIs.
 */
@Injectable()
export class PdfRagClassifierService {
  private readonly logger = new Logger(PdfRagClassifierService.name);
  private readonly RAG_GAMMES_DIR = '/opt/automecanik/rag/knowledge/gammes';
  private readonly GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

  constructor(private readonly config: ConfigService) {}

  /**
   * Classify PDF text into a RAG merge-patch.
   * Calls Groq directly via fetch() — no AiContentModule dependency.
   */
  async classify(
    pdfText: string,
    pgAlias: string,
    truthLevel: string,
    sourceRef: string,
  ): Promise<RagMergePatch> {
    const apiKey = this.config.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      this.logger.log(
        `Pass-through mode: PDF (${pdfText.length} chars) → section markdown pour ${pgAlias}`,
      );
      return this.buildPassthroughPatch(pdfText, sourceRef, truthLevel);
    }
    const model =
      this.config.get<string>('GROQ_MODEL') || 'llama-3.3-70b-versatile';

    // Load existing RAG .md YAML frontmatter as schema reference (internal file only)
    const ragPath = join(this.RAG_GAMMES_DIR, `${pgAlias}.md`);
    let existingYaml = '';
    if (existsSync(ragPath)) {
      const raw = readFileSync(ragPath, 'utf-8');
      const yamlEnd = raw.indexOf('\n---', 4);
      existingYaml =
        yamlEnd > 0 ? raw.substring(0, yamlEnd + 4) : raw.substring(0, 4000);
    }

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(
      pdfText,
      existingYaml,
      pgAlias,
      truthLevel,
      sourceRef,
    );

    this.logger.log(
      `Classifying PDF for ${pgAlias} (${pdfText.length} chars, source: ${sourceRef})`,
    );

    // Direct Groq fetch — zero module dependency
    const res = await fetch(this.GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(
        `Groq API error ${res.status}: ${errBody.substring(0, 200)}`,
      );
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content || '';

    const patch = this.parseResponse(content, sourceRef, truthLevel);

    this.logger.log(
      `Classification done for ${pgAlias}: ${Object.keys(patch.yaml_array_appends).length} array appends, ` +
        `${patch.markdown_sections.length} markdown sections, confidence=${patch.confidence}`,
    );

    return patch;
  }

  private buildSystemPrompt(): string {
    return `Tu es un expert en classification de documents techniques automobiles.
Ta mission : analyser un texte extrait d'un PDF technique et le mapper vers le schema YAML d'un fichier RAG de gamme piece auto (GammeContentContract.v4).

REGLES STRICTES :
- Tu NE generes PAS de contenu nouveau — tu CLASSES uniquement le contenu existant du PDF
- Chaque element classe DOIT etre une paraphrase fidele du PDF, pas une invention
- Tu utilises UNIQUEMENT le schema YAML du fichier RAG existant comme reference
- Tu reponds UNIQUEMENT en JSON valide (pas de markdown, pas de commentaires)

SCHEMA YAML CIBLE (champs principaux) :
- selection.criteria[] : criteres de choix
- selection.anti_mistakes[] : erreurs d'achat a eviter
- diagnostic.symptoms[] : symptomes d'usure
- diagnostic.causes[] : causes de panne
- diagnostic.depose_steps[] : etapes de depose
- diagnostic.tools_required[] : outils necessaires
- diagnostic.quick_checks[] : verifications rapides
- maintenance.good_practices[] : bonnes pratiques entretien
- maintenance.wear_signs[] : signes d'usure
- rendering.faq[] : questions/reponses {q, a}
- warranty_notes : {source, exclusions[], core_return_refusals[]}
- cost_range : {min, max, segments[]}`;
  }

  private buildUserPrompt(
    pdfText: string,
    existingYaml: string,
    pgAlias: string,
    truthLevel: string,
    sourceRef: string,
  ): string {
    const gammeName = pgAlias.replace(/-/g, ' ');

    return `GAMME : ${gammeName}
SOURCE : ${sourceRef} (truth_level: ${truthLevel})

SCHEMA YAML EXISTANT (fichier RAG actuel — NE PAS repeter le contenu deja present) :
\`\`\`yaml
${existingYaml.substring(0, 3000)}
\`\`\`

TEXTE PDF EXTRAIT :
\`\`\`
${pdfText.substring(0, 6000)}
\`\`\`

INSTRUCTIONS :
1. Identifie tout contenu du PDF qui apporte des informations NOUVELLES par rapport au YAML existant
2. Classe chaque information dans le champ YAML cible
3. Ignore le contenu deja present dans le YAML existant (pas de doublons)
4. Pour les procedures (depose_steps), note le numero de l'etape existante a enrichir

Reponds UNIQUEMENT avec ce JSON :
{
  "source_ref": "${sourceRef}",
  "truth_level": "${truthLevel}",
  "yaml_array_appends": {
    "selection.anti_mistakes": ["texte 1", "texte 2"],
    "diagnostic.tools_required": ["outil 1"],
    "maintenance.good_practices": ["pratique 1"]
  },
  "yaml_field_enrichments": {
    "diagnostic.depose_steps": [
      {"key": "step_3", "append": "texte additionnel pour etape 3"}
    ]
  },
  "new_yaml_blocks": {
    "warranty_notes": {"source": "...", "exclusions": [...]}
  },
  "markdown_sections": [
    {"title": "Titre de section", "content": "contenu markdown", "after": "Titre H2 existant"}
  ],
  "confidence": 85
}`;
  }

  /**
   * Build a pass-through patch when no LLM API key is configured.
   * Injects raw PDF text as a markdown section for manual structuring via /rag-ops.
   */
  private buildPassthroughPatch(
    pdfText: string,
    sourceRef: string,
    truthLevel: string,
  ): RagMergePatch {
    const truncated = pdfText.substring(0, 8000);
    const today = new Date().toISOString().split('T')[0];

    return {
      source_ref: sourceRef,
      truth_level: truthLevel,
      yaml_array_appends: {},
      yaml_field_enrichments: {},
      new_yaml_blocks: {},
      markdown_sections: [
        {
          title: `Import PDF ${sourceRef} (${today})`,
          content: truncated,
        },
      ],
      confidence: 50,
    };
  }

  /**
   * Parse the LLM response into a typed RagMergePatch.
   * Handles common LLM output quirks (markdown fences, trailing commas).
   */
  private parseResponse(
    raw: string,
    sourceRef: string,
    truthLevel: string,
  ): RagMergePatch {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

    try {
      const parsed = JSON.parse(cleaned);

      return {
        source_ref: parsed.source_ref || sourceRef,
        truth_level: parsed.truth_level || truthLevel,
        yaml_array_appends: parsed.yaml_array_appends || {},
        yaml_field_enrichments: parsed.yaml_field_enrichments || {},
        new_yaml_blocks: parsed.new_yaml_blocks || {},
        markdown_sections: Array.isArray(parsed.markdown_sections)
          ? parsed.markdown_sections
          : [],
        confidence:
          typeof parsed.confidence === 'number' ? parsed.confidence : 50,
      };
    } catch (err) {
      this.logger.error(
        `Failed to parse LLM classification response: ${err instanceof Error ? err.message : err}`,
      );
      return {
        source_ref: sourceRef,
        truth_level: truthLevel,
        yaml_array_appends: {},
        yaml_field_enrichments: {},
        new_yaml_blocks: {},
        markdown_sections: [],
        confidence: 0,
      };
    }
  }
}
