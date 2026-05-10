/**
 * Frontend permissions facade — backend is single source of truth.
 * Use loadUserPermissions(userId) inside Remix loaders, then ship the
 * result through useLoaderData to components.
 *
 * Source canon : backend/src/auth/dto/user-permissions.dto.ts
 * Spec : docs/superpowers/specs/2026-04-30-permissions-canonical-backend-design.md
 */

export interface UserPermissions {
  // Order actions
  canValidate: boolean;
  canShip: boolean;
  canDeliver: boolean;
  canCancel: boolean;
  canReturn: boolean;
  canRefund: boolean;
  canSendEmails: boolean;
  // Management
  canCreateOrders: boolean;
  canExport: boolean;
  canMarkPaid: boolean;
  // Display
  canSeeFullStats: boolean;
  canSeeFinancials: boolean;
  canSeeCustomerDetails: boolean;
  // Interface
  showAdvancedFilters: boolean;
  showActionButtons: boolean;
}

export const BASE_USER_PERMISSIONS: UserPermissions = {
  canValidate: false,
  canShip: false,
  canDeliver: false,
  canCancel: false,
  canReturn: false,
  canRefund: false,
  canSendEmails: false,
  canCreateOrders: false,
  canExport: false,
  canMarkPaid: false,
  canSeeFullStats: false,
  canSeeFinancials: false,
  canSeeCustomerDetails: false,
  showAdvancedFilters: false,
  showActionButtons: false,
};

/**
 * Fetch the canonical permission set for a user from the backend.
 * Call from Remix loaders (server-side); pass the request cookie through
 * so the backend session is recognized.
 */
export async function loadUserPermissions(
  userId: string,
  cookie?: string,
): Promise<UserPermissions> {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  try {
    const res = await fetch(
      `http://127.0.0.1:3000/api/auth/user-permissions/${encodeURIComponent(
        userId,
      )}`,
      { headers },
    );
    if (!res.ok) return BASE_USER_PERMISSIONS;
    return (await res.json()) as UserPermissions;
  } catch {
    return BASE_USER_PERMISSIONS;
  }
}

export function canPerformAction(
  permissions: UserPermissions,
  action: keyof UserPermissions,
): boolean {
  return permissions[action] === true;
}

/**
 * Display-only role badge — derived from level locally (no API call).
 */
export function getUserRole(userLevel: number): {
  label: string;
  badge: string;
  color: string;
  bgColor: string;
} {
  if (userLevel >= 9) {
    return {
      label: "Super Admin",
      badge: "👑",
      color: "text-purple-800",
      bgColor: "bg-purple-100",
    };
  }
  if (userLevel >= 7) {
    return {
      label: "Administrateur",
      badge: "🔑",
      color: "text-blue-800",
      bgColor: "bg-blue-100",
    };
  }
  if (userLevel >= 5) {
    return {
      label: "Responsable",
      badge: "📊",
      color: "text-green-800",
      bgColor: "bg-green-100",
    };
  }
  if (userLevel >= 3) {
    return {
      label: "Commercial",
      badge: "👔",
      color: "text-indigo-800",
      bgColor: "bg-indigo-100",
    };
  }
  return {
    label: "Utilisateur",
    badge: "👤",
    color: "text-gray-800",
    bgColor: "bg-gray-100",
  };
}
