declare module '@fafa/frontend' {
	export function getPublicDir(): string;
	export function getServerBuild(): Promise<any>;
	export function startDevServer(app: any): Promise<void>;

	/**
	 * RemixApplicationPort contract re-export — SINGLE source of truth.
	 *
	 * The interfaces live in the dependency-free leaf
	 * `app/utils/remix-application-port.ts`; referencing them here through a
	 * PACKAGE-RELATIVE type-only `import(...)` is what lets the CJS backend realm
	 * (classic `moduleResolution: Node`) resolve the REAL types instead of `any`
	 * (unlike `import('react-router')`, which is exports-only and degrades). The
	 * leaf has ZERO imports, so pulling it into the backend program is safe (no
	 * transitive "Cannot find module"); type-only ⇒ no runtime ⇒ dual-realm #1106
	 * invariant untouched.
	 */
	export type RemixApplicationPort =
		import('./app/utils/remix-application-port').RemixApplicationPort;
	export type PortActor =
		import('./app/utils/remix-application-port').PortActor;
	export type HomepageFamiliesResult =
		import('./app/utils/remix-application-port').HomepageFamiliesResult;
	export type HomepageBelowFoldResult =
		import('./app/utils/remix-application-port').HomepageBelowFoldResult;
	export type AdminOrdersQuery =
		import('./app/utils/remix-application-port').AdminOrdersQuery;
	export type AdminOrdersResult =
		import('./app/utils/remix-application-port').AdminOrdersResult;
	export type AdminStaffQuery =
		import('./app/utils/remix-application-port').AdminStaffQuery;
	export type AdminStaffResult =
		import('./app/utils/remix-application-port').AdminStaffResult;
	export type AdminStaffStatistics =
		import('./app/utils/remix-application-port').AdminStaffStatistics;

	/**
	 * RR8 `v8_middleware` bridge (A6): returns the SSR-realm factory that builds a
	 * `RouterContextProvider` from plain values. The factory is sourced from the
	 * server build's `entry.module`, so NestJS never imports the context keys.
	 * `remixApplicationPort` is typed to the shared leaf, so the backend value the
	 * controller injects is structurally checked against the real port contract.
	 */
	export function getCreateAppLoadContext(): Promise<
		(values: {
			user: unknown;
			remixService: unknown;
			remixIntegration: unknown;
			cspNonce: string;
			serverObservability: unknown;
			remixApplicationPort: import('./app/utils/remix-application-port').RemixApplicationPort;
		}) => import('react-router').RouterContextProvider
	>;
}
