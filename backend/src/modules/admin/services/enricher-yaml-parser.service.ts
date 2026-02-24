import { Injectable, Logger } from '@nestjs/common';

/**
 * Shared YAML / frontmatter parsing utilities extracted from conseil-enricher
 * and buying-guide-enricher.
 *
 * Duplicated methods consolidated here:
 * - extractFrontmatterBlock  (inline regex in both enrichers, repeated 4+ times)
 * - extractYamlList          (conseil-enricher L581)
 * - parseFrontmatterList     (buying-guide-enricher L962 — simpler variant)
 * - extractYamlFaq           (conseil-enricher L610)
 * - parseFrontmatterFaq      (buying-guide-enricher L986 — uses {question,answer} keys)
 * - parsePageContractYaml    (buying-guide-enricher L1038)
 */
@Injectable()
export class EnricherYamlParser {
  private readonly logger = new Logger(EnricherYamlParser.name);

  /**
   * Extract the raw YAML frontmatter block (between the leading --- delimiters).
   * Returns the inner content (without the --- lines), or null if no frontmatter found.
   *
   * Inline pattern from both enrichers: content.match(/^---\n([\s\S]*?)\n---/)
   */
  extractFrontmatterBlock(content: string): string | null {
    if (!content) return null;
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    return fmMatch ? fmMatch[1] : null;
  }

