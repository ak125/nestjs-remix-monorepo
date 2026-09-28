/**
 * Supercronic client for the existing internal SEO maintenance endpoints.
 * The worker supplies its internal API origin through SEO_MAINTENANCE_API_URL.
 * The key stays in the environment/header, never in process arguments or logs.
 */
export async function runLinkMaintenance(
  action: string | undefined,
  internalKey = process.env.INTERNAL_API_KEY,
  fetcher: typeof fetch = fetch,
  apiUrl = process.env.SEO_MAINTENANCE_API_URL,
): Promise<void> {
  if (action !== 'aggregate' && action !== 'cleanup') {
    throw new Error('Usage: run-link-maintenance.js aggregate|cleanup');
  }
  if (!internalKey?.trim()) {
    throw new Error('INTERNAL_API_KEY is required for SEO maintenance');
  }

  if (!apiUrl) {
    throw new Error('SEO_MAINTENANCE_API_URL is required for SEO maintenance');
  }
  const origin = new URL(apiUrl);
  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== '/'
  ) {
    throw new Error(
      'SEO_MAINTENANCE_API_URL must be an HTTP(S) origin without credentials',
    );
  }

  const query = action === 'cleanup' ? '?daysToKeep=90' : '';
  const response = await fetcher(`${origin.origin}/api/seo/${action}${query}`, {
    method: 'POST',
    headers: { 'X-Internal-Key': internalKey },
    // A redirected request must never forward the internal credential.
    redirect: 'error',
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(
      `SEO maintenance ${action} failed: HTTP ${response.status}`,
    );
  }
  const result: unknown = await response.json();
  if (
    !result ||
    typeof result !== 'object' ||
    !('success' in result) ||
    result.success !== true
  ) {
    throw new Error(
      `SEO maintenance ${action} returned an unsuccessful result`,
    );
  }
}

if (require.main === module) {
  void runLinkMaintenance(process.argv[2]).then(
    () => process.stdout.write('SEO link maintenance completed\n'),
    (error: unknown) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : 'SEO link maintenance failed'}\n`,
      );
      process.exitCode = 1;
    },
  );
}
