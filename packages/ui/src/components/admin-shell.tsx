import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../lib/utils';

/**
 * AdminShell - Layout pattern pour pages admin
 * 
 * Features:
 * - Sidebar + Topbar avec slots asChild
 * - Z-index tokens (z-navigation, z-sticky)
 * - Density control (compact par défaut pour admin)
 * - Mobile responsive (hamburger, sidebar slide, backdrop)
 * - Support dark mode via CSS variables
 * 
 * @example
 * ```tsx
 * <AdminShell
 *   sidebar={<MySidebar />}
 *   topbar={<MyTopbar user={user} />}
 *   density="compact"
 * >
 *   <PageContent />
 * </AdminShell>
 * ```
 */

const adminShellVariants = cva(
  'min-h-screen flex flex-col bg-[var(--bg-primary)]',
  {
    variants: {
      density: {
        comfy: 'gap-6',
        compact: 'gap-4',
      },
    },
    defaultVariants: {
      density: 'compact',
    },
  }
);

const sidebarVariants = cva(
  'flex flex-col bg-[var(--bg-secondary)] border-r border-[var(--border-primary)]',
  {
    variants: {
      density: {
        comfy: 'w-72 p-6',
        compact: 'w-64 p-4',
      },
    },
    defaultVariants: {
      density: 'compact',
    },
  }
);

const topbarVariants = cva(
  'sticky top-0 z-sticky flex items-center justify-between bg-[var(--bg-primary)] border-b border-[var(--border-primary)] backdrop-blur-sm',
  {
    variants: {
      density: {
        comfy: 'h-16 px-6',
        compact: 'h-14 px-4',
      },
    },
    defaultVariants: {
      density: 'compact',
    },
  }
);

export interface AdminShellProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof adminShellVariants> {
  sidebar?: React.ReactNode;
  topbar?: React.ReactNode;
  sidebarAsChild?: boolean;
  topbarAsChild?: boolean;
}

export const AdminShell = React.forwardRef<HTMLDivElement, AdminShellProps>(
  (
    {
      className,
      children,
      sidebar,
      topbar,
      sidebarAsChild = false,
      topbarAsChild = false,
      density,
      ...props
    },
    ref
  ) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

    // Composant Sidebar (desktop + mobile)
    const SidebarComp = sidebarAsChild ? Slot : 'aside';
    const sidebarContent = sidebar ? (
      <SidebarComp
        className={cn(
          sidebarVariants({ density }),
          // Desktop: toujours visible à gauche
          'hidden lg:flex',
          'fixed inset-y-0 left-0 z-navigation'
        )}
      >
        {sidebar}
      </SidebarComp>
    ) : null;

    // Sidebar mobile (slide in/out)
    const sidebarMobile = sidebar ? (
      <>
        {/* Backdrop */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-[var(--text-primary)]/50 z-modalBackdrop lg:hidden backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar mobile */}
        <SidebarComp
          className={cn(
            sidebarVariants({ density }),
            'lg:hidden',
            'fixed inset-y-0 left-0 z-modal',
            'transform transition-transform duration-300 ease-in-out',
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {sidebar}
        </SidebarComp>
      </>
    ) : null;

    // Composant Topbar
    const TopbarComp = topbarAsChild ? Slot : 'header';
    const topbarContent = topbar ? (
      <TopbarComp className={cn(topbarVariants({ density }), 'lg:ml-64')}>
        {/* Hamburger menu (mobile seulement) */}
        {sidebar && (
          <button
            type="button"
            className="lg:hidden p-2 rounded-md text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)]"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={isMobileMenuOpen}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {isMobileMenuOpen ? (
                <>
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </>
              ) : (
                <>
                  <path d="M4 6h16" />
                  <path d="M4 12h16" />
                  <path d="M4 18h16" />
                </>
              )}
            </svg>
          </button>
        )}

        {topbar}
      </TopbarComp>
    ) : null;

    return (
      <div ref={ref} className={cn(adminShellVariants({ density }), className)} {...props}>
        {/* Sidebar desktop */}
        {sidebarContent}

        {/* Sidebar mobile + backdrop */}
        {sidebarMobile}

        {/* Topbar */}
        {topbarContent}

        {/* Main content */}
        <main
          className={cn(
            'flex-1 transition-all duration-300',
            sidebar && 'lg:ml-64', // Offset pour sidebar desktop
            density === 'comfy' ? 'p-6' : 'p-4'
          )}
        >
          {children}
        </main>
      </div>
    );
  }
);

AdminShell.displayName = 'AdminShell';

/**
 * AdminSidebar - Composant helper pour le contenu de la sidebar
 * 
 * @example
 * ```tsx
 * <AdminSidebar>
 *   <AdminSidebarHeader>
 *     <Logo />
 *   </AdminSidebarHeader>
 *   <AdminSidebarNav>
 *     <NavItem href="/admin/dashboard">Dashboard</NavItem>
 *   </AdminSidebarNav>
 *   <AdminSidebarFooter>
 *     <UserProfile />
 *   </AdminSidebarFooter>
 * </AdminSidebar>
 * ```
 */
export interface AdminSidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export const AdminSidebar = React.forwardRef<HTMLDivElement, AdminSidebarProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('flex flex-col gap-4 h-full', className)} {...props}>
        {children}
      </div>
    );
  }
);

AdminSidebar.displayName = 'AdminSidebar';

export interface AdminSidebarHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export const AdminSidebarHeader = React.forwardRef<HTMLDivElement, AdminSidebarHeaderProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex items-center gap-3 pb-4 border-b border-[var(--border-primary)]', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

AdminSidebarHeader.displayName = 'AdminSidebarHeader';

export interface AdminSidebarNavProps extends React.HTMLAttributes<HTMLElement> {}

export const AdminSidebarNav = React.forwardRef<HTMLElement, AdminSidebarNavProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <nav ref={ref} className={cn('flex-1 flex flex-col gap-1', className)} {...props}>
        {children}
      </nav>
    );
  }
);

AdminSidebarNav.displayName = 'AdminSidebarNav';

export interface AdminSidebarFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const AdminSidebarFooter = React.forwardRef<HTMLDivElement, AdminSidebarFooterProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('mt-auto pt-4 border-t border-[var(--border-primary)]', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

AdminSidebarFooter.displayName = 'AdminSidebarFooter';
