declare module '@fafa/frontend' {
	export function getPublicDir(): string;
	export function getServerBuild(): Promise<any>;
	export function startDevServer(app: any): Promise<void>;
	/**
	 * RR8 `v8_middleware` bridge (A6): returns the SSR-realm factory that builds a
	 * `RouterContextProvider` from plain values. The factory is sourced from the
	 * server build's `entry.module`, so NestJS never imports the context keys.
	 */
	export function getCreateAppLoadContext(): Promise<
		(values: {
			user: unknown;
			remixService: unknown;
			remixIntegration: unknown;
			cspNonce: string;
			serverObservability: unknown;
		}) => import('react-router').RouterContextProvider
	>;
}