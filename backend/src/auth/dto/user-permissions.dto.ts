/**
 * Canonical permission shape — single source of truth for the per-action
 * permission matrix. Mirror of the frontend interface, owned by the backend.
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

export const COMMERCIAL_PERMISSIONS: UserPermissions = {
  canValidate: true,
  canShip: true,
  canDeliver: true,
  canCancel: true,
  canReturn: false,
  canRefund: false,
  canSendEmails: true,
  canCreateOrders: false,
  canExport: true,
  canMarkPaid: true,
  canSeeFullStats: false,
  canSeeFinancials: false,
  canSeeCustomerDetails: true,
  showAdvancedFilters: true,
  showActionButtons: true,
};

export const MANAGER_PERMISSIONS: UserPermissions = {
  canValidate: false,
  canShip: false,
  canDeliver: false,
  canCancel: false,
  canReturn: false,
  canRefund: false,
  canSendEmails: false,
  canCreateOrders: false,
  canExport: true,
  canMarkPaid: false,
  canSeeFullStats: true,
  canSeeFinancials: true,
  canSeeCustomerDetails: true,
  showAdvancedFilters: true,
  showActionButtons: false,
};

export const ADMIN_PERMISSIONS: UserPermissions = {
  canValidate: true,
  canShip: true,
  canDeliver: true,
  canCancel: true,
  canReturn: true,
  canRefund: true,
  canSendEmails: true,
  canCreateOrders: true,
  canExport: true,
  canMarkPaid: true,
  canSeeFullStats: true,
  canSeeFinancials: true,
  canSeeCustomerDetails: true,
  showAdvancedFilters: true,
  showActionButtons: true,
};

export const SUPER_ADMIN_PERMISSIONS: UserPermissions = {
  ...ADMIN_PERMISSIONS,
};

export type PermissionAction = keyof UserPermissions;
