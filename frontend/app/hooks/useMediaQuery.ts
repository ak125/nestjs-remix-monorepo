import { useState, useEffect, useCallback } from 'react';

/**
 * Breakpoints standard Tailwind (en pixels)
 * Utilisés pour la cohérence avec les classes CSS
 */
export const breakpoints = {
	sm: 640,
	md: 768,
	lg: 1024,
	xl: 1280,
	'2xl': 1536,
} as const;

export type BreakpointKey = keyof typeof breakpoints;

/**
 * Hook universel pour les media queries
 * @param query - Media query string (ex: "(min-width: 768px)")
 * @returns boolean - true si la query match
 *
 * @example
 * const isWide = useMediaQuery('(min-width: 1024px)');
 */
export function useMediaQuery(query: string): boolean {
	const [matches, setMatches] = useState(false);

	useEffect(() => {
		// SSR safety
		if (typeof window === 'undefined') return;

		const media = window.matchMedia(query);
		setMatches(media.matches);

		const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
		media.addEventListener('change', listener);

		return () => media.removeEventListener('change', listener);
	}, [query]);

	return matches;
}

/**
 * Hook pour détecter si on est sur mobile (<768px)
 * @returns boolean - true si viewport < md breakpoint
 */
export function useIsMobile(): boolean {
	return useMediaQuery(`(max-width: ${breakpoints.md - 1}px)`);
}

/**
 * Hook pour détecter si on est sur tablette (768px - 1023px)
 * @returns boolean - true si viewport entre md et lg breakpoints
 */
export function useIsTablet(): boolean {
	return useMediaQuery(
		`(min-width: ${breakpoints.md}px) and (max-width: ${breakpoints.lg - 1}px)`
	);
}

/**
 * Hook pour détecter si on est sur desktop (≥1024px)
 * @returns boolean - true si viewport >= lg breakpoint
 */
export function useIsDesktop(): boolean {
	return useMediaQuery(`(min-width: ${breakpoints.lg}px)`);
}

/**
 * Hook pour détecter si l'écran est tactile
 * @returns boolean - true si touch device
 */
export function useIsTouchDevice(): boolean {
	const [isTouch, setIsTouch] = useState(false);

	useEffect(() => {
		if (typeof window === 'undefined') return;

		const checkTouch = () => {
			setIsTouch(
				'ontouchstart' in window ||
					navigator.maxTouchPoints > 0 ||
					window.matchMedia('(pointer: coarse)').matches
			);
		};

		checkTouch();
	}, []);

	return isTouch;
}

/**
 * Hook pour détecter l'orientation de l'écran
 * @returns 'portrait' | 'landscape'
 */
export function useOrientation(): 'portrait' | 'landscape' {
	const isPortrait = useMediaQuery('(orientation: portrait)');
	return isPortrait ? 'portrait' : 'landscape';
}

/**
 * Hook combiné pour obtenir toutes les infos device en une fois
 * Utile pour éviter multiple re-renders
 */
export function useDeviceInfo() {
	const isMobile = useIsMobile();
	const isTablet = useIsTablet();
	const isDesktop = useIsDesktop();
	const isTouch = useIsTouchDevice();
	const orientation = useOrientation();

	return {
		isMobile,
		isTablet,
		isDesktop,
		isTouch,
		orientation,
		// Helpers
		isMobileOrTablet: isMobile || isTablet,
		isPortrait: orientation === 'portrait',
		isLandscape: orientation === 'landscape',
	};
}
