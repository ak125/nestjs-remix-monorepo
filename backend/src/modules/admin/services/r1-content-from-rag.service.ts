/**
 * R1ContentFromRagService — Génère du contenu éditorial HTML structuré
 * à partir du RAG gamme enrichi (0-LLM, template-based).
 *
 * Produit un sg_content de 3000-7000 chars avec 6 H2 narratifs :
 * 1. Rôle et fonction
 * 2. Types et variantes
 * 3. Qualité, prix et marques
 * 4. Emplacement et remplacement
 * 5. Trouver la bonne référence
 * 6. FAQ
 *
 * Le contenu est construit uniquement à partir des données RAG vérifiées.
 * Pas d'invention, pas de LLM — template pur.
 */

import { Injectable, Logger } from '@nestjs/common';
import { RagGammeReaderService } from './rag-gamme-reader.service';
import type { RagData } from './rag-data.types';

export interface ContentFromRagResult {
  html: string;
  charCount: number;
  h2Count: number;
  ragFieldsUsed: string[];
  quality: 'rich' | 'standard' | 'minimal';
}

@Injectable()
export class R1ContentFromRagService {
  private readonly logger = new Logger(R1ContentFromRagService.name);

  constructor(private readonly ragReader: RagGammeReaderService) {}

  async generate(
    pgAlias: string,
    pgName: string,
    _options?: {
      kw?: Array<{ kw: string; intent: string; vol: string }>;
    },
  ): Promise<ContentFromRagResult> {
    // Virtual merge : fichier .md + docs DB (exploite les 5-12 docs ingérés)
    const mergeResult =
      await this.ragReader.readAndParseWithDbKnowledge(pgAlias);
    const rag = mergeResult?.ragData ?? this.ragReader.readAndParse(pgAlias);
    if (!rag) {
      return {
        html: '',
        charCount: 0,
        h2Count: 0,
        ragFieldsUsed: [],
        quality: 'minimal',
      };
    }

    const n = pgName.toLowerCase();
    const sections: string[] = [];
    const fieldsUsed: string[] = [];

    // ── H2 #1 — Rôle et fonction ──
    const roleSection = this.buildRoleSection(n, pgName, rag, fieldsUsed);
    if (roleSection) sections.push(roleSection);

    // ── H2 #2 — Types et variantes ──
    const typesSection = this.buildTypesSection(n, pgName, rag, fieldsUsed);
    if (typesSection) sections.push(typesSection);

    // ── H2 #3 — Qualité, prix et marques ──
    const priceSection = this.buildPriceSection(n, pgName, rag, fieldsUsed);
    if (priceSection) sections.push(priceSection);

    // ── H2 #4 — Emplacement et remplacement ──
    const locationSection = this.buildLocationSection(
      n,
      pgName,
      rag,
      fieldsUsed,
    );
    if (locationSection) sections.push(locationSection);

    // ── H2 #5 — Trouver la bonne référence ──
    const refSection = this.buildReferenceSection(n, pgName, rag, fieldsUsed);
    if (refSection) sections.push(refSection);

    // ── H2 #6 — FAQ ──
    const faqSection = this.buildFaqSection(n, rag, fieldsUsed);
    if (faqSection) sections.push(faqSection);

    const html = sections.join('\n');
    // Nettoyage : supprimer les artefacts source/attribution qui pourraient fuiter
    const cleanHtml = html
      .replace(/<!-- .*? -->/g, '') // commentaires HTML
      .replace(/\(Source:\s*[^)]+\)/gi, '') // attributions (Source: ...)
      .replace(/\[source:\s*[^\]]+\]/gi, '') // [source: ...]
      .replace(/\n{3,}/g, '\n\n') // espaces multiples
      .trim();

    const h2Count = (cleanHtml.match(/<h2/g) || []).length;
    const charCount = cleanHtml.length;

    const quality =
      charCount > 5000 && h2Count >= 5
        ? 'rich'
        : charCount > 2000
          ? 'standard'
          : 'minimal';

    this.logger.log(
      `[R1-CONTENT] ${pgAlias}: ${charCount} chars, ${h2Count} H2, quality=${quality}, fields=${fieldsUsed.length}`,
    );

    return {
      html: cleanHtml,
      charCount,
      h2Count,
      ragFieldsUsed: fieldsUsed,
      quality,
    };
  }

  private buildRoleSection(
    n: string,
    pgName: string,
    rag: RagData,
    fields: string[],
  ): string | null {
    const role = rag.domain?.role;
    if (!role) return null;
    fields.push('domain.role');

    const mustBeTrue = rag.domain?.must_be_true?.slice(0, 4) ?? [];
    if (mustBeTrue.length > 0) fields.push('domain.must_be_true');

    const interval = rag.maintenance?.interval;
    const intervalText = interval
      ? typeof interval === 'string'
        ? interval
        : `${interval.value ?? ''} ${interval.unit ?? ''}`.trim()
      : null;
    if (intervalText) fields.push('maintenance.interval');

    return `<h2>${pgName} : rôle, fonction et entretien</h2>
<p>Le <strong>${n}</strong> ${role.charAt(0).toLowerCase()}${role.slice(1)}. ${mustBeTrue.length > 0 ? `Ses fonctions principales : ${mustBeTrue.join(', ')}.` : ''}</p>
${intervalText ? `<p>Intervalle de remplacement : <strong>${intervalText}</strong>. Un remplacement régulier protège les organes mécaniques et prolonge la durée de vie du véhicule.</p>` : ''}`;
  }

  private buildTypesSection(
    n: string,
    pgName: string,
    rag: RagData,
    fields: string[],
  ): string | null {
    const variants = rag.variants;
    if (!variants || variants.length === 0) return null;
    fields.push('variants');

    const confusions = rag.domain?.confusion_with ?? [];
    if (confusions.length > 0) fields.push('domain.confusion_with');

    const variantItems = variants
      .slice(0, 4)
      .map((v) => {
        const diffs = v.functional_differences?.slice(0, 2).join(', ') ?? '';
        return `<li><strong>${v.name}</strong>${diffs ? ` — ${diffs}` : ''}</li>`;
      })
      .join('\n');

    const confusionText =
      confusions.length > 0
        ? `<p><strong>Attention :</strong> ne pas confondre le ${n} avec ${confusions.map((c) => c.term.replace(/-/g, ' ')).join(' ou ')}. ${confusions[0].difference}</p>`
        : '';

    return `<h2>Types de ${n} : variantes et différences</h2>
<p>Le choix du type de ${n} dépend de votre véhicule et de son montage. Voici les principales variantes :</p>
<ul>
${variantItems}
</ul>
${confusionText}`;
  }

  private buildPriceSection(
    n: string,
    pgName: string,
    rag: RagData,
    fields: string[],
  ): string | null {
    const costRange = rag.selection?.cost_range;
    const tiers = rag.selection?.quality_tiers ?? [];
    const brands = rag.selection?.brands;

    if (!costRange && tiers.length === 0 && !brands) return null;

    let priceText = '';
    if (costRange?.min != null && costRange?.max != null) {
      priceText = `<p>Le prix d'un ${n} varie de <strong>${costRange.min} € à ${costRange.max} €</strong> selon la marque et le type.${costRange.note ? ` ${costRange.note}` : ''}</p>`;
      fields.push('selection.cost_range');
    }

    let tiersText = '';
    const validTiers = tiers.filter((t) => t.tier && t.description);
    if (validTiers.length > 0) {
      tiersText = validTiers
        .map(
          (t) =>
            `<li><strong>${t.tier}</strong>${t.price_range ? ` (${t.price_range})` : ''} — ${t.description}</li>`,
        )
        .join('\n');
      tiersText = `<ul>\n${tiersText}\n</ul>`;
      fields.push('selection.quality_tiers');
    }

    let brandsText = '';
    if (brands) {
      const allBrands = [
        ...(brands.premium ?? []),
        ...(brands.standard ?? []),
      ].slice(0, 6);
      if (allBrands.length > 0) {
        brandsText = `<p>Marques recommandées : <strong>${allBrands.join(', ')}</strong>.</p>`;
        fields.push('selection.brands');
      }
    }

    return `<h2>${pgName} : qualité, prix et marques</h2>
${priceText}
${tiersText}
${brandsText}`;
  }

  private buildLocationSection(
    n: string,
    pgName: string,
    rag: RagData,
    fields: string[],
  ): string | null {
    const location = rag.location_on_vehicle;
    const wearSigns = rag.maintenance?.wear_signs ?? [];
    const installation = rag.installation;

    if (!location && wearSigns.length === 0 && !installation) return null;

    let locationText = '';
    if (location?.area) {
      locationText = `<p>Le ${n} se situe au niveau du <strong>${location.area}</strong>.${location.access ? ` Accès : ${location.access}.` : ''}${location.adjacent_parts?.length ? ` Pièces adjacentes : ${location.adjacent_parts.slice(0, 3).join(', ')}.` : ''}</p>`;
      fields.push('location_on_vehicle');
    }

    let wearText = '';
    if (wearSigns.length > 0) {
      wearText = `<p><strong>Signes d'usure :</strong></p>\n<ul>\n${wearSigns.map((s) => `<li>${s}</li>`).join('\n')}\n</ul>`;
      fields.push('maintenance.wear_signs');
    }

    let installText = '';
    if (installation?.steps && installation.steps.length > 0) {
      installText = `<p><strong>Remplacement${installation.difficulty ? ` (difficulté : ${installation.difficulty})` : ''} :</strong></p>\n<ol>\n${installation.steps.map((s) => `<li>${s}</li>`).join('\n')}\n</ol>`;
      fields.push('installation');
    }

    return `<h2>Où se trouve le ${n} et quand le remplacer</h2>
${locationText}
${wearText}
${installText}`;
  }

  private buildReferenceSection(
    n: string,
    pgName: string,
    rag: RagData,
    fields: string[],
  ): string | null {
    const criteria = rag.selection?.criteria ?? [];
    const antiMistakes = rag.selection?.anti_mistakes ?? [];

    if (criteria.length === 0 && antiMistakes.length === 0) return null;

    let criteriaText = '';
    if (criteria.length > 0) {
      criteriaText = `<p>Pour commander le bon ${n}, vérifiez :</p>\n<ul>\n${criteria.map((c) => `<li>${c}</li>`).join('\n')}\n</ul>`;
      fields.push('selection.criteria');
    }

    let mistakesText = '';
    if (antiMistakes.length > 0) {
      const cleanMistakes = antiMistakes
        .filter((m) => !m.startsWith('❌'))
        .slice(0, 4);
      if (cleanMistakes.length > 0) {
        mistakesText = `<p><strong>Erreurs à éviter :</strong></p>\n<ul>\n${cleanMistakes.map((m) => `<li>${m}</li>`).join('\n')}\n</ul>`;
        fields.push('selection.anti_mistakes');
      }
    }

    return `<h2>${pgName} : trouver la bonne référence pour votre véhicule</h2>
<p>Sélectionnez votre marque, modèle et motorisation dans le sélecteur ci-dessus pour afficher uniquement les ${n}s compatibles.</p>
${criteriaText}
${mistakesText}`;
  }

  private buildFaqSection(
    n: string,
    rag: RagData,
    fields: string[],
  ): string | null {
    const faqs = rag.rendering?.faq ?? [];
    if (faqs.length === 0) return null;
    fields.push('rendering.faq');

    const faqItems = faqs
      .slice(0, 6)
      .map((f) => `<h3>${f.question}</h3>\n<p>${f.answer}</p>`)
      .join('\n');

    return `<h2>Questions fréquentes sur le ${n}</h2>\n${faqItems}`;
  }
}
