/**
 * Admin Patterns - Composants UI standardisés pour dashboards admin
 *
 * Ces patterns suivent les règles de DESIGN-SYSTEM.automecanik.md:
 * - shadcn/ui obligatoire
 * - lucide-react pour icônes
 * - Couleurs sémantiques (success, destructive, warning, info)
 * - Pre-delivery checklist respectée
 */

export { KpiCard, type KpiCardProps } from "./KpiCard";
export {
  StatusBadge,
  type StatusBadgeProps,
  type StatusType,
} from "./StatusBadge";
export { PassBadge, FailBadge, WarnBadge } from "./StatusBadge";
export {
  ValidationPanel,
  type ValidationPanelProps,
  type TestItem,
  type DrillDownSection,
  type DrillDownItem,
} from "./ValidationPanel";
export {
  DashboardShell,
  type DashboardShellProps,
  KpiGrid,
  type KpiGridProps,
  ContentGrid,
  type ContentGridProps,
} from "./DashboardShell";
export {
  AuditTable,
  type AuditTableProps,
  type AuditColumn,
  createColumn,
  createStatusColumn,
} from "./AuditTable";
export {
  FilterBar,
  type FilterBarProps,
  FilterGroup,
  type FilterGroupProps,
  FilterChip,
  type FilterChipProps,
} from "./FilterBar";
export {
  ResponsiveDataTable,
  PaginationBar,
  type ResponsiveDataTableProps,
  type DataColumn,
  createDataColumn,
} from "./ResponsiveDataTable";
export { AdminDataTable, type AdminDataTableProps } from "./AdminDataTable";
export { TableSkeleton } from "./TableSkeleton";
export { DensityToggle, DensityButtons } from "./DensityToggle";