  /**
   * Extract a YAML list value from a raw frontmatter block (already extracted).
   * Handles indented lists and breaks at sibling keys at the same indent level.
   *
   * Copied from conseil-enricher.service.ts L581 (extractYamlList).
   *
   * @param fm    Raw YAML frontmatter block (content between --- delimiters)
   * @param key   YAML key to look for (e.g. 'symptoms', 'antiMistakes')
   */
  extractYamlList(fm: string, key: string): string[] {
    if (!fm || !key) return [];
    const keyIdx = fm.indexOf(`${key}:`);
    if (keyIdx < 0) return [];

    // Determine indentation of the key itself
    const lineStart = fm.lastIndexOf('\n', keyIdx) + 1;
    const keyIndent = keyIdx - lineStart;

    const afterKey = fm.substring(keyIdx);
    const lines = afterKey.split('\n').slice(1);
    const items: string[] = [];

    for (const line of lines) {
      if (!line.trim()) continue; // skip empty lines

      const m = line.match(/^\s+-\s+['"]?(.+?)['"]?\s*$/);
      if (m) {
        items.push(m[1].trim());
      } else {
        // Non-list line: break if at same or lower indent as the key
        const indent = line.search(/\S/);
        if (indent >= 0 && indent <= keyIndent) {
          break;
        }
      }
    }
    return items;
  }

  /**
   * Simpler variant that also extracts the frontmatter block internally.
   * Breaks on any non-indented line after the list (top-level sibling key).
   *
   * Copied from buying-guide-enricher.service.ts L962 (parseFrontmatterList).
   *
   * @param content  Full file content (including --- delimiters)
   * @param key      YAML key to look for
   */
  parseFrontmatterList(content: string, key: string): string[] {
    if (!content || !key) return [];
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return [];
    const fmBlock = fmMatch[1];
    const keyIdx = fmBlock.indexOf(`${key}:`);
    if (keyIdx < 0) return [];
    const afterKey = fmBlock.substring(keyIdx);
    const lines = afterKey.split('\n').slice(1); // skip the key line itself
    const items: string[] = [];
    for (const line of lines) {
      const m = line.match(/^\s+-\s+(.+)/);
      if (m) {
        items.push(m[1].trim());
      } else if (line.trim() && !line.match(/^\s/)) {
        break; // next top-level key
      }
    }
    return items;
  }

  /**
   * Extract FAQ items from a raw frontmatter block (already extracted).
   * Returns {q, a} pairs. Handles both question-first and answer-first YAML ordering.
   * Matches `question:` or `q:` keys, and `answer:` or `a:` keys.
   *
   * Copied from conseil-enricher.service.ts L610 (extractYamlFaq).
   *
   * @param fm  Raw YAML frontmatter block (content between --- delimiters)
   */
  extractYamlFaq(fm: string): Array<{ q: string; a: string }> {
    if (!fm) return [];
    const faqIdx = fm.indexOf('faq:');
    if (faqIdx < 0) return [];

    // Determine indentation of the faq key
    const lineStart = fm.lastIndexOf('\n', faqIdx) + 1;
    const keyIndent = faqIdx - lineStart;

    const faqs: Array<{ q: string; a: string }> = [];
    const afterFaq = fm.substring(faqIdx);
    const lines = afterFaq.split('\n').slice(1);
    let currentQ = '';
    let currentA = '';
    for (const line of lines) {
      if (!line.trim()) continue;

      // Break if at same or lower indent as the faq key (new sibling key)
      const indent = line.search(/\S/);
      if (indent >= 0 && indent <= keyIndent && !line.trim().startsWith('-')) {
        break;
      }

      const qMatch = line.match(
        /^\s+-?\s*(?:question|q):\s*['"]?(.+?)['"]?\s*$/,
      );
      const aMatch = line.match(/^\s+-?\s*(?:answer|a):\s*['"]?(.+?)['"]?\s*$/);
      if (qMatch) {
        currentQ = qMatch[1].trim();
        // Push pair as soon as both Q and A are available (handles answer-first YAML)
        if (currentQ && currentA) {
          faqs.push({ q: currentQ, a: currentA });
          currentQ = '';
          currentA = '';
        }
      } else if (aMatch) {
        currentA = aMatch[1].trim();
        if (currentQ && currentA) {
          faqs.push({ q: currentQ, a: currentA });
          currentQ = '';
          currentA = '';
        }
      }
    }
    if (currentQ && currentA) {
      faqs.push({ q: currentQ, a: currentA });
    }
    return faqs;
  }

  /**
   * Variant that extracts frontmatter internally and returns {question, answer} pairs
   * (instead of {q, a}). Breaks on any non-indented line after the faq block.
   *
   * Copied from buying-guide-enricher.service.ts L986 (parseFrontmatterFaq).
   *
   * @param content  Full file content (including --- delimiters)
   */
  parseFrontmatterFaq(
    content: string,
  ): Array<{ question: string; answer: string }> {
    if (!content) return [];
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return [];
    const fmBlock = fmMatch[1];
    const faqIdx = fmBlock.indexOf('faq:');
    if (faqIdx < 0) return [];
    const faqs: Array<{ question: string; answer: string }> = [];
    const afterFaq = fmBlock.substring(faqIdx);
    const lines = afterFaq.split('\n').slice(1);
    let currentQ = '';
    let currentA = '';
    for (const line of lines) {
      const qMatch = line.match(/^\s+-?\s*question:\s+(.+)/);
      const aMatch = line.match(/^\s+-?\s*answer:\s+(.+)/);
      if (qMatch) {
        if (currentQ && currentA) {
          faqs.push({ question: currentQ, answer: currentA });
        }
        currentQ = qMatch[1].trim().replace(/^['"]|['"]$/g, '');
        currentA = '';
      } else if (aMatch) {
        currentA = aMatch[1].trim().replace(/^['"]|['"]$/g, '');
      } else if (line.trim() && !line.match(/^\s/)) {
        break; // next top-level key
      }
    }
    if (currentQ && currentA) {
      faqs.push({ question: currentQ, answer: currentA });
    }
    return faqs;
  }

  /**
   * Parse page_contract structured data from YAML frontmatter.
   * Used as fallback when markdown heading extraction yields insufficient results.
   * Extracts antiMistakes, symptoms, howToChoose, diagnosticTree, and arguments.
   *
   * Copied from buying-guide-enricher.service.ts L1038 (parsePageContractYaml).
   *
   * @param content  Full file content (including --- delimiters)
   */
  parsePageContractYaml(content: string): {
    antiMistakes?: string[];
    symptoms?: string[];
    howToChoose?: string;
    diagnosticTree?: Array<{ if: string; then: string }>;
    arguments?: Array<{ title: string; content: string }>;
  } | null {
    if (!content) return null;
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return null;
    const fm = fmMatch[1];

    if (!fm.includes('page_contract:')) return null;

    const result: {
      antiMistakes?: string[];
      symptoms?: string[];
      howToChoose?: string;
      diagnosticTree?: Array<{ if: string; then: string }>;
      arguments?: Array<{ title: string; content: string }>;
    } = {};

    // antiMistakes list
    const antiMistakes = this.parseFrontmatterList(content, 'antiMistakes');
    if (antiMistakes.length > 0) result.antiMistakes = antiMistakes;

    // symptoms list (under page_contract)
    const pcIdx = fm.indexOf('page_contract:');
    if (pcIdx >= 0) {
      const pcBlock = fm.substring(pcIdx);
      const sympIdx = pcBlock.indexOf('symptoms:');
      if (sympIdx >= 0) {
        const afterSymp = pcBlock.substring(sympIdx);
        const lines = afterSymp.split('\n').slice(1);
        const symptoms: string[] = [];
        for (const line of lines) {
          const m = line.match(/^\s+-\s+['"]?(.+?)['"]?\s*$/);
          if (m) {
            symptoms.push(m[1].trim());
          } else if (line.trim() && !line.match(/^\s/)) {
            break;
          }
        }
        if (symptoms.length > 0) result.symptoms = symptoms;
      }
    }

    // howToChoose (inline string, not a list)
    const htcMatch = fm.match(/howToChoose:\s+(.+)$/m);
    if (htcMatch) result.howToChoose = htcMatch[1].trim();

    // diagnostic_tree (top-level, not under page_contract)
    const dtIdx = fm.indexOf('diagnostic_tree:');
    if (dtIdx >= 0) {
      const afterDt = fm.substring(dtIdx);
      const dtLines = afterDt.split('\n').slice(1);
      const nodes: Array<{ if: string; then: string }> = [];
      let curIf = '';
      let curThen = '';
      for (const line of dtLines) {
        const ifM = line.match(/^\s*-?\s*if:\s*(.+)/);
        const thenM = line.match(/^\s+then:\s*(.+)/);
        if (ifM) {
          if (curIf && curThen) nodes.push({ if: curIf, then: curThen });
          curIf = ifM[1].trim();
          curThen = '';
        } else if (thenM) {
          curThen = thenM[1].trim();
        } else if (line.trim() && !line.match(/^\s/) && !line.startsWith('-')) {
          break;
        }
      }
      if (curIf && curThen) nodes.push({ if: curIf, then: curThen });
      if (nodes.length > 0) result.diagnosticTree = nodes;
    }

    // arguments (under page_contract)
    const argIdx = fm.indexOf('arguments:');
    if (argIdx >= 0) {
      const afterArg = fm.substring(argIdx);
      const argLines = afterArg.split('\n').slice(1);
      const args: Array<{ title: string; content: string }> = [];
      let curTitle = '';
      let curContent = '';
      for (const line of argLines) {
        const titleM = line.match(/^\s+title:\s+(.+)/);
        const contentM = line.match(/^\s+content:\s+(.+)/);
        if (titleM) {
          curTitle = titleM[1].trim();
        } else if (contentM) {
          curContent = contentM[1].trim();
          if (curTitle && curContent) {
            args.push({ title: curTitle, content: curContent });
            curTitle = '';
            curContent = '';
          }
        } else if (line.trim() && !line.match(/^\s/) && !line.startsWith('-')) {
          break;
        }
      }
      if (args.length > 0) result.arguments = args;
    }

    return Object.keys(result).length > 0 ? result : null;
  }
}
