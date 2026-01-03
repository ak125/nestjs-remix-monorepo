import { useState, useEffect } from 'react';
import { breakpoints, type BreakpointKey } from './useMediaQuery';

export type Breakpoint = 'xs' | BreakpointKey;

/**
 * Hook pour obtenir le breakpoint actuel
 * @returns Breakpoint - 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
 *
 * @example
 * const bp = useBreakpoint();
 * if (bp === 'xs' || bp === 'sm') {
 *   // Mobile layout
 * }
 */
export function useBreakpoint(): Breakpoint {
	const [bp, setBp] = useState<Breakpoint>('xs');

	useEffect(() => {
		// SSR safety
		if (typeof window === 'undefined') return;

		const update = () => {
			const w = window.innerWidth;

			if (w >= breakpoints['2xl']) setBp('2xl');
			else if (w >= breakpoints.xl) setBp('xl');
			else if (w >= breakpoints.lg) setBp('lg');
			else if (w >= breakpoints.md) setBp('md');
			else if (w >= breakpoints.sm) setBp('sm');
			else setBp('xs');
		};

		// Initial check
		update();

		// Throttled resize listener for performance
		let timeoutId: NodeJS.Timeout;
		const throttledUpdate = () => {
			if (timeoutId) return;
			timeoutId = setTimeout(() => {
				update();
				timeoutId = undefined as unknown as NodeJS.Timeout;
			}, 100);
		};

		window.addEventListener('resize', throttledUpdate);
		return () => {
			window.removeEventListener('resize', throttledUpdate);
			if (timeoutId) clearTimeout(timeoutId);
		};
	}, []);

	return bp;
}

/**
 * Hook pour vérifier si le viewport est >= un breakpoint donné
 * @param minBreakpoint - Le breakpoint minimum requis
 * @returns boolean
 *
 * @example
 * const isLgOrAbove = useMinBreakpoint('lg');
 */
export function useMinBreakpoint(minBreakpoint: Breakpoint): boolean {
	const current = useBreakpoint();
	const order: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
	return order.indexOf(current) >= order.indexOf(minBreakpoint);
}

/**
 * Hook pour vérifier si le viewport est <= un breakpoint donné
 * @param maxBreakpoint - Le breakpoint maximum
 * @returns boolean
 *
 * @example
 * const isMdOrBelow = useMaxBreakpoint('md');
 */
export function useMaxBreakpoint(maxBreakpoint: Breakpoint): boolean {
	const current = useBreakpoint();
	const order: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
	return order.indexOf(current) <= order.indexOf(maxBreakpoint);
}

/**
 * Export des breakpoints pour usage en JS
 * Permet de garder la cohérence avec Tailwind
 */
export { breakpoints } from './useMediaQuery';
