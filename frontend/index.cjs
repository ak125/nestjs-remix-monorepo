const path = require('node:path');

let devServer;
const SERVER_DIR = path.join(__dirname, 'build/server/index.js');
const PUBLIC_DIR = path.join(__dirname, 'build/client');

module.exports.getPublicDir = function getPublicDir() {
	return PUBLIC_DIR;
};

module.exports.getServerBuild = async function getServerBuild() {
	if (process.env.NODE_ENV === 'production' || devServer === null) {
		return import(SERVER_DIR);
	}
	const ssrModule = await devServer.ssrLoadModule('virtual:react-router/server-build');
	return ssrModule;
};

/**
 * CJS→ESM bridge for the RR8 `v8_middleware` load context (A6).
 *
 * NestJS (CJS) must NEVER import `app/utils/load-context.ts` directly — the
 * `createContext()` keys are identity-keyed and a second instance in the CJS
 * realm would silently break `.set()`/`.get()` (dual-realm hazard, incident
 * #1106). Instead we hand back the `createAppLoadContext` factory that the SSR
 * build itself re-exports from `entry.server` (`build.entry.module`), so it
 * rides the EXACT same module graph as the loaders/actions → single key
 * identity, guaranteed. Works for both realms because `getServerBuild()`
 * already resolves DEV (Vite SSR graph) vs PROD (built ESM bundle).
 *
 * REALM-MATCHED PROVIDER (dual-realm fix). RR8 `v8_middleware` checks
 * `initialContext instanceof RouterContextProvider` inside its server runtime,
 * which runs in the realm of `@react-router/express` — i.e. THIS CJS realm. In
 * DEV the build's `createAppLoadContext` runs in Vite's `ssrLoadModule` realm (a
 * SEPARATE react-router instance), so a provider built there FAILS that check →
 * every DEV page 500s ("Invalid `context` value"). We therefore inject a provider
 * built from THIS realm's react-router — the exact class `@react-router/express`
 * compares against. Only the provider CLASS is unified; the identity-keyed keys
 * still come from the SSR build (the factory `.set()`s them onto the injected
 * provider) → the #1106 invariant is untouched. `RouterContextProvider.get/set`
 * are pure Map-by-identity over plain `{ defaultValue }` keys, so a node-realm
 * provider holding SSR-realm keys round-trips correctly. PROD is the unified
 * bundle (single realm) → injecting THIS realm's class is a no-op there.
 * (Doing this in the CJS façade — not `backend/` — avoids importing react-router's
 * exports-only types under the backend's classic `moduleResolution: Node`.)
 */
module.exports.getCreateAppLoadContext = async function getCreateAppLoadContext() {
	const build = await module.exports.getServerBuild();
	const factory = build.entry.module.createAppLoadContext;
	const { RouterContextProvider } = require('react-router');
	return (values) => factory(values, () => new RouterContextProvider());
};

module.exports.startDevServer = async function startDevServer(app) {
	if (process.env.NODE_ENV === 'production') return;

	const vite = await import('vite');
	devServer = await vite.createServer({
		server: { middlewareMode: true },
		root: __dirname,
		appType: 'custom',
	});

	// ✅ Error handler pour éviter crash silencieux
	devServer.middlewares.use((err, req, res, next) => {
		console.error('[Vite Error]', err.message || err);
		next(err);
	});

	app.use(devServer.middlewares);

	// ✅ Log pour confirmer que Vite est actif
	console.log('[Vite] Dev server middleware attached');

	return devServer;
};