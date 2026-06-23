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
 */
module.exports.getCreateAppLoadContext = async function getCreateAppLoadContext() {
	const build = await module.exports.getServerBuild();
	return build.entry.module.createAppLoadContext;
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