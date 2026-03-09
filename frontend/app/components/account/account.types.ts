import type { LucideIcon } from "lucide-react";

export type OrderStatus =
  | "paid"
  | "pending"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface RecentOrder {
  id: string | number;
  date: string;
  totalTtc: number;
  status: OrderStatus;
  info?: string;
}

export interface AccountUser {
  firstName?: string;
  lastName?: string;
  email: string;
  isPro?: boolean;
  level?: number;
  createdAt?: string;
}

export interface AccountStats {
  orders: {
    total: number;
    pending: number;
    completed: number;
    revenue?: number;
    recent?: RecentOrder[];
  };
  messages: { total: number; unread: number };
  profile: { completeness: number };
}

export interface AccountDashboardProps {
  user: AccountUser;
  stats: AccountStats;
}

export type MenuItem = {
  icon: LucideIcon;
  label: string;
  href: string;
  color: string;
};

export type MenuSection = {
  title: string;
  items: MenuItem[];
};
