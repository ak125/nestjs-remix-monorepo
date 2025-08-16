/**
 * Interfaces pour le service de gestion de stock enrichi
 */

export interface StockItem {
  id: string;
  productId: string;
  quantity: number;
  available: number;
  reserved: number;
  minStock: number;
  maxStock: number;
  location?: string;
  warehouseId?: string;
  lastUpdated: Date;
  
  // Relations
  product?: ProductInfo;
  movements?: StockMovement[];
}

export interface ProductInfo {
  id: string;
  reference: string;
  name: string;
  description?: string;
  averageCost?: number;
  isActive: boolean;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: StockMovementType;
  quantity: number;
  referenceType?: string;
  referenceId?: string;
  unitCost?: number;
  reason?: string;
  notes?: string;
  userId: string;
  createdAt: Date;
  
  // Relations
  product?: ProductInfo;
  user?: UserInfo;
}

export enum StockMovementType {
  IN = 'IN',
  OUT = 'OUT',
  ADJUSTMENT = 'ADJUSTMENT',
  RETURN = 'RETURN',
  TRANSFER = 'TRANSFER',
  RESERVATION = 'RESERVATION',
  RELEASE = 'RELEASE',
}

export interface UserInfo {
  id: string;
  name: string;
  email: string;
}

export interface StockAlert {
  id: string;
  productId: string;
  alertType: StockAlertType;
  threshold: number;
  currentQuantity: number;
  isActive: boolean;
  createdAt: Date;
  acknowledgedAt?: Date;
  
  // Relations
  product?: ProductInfo;
}

export enum StockAlertType {
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  OVERSTOCK = 'OVERSTOCK',
  REORDER_POINT = 'REORDER_POINT',
}

export interface StockDashboard {
  totalProducts: number;
  totalValue: number;
  outOfStockCount: number;
  lowStockCount: number;
  overstockCount: number;
  recentMovements: StockMovement[];
  activeAlerts: StockAlert[];
  topProducts: StockItem[];
  trends: StockTrends;
}

export interface StockTrends {
  dailyMovements: DailyMovement[];
  weeklyTotals: WeeklyTotal[];
  popularProducts: ProductPopularity[];
}

export interface DailyMovement {
  date: string;
  inQuantity: number;
  outQuantity: number;
  adjustments: number;
}

export interface WeeklyTotal {
  week: string;
  totalIn: number;
  totalOut: number;
  netChange: number;
}

export interface ProductPopularity {
  productId: string;
  productName: string;
  productReference: string;
  movementCount: number;
  totalQuantity: number;
}

export interface StockFilters {
  search?: string;
  location?: string;
  warehouseId?: string;
  lowStock?: boolean;
  outOfStock?: boolean;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface MovementFilters {
  productId?: string;
  movementType?: StockMovementType;
  dateFrom?: Date;
  dateTo?: Date;
  userId?: string;
  limit?: number;
}

export interface StockReportSummary {
  totalProducts: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  overstockItems: number;
}

export interface StockReport {
  summary: StockReportSummary;
  lowStockDetails: StockItem[];
  outOfStockDetails: StockItem[];
  overstockDetails: StockItem[];
  recentMovements: StockMovement[];
  generatedAt: Date;
  generatedBy: string;
}

export interface InventoryAdjustment {
  productId: string;
  actualQuantity: number;
  expectedQuantity: number;
  difference: number;
  reason: string;
  notes?: string;
  userId: string;
}

export interface StockReservation {
  id: string;
  productId: string;
  quantity: number;
  reservedFor: string; // Order ID, User ID, etc.
  reservationType: string;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
}

export interface StockHealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  connectionTest?: string;
  error?: string;
}

export interface StockEventPayload {
  productId: string;
  productReference?: string;
  productName?: string;
  oldQuantity?: number;
  newQuantity?: number;
  movementType?: StockMovementType;
  alertType?: StockAlertType;
  userId?: string;
  metadata?: Record<string, any>;
}

// Types pour les événements
export const STOCK_EVENTS = {
  STOCK_UPDATED: 'stock.updated',
  STOCK_ALERT: 'stock.alert',
  LOW_STOCK: 'stock.low',
  OUT_OF_STOCK: 'stock.out',
  OVERSTOCK: 'stock.over',
  MOVEMENT_RECORDED: 'stock.movement.recorded',
  INVENTORY_ADJUSTED: 'stock.inventory.adjusted',
  RESERVATION_CREATED: 'stock.reservation.created',
  RESERVATION_RELEASED: 'stock.reservation.released',
} as const;

export type StockEventType = (typeof STOCK_EVENTS)[keyof typeof STOCK_EVENTS];
