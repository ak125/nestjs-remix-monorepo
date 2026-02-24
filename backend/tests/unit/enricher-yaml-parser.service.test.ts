import { EnricherYamlParser } from '../../src/modules/admin/services/enricher-yaml-parser.service';

describe('EnricherYamlParser', () => {
  const svc = new EnricherYamlParser();

  // ── extractFrontmatterBlock ──

  describe('extractFrontmatterBlock', () => {
    it('should return null for empty/falsy input', () => {
      expect(svc.extractFrontmatterBlock('')).toBeNull();
      expect(svc.extractFrontmatterBlock(null as any)).toBeNull();
    });

    it('should extract YAML between --- delimiters', () => {
      const content = '---\ntitle: Test\nauthor: Claude\n---\nBody text';
      expect(svc.extractFrontmatterBlock(content)).toBe('title: Test\nauthor: Claude');
    });

    it('should return null if no frontmatter', () => {
      expect(svc.extractFrontmatterBlock('Just plain text')).toBeNull();
    });

    it('should return null if only one --- delimiter', () => {
      expect(svc.extractFrontmatterBlock('---\nincomplete')).toBeNull();
    });

    it('should handle empty frontmatter', () => {
      expect(svc.extractFrontmatterBlock('---\n\n---\nBody')).toBe('');
    });

    it('should extract multiline YAML content', () => {
      const content = '---\nkey1: val1\nlist:\n  - item1\n  - item2\n---\nContent';
      const result = svc.extractFrontmatterBlock(content);
      expect(result).toContain('key1: val1');
      expect(result).toContain('- item1');
    });
  });

  // ── extractYamlList ──

  describe('extractYamlList', () => {
    it('should return empty array for empty/falsy input', () => {
      expect(svc.extractYamlList('', 'key')).toEqual([]);
      expect(svc.extractYamlList(null as any, 'key')).toEqual([]);
      expect(svc.extractYamlList('content', '')).toEqual([]);
    });

    it('should return empty array if key not found', () => {
      expect(svc.extractYamlList('other: value', 'missing')).toEqual([]);
    });

    it('should extract simple list items', () => {
      const fm = 'symptoms:\n  - Bruit au freinage\n  - Vibrations au volant\n  - Usure irreguliere';
      const result = svc.extractYamlList(fm, 'symptoms');
      expect(result).toEqual(['Bruit au freinage', 'Vibrations au volant', 'Usure irreguliere']);
    });

    it('should strip quotes from list items', () => {
      const fm = "items:\n  - 'quoted item'\n  - \"double quoted\"";
      const result = svc.extractYamlList(fm, 'items');
      expect(result).toEqual(['quoted item', 'double quoted']);
    });

    it('should skip empty lines within list', () => {
      const fm = 'list:\n  - item1\n\n  - item2';
      const result = svc.extractYamlList(fm, 'list');
      expect(result).toEqual(['item1', 'item2']);
    });

    it('should break at sibling key at same indent', () => {
      const fm = 'symptoms:\n  - Symptom 1\n  - Symptom 2\ncauses:\n  - Cause 1';
      const result = svc.extractYamlList(fm, 'symptoms');
      expect(result).toEqual(['Symptom 1', 'Symptom 2']);
    });

    it('should handle nested key (deeper indentation)', () => {
      const fm = '  symptoms:\n    - Nested symptom 1\n    - Nested symptom 2\n  causes:';
      const result = svc.extractYamlList(fm, 'symptoms');
      expect(result).toEqual(['Nested symptom 1', 'Nested symptom 2']);
    });

    it('should return empty array for key with no list items', () => {
      const fm = 'symptoms:\ncauses:\n  - Cause 1';
      const result = svc.extractYamlList(fm, 'symptoms');
      expect(result).toEqual([]);
    });
  });

  // ── parseFrontmatterList ──

  describe('parseFrontmatterList', () => {
    it('should return empty array for empty/falsy input', () => {
      expect(svc.parseFrontmatterList('', 'key')).toEqual([]);
      expect(svc.parseFrontmatterList(null as any, 'key')).toEqual([]);
    });

    it('should return empty array if no frontmatter', () => {
      expect(svc.parseFrontmatterList('plain text', 'key')).toEqual([]);
    });

    it('should return empty array if key not in frontmatter', () => {
      const content = '---\nother: value\n---\nBody';
      expect(svc.parseFrontmatterList(content, 'missing')).toEqual([]);
    });

    it('should extract list from full content', () => {
      const content =
        '---\ntitle: Test\nantiMistakes:\n  - Ne pas melanger marques\n  - Verifier le diametre\n---\nBody';
      const result = svc.parseFrontmatterList(content, 'antiMistakes');
      expect(result).toEqual(['Ne pas melanger marques', 'Verifier le diametre']);
    });

    it('should break at next top-level key', () => {
      const content =
        '---\nlist:\n  - Item 1\n  - Item 2\nnext_key: value\n---\nBody';
      const result = svc.parseFrontmatterList(content, 'list');
      expect(result).toEqual(['Item 1', 'Item 2']);
    });

    it('should handle single item list', () => {
      const content = '---\nlist:\n  - Only item\n---\nBody';
      const result = svc.parseFrontmatterList(content, 'list');
      expect(result).toEqual(['Only item']);
    });

    it('should handle empty list (key present but no items)', () => {
      const content = '---\nlist:\nnext: val\n---\nBody';
      const result = svc.parseFrontmatterList(content, 'list');
      expect(result).toEqual([]);
    });
  });

  // ── extractYamlFaq ──

  describe('extractYamlFaq', () => {
    it('should return empty array for empty/falsy input', () => {
      expect(svc.extractYamlFaq('')).toEqual([]);
      expect(svc.extractYamlFaq(null as any)).toEqual([]);
    });

    it('should return empty array if no faq key', () => {
      expect(svc.extractYamlFaq('title: Test\nauthor: Claude')).toEqual([]);
    });

    it('should extract question-first FAQ pairs', () => {
      const fm = 'faq:\n  - q: Comment choisir ?\n    a: Verifier le diametre\n  - q: Quand changer ?\n    a: Tous les 60000 km';
      const result = svc.extractYamlFaq(fm);
      expect(result).toEqual([
        { q: 'Comment choisir ?', a: 'Verifier le diametre' },
        { q: 'Quand changer ?', a: 'Tous les 60000 km' },
      ]);
    });

    it('should handle answer-first FAQ pairs', () => {
      const fm = 'faq:\n  - a: Reponse ici\n    q: Question ici';
      const result = svc.extractYamlFaq(fm);
      expect(result).toEqual([{ q: 'Question ici', a: 'Reponse ici' }]);
    });

    it('should handle "question:" and "answer:" long keys', () => {
      const fm = 'faq:\n  - question: Long question key\n    answer: Long answer key';
      const result = svc.extractYamlFaq(fm);
      expect(result).toEqual([{ q: 'Long question key', a: 'Long answer key' }]);
    });

    it('should strip quotes from values', () => {
      const fm = "faq:\n  - q: 'Quoted question'\n    a: 'Quoted answer'";
      const result = svc.extractYamlFaq(fm);
      expect(result).toEqual([{ q: 'Quoted question', a: 'Quoted answer' }]);
    });

    it('should break at sibling key', () => {
      const fm = 'faq:\n  - q: Q1\n    a: A1\nnext_key: value';
      const result = svc.extractYamlFaq(fm);
      expect(result).toEqual([{ q: 'Q1', a: 'A1' }]);
    });

    it('should skip empty lines', () => {
      const fm = 'faq:\n  - q: Q1\n\n    a: A1';
      const result = svc.extractYamlFaq(fm);
      expect(result).toEqual([{ q: 'Q1', a: 'A1' }]);
    });

    it('should handle single FAQ pair', () => {
      const fm = 'faq:\n  - q: Only question\n    a: Only answer';
      const result = svc.extractYamlFaq(fm);
      expect(result).toHaveLength(1);
    });

    it('should return empty for FAQ key with no pairs', () => {
      const fm = 'faq:\nnext: value';
      const result = svc.extractYamlFaq(fm);
      expect(result).toEqual([]);
    });
  });

  // ── parseFrontmatterFaq ──

  describe('parseFrontmatterFaq', () => {
    it('should return empty array for empty/falsy input', () => {
      expect(svc.parseFrontmatterFaq('')).toEqual([]);
      expect(svc.parseFrontmatterFaq(null as any)).toEqual([]);
    });

    it('should return empty array if no frontmatter', () => {
      expect(svc.parseFrontmatterFaq('plain text')).toEqual([]);
    });

    it('should return empty array if no faq in frontmatter', () => {
      expect(svc.parseFrontmatterFaq('---\ntitle: Test\n---\nBody')).toEqual([]);
    });

    it('should extract FAQ with {question, answer} keys', () => {
      const content =
        '---\nfaq:\n  - question: Comment choisir son disque ?\n    answer: Verifier le diametre et epaisseur\n  - question: Quand remplacer ?\n    answer: Tous les 60000 km\n---\nBody';
      const result = svc.parseFrontmatterFaq(content);
      expect(result).toEqual([
        { question: 'Comment choisir son disque ?', answer: 'Verifier le diametre et epaisseur' },
        { question: 'Quand remplacer ?', answer: 'Tous les 60000 km' },
      ]);
    });

    it('should strip quotes from values', () => {
      const content =
        "---\nfaq:\n  - question: 'Quoted Q'\n    answer: 'Quoted A'\n---\nBody";
      const result = svc.parseFrontmatterFaq(content);
      expect(result).toEqual([{ question: 'Quoted Q', answer: 'Quoted A' }]);
    });

    it('should break at next top-level key', () => {
      const content =
        '---\nfaq:\n  - question: Q1\n    answer: A1\nnext: val\n---\nBody';
      const result = svc.parseFrontmatterFaq(content);
      expect(result).toEqual([{ question: 'Q1', answer: 'A1' }]);
    });

    it('should handle incomplete pair (missing answer)', () => {
      const content =
        '---\nfaq:\n  - question: Q without answer\n---\nBody';
      const result = svc.parseFrontmatterFaq(content);
      expect(result).toEqual([]);
    });
  });

  // ── parsePageContractYaml ──

  describe('parsePageContractYaml', () => {
    it('should return null for empty/falsy input', () => {
      expect(svc.parsePageContractYaml('')).toBeNull();
      expect(svc.parsePageContractYaml(null as any)).toBeNull();
    });

    it('should return null if no frontmatter', () => {
      expect(svc.parsePageContractYaml('plain text')).toBeNull();
    });

    it('should return null if no page_contract key', () => {
      expect(svc.parsePageContractYaml('---\ntitle: Test\n---\nBody')).toBeNull();
    });

    it('should extract antiMistakes list', () => {
      const content =
        '---\npage_contract:\n  type: guide\nantiMistakes:\n  - Ne pas melanger\n  - Verifier le couple\n---\nBody';
      const result = svc.parsePageContractYaml(content);
      expect(result).not.toBeNull();
      expect(result!.antiMistakes).toEqual(['Ne pas melanger', 'Verifier le couple']);
    });

    it('should extract symptoms under page_contract', () => {
      const content =
        '---\npage_contract:\n  symptoms:\n    - Bruit metallique\n    - Vibrations\n---\nBody';
      const result = svc.parsePageContractYaml(content);
      expect(result).not.toBeNull();
      expect(result!.symptoms).toEqual(['Bruit metallique', 'Vibrations']);
    });

    it('should extract howToChoose inline string', () => {
      const content =
        '---\npage_contract:\n  howToChoose: Comparer diametre et epaisseur\n---\nBody';
      const result = svc.parsePageContractYaml(content);
      expect(result).not.toBeNull();
      expect(result!.howToChoose).toBe('Comparer diametre et epaisseur');
    });

    it('should extract diagnostic_tree if/then pairs', () => {
      const content =
        '---\npage_contract:\n  type: diagnostic\ndiagnostic_tree:\n  - if: Bruit au freinage\n    then: Verifier plaquettes\n  - if: Vibrations volant\n    then: Verifier disques\n---\nBody';
      const result = svc.parsePageContractYaml(content);
      expect(result).not.toBeNull();
      expect(result!.diagnosticTree).toEqual([
        { if: 'Bruit au freinage', then: 'Verifier plaquettes' },
        { if: 'Vibrations volant', then: 'Verifier disques' },
      ]);
    });

    it('should extract arguments title/content pairs', () => {
      const content =
        '---\npage_contract:\n  arguments:\n    title: Securite\n    content: Le freinage est critique\n---\nBody';
      const result = svc.parsePageContractYaml(content);
      expect(result).not.toBeNull();
      expect(result!.arguments).toEqual([
        { title: 'Securite', content: 'Le freinage est critique' },
      ]);
    });

    it('should extract multiple fields together', () => {
      const content = [
        '---',
        'page_contract:',
        '  howToChoose: Comparer les specs',
        '  symptoms:',
        '    - Bruit',
        '    - Chaleur',
        'antiMistakes:',
        '  - Erreur 1',
        '  - Erreur 2',
        'diagnostic_tree:',
        '  - if: Si X',
        '    then: Alors Y',
        '---',
        'Body',
      ].join('\n');
      const result = svc.parsePageContractYaml(content);
      expect(result).not.toBeNull();
      expect(result!.howToChoose).toBe('Comparer les specs');
      expect(result!.symptoms).toEqual(['Bruit', 'Chaleur']);
      expect(result!.antiMistakes).toEqual(['Erreur 1', 'Erreur 2']);
      expect(result!.diagnosticTree).toEqual([{ if: 'Si X', then: 'Alors Y' }]);
    });

    it('should return null if page_contract exists but no extractable data', () => {
      const content = '---\npage_contract:\n  type: guide\n---\nBody';
      const result = svc.parsePageContractYaml(content);
      expect(result).toBeNull();
    });
  });
});
