import type { AccountDashboardProps } from "./account.types";
import { AccountProfileCard } from "./AccountProfileCard";
import { AccountOrdersSection } from "./AccountOrdersSection";
import { AccountMenuSections } from "./AccountMenuSections";

export default function AccountDashboard({
  user,
  stats,
}: AccountDashboardProps) {
  const recentOrders = stats.orders.recent ?? [];

  return (
    <div className="pb-20">
      <AccountProfileCard user={user} stats={stats} />
      <AccountOrdersSection
        orders={recentOrders}
        totalOrders={stats.orders.total}
      />
      <AccountMenuSections isPro={user.isPro} />
    </div>
  );
}
