export function detectExtractableTldr(html: string): 0 | 1 {
  const HEAD_WINDOW = 1000;
  const head = html.slice(0, HEAD_WINDOW);
  const pMatch = head.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!pMatch) return 0;
  // Strip nested tags safely (loop until stable). Single-pass `.replace`
  // misses inputs like "<<script>script>" — flagged as
  // js/incomplete-multi-character-sanitization by CodeQL.
  let text = pMatch[1];
  let prev: string;
  do {
    prev = text;
    text = text.replace(/<[^>]+>/g, '');
  } while (text !== prev);
  text = text.trim();
  return text.length >= 50 && text.length <= 200 ? 1 : 0;
}

export function detectFaqSchema(html: string): 0 | 1 {
  const ldRegex =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = ldRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (hasFaqPage(parsed)) return 1;
    } catch {
      // ignore invalid JSON-LD
    }
  }
  return 0;
}

function hasFaqPage(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(hasFaqPage);
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (obj['@type'] === 'FAQPage') return true;
    if (obj['@graph']) return hasFaqPage(obj['@graph']);
  }
  return false;
}

export function detectVisibleSources(html: string, ownHostname: string): 0 | 1 {
  const stripped = html
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '');
  const aRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = aRegex.exec(stripped)) !== null) {
    const href = match[1];
    if (href.startsWith('/') || href.startsWith('#')) continue;
    try {
      const url = new URL(href);
      if (url.hostname && url.hostname !== ownHostname) return 1;
    } catch {
      // not a valid URL
    }
  }
  return 0;
}
