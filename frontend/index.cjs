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
	const ssrModule = await devServer.ssrLoadModule('virtual:remix/server-build');
	return ssrModule;
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