import { Link } from "@remix-run/react";
import { Award, Bell, Package, Pencil, Settings } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { type AccountUser, type AccountStats } from "./account.types";

function getInitials(firstName?: string, lastName?: string, email?: string) {
  if (firstName && lastName)
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return "??";
}

function getYearsSince(dateStr?: string): number | null {
  if (!dateStr) return null;
  const createdAt = new Date(dateStr);
  if (Number.isNaN(createdAt.getTime())) return null;

  const now = new Date();
  let years = now.getFullYear() - createdAt.getFullYear();

  const hasNotHadAnniversaryYet =
    now.getMonth() < createdAt.getMonth() ||
    (now.getMonth() === createdAt.getMonth() &&
      now.getDate() < createdAt.getDate());

  if (hasNotHadAnniversaryYet) years -= 1;

  return years >= 0 ? years : null;
}

interface AccountProfileCardProps {
  user: AccountUser;
  stats: AccountStats;
}

export function AccountProfileCard({ user, stats }: AccountProfileCardProps) {
  const initials = getInitials(user.firstName, user.lastName, user.email);
  const yearsSince = getYearsSince(user.createdAt);

  return (
    <section className="bg-gradient-to-b from-[var(--navy)] to-[var(--navy-light)]">
      <div className="px-5 pt-5 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
            <span className="text-[24px] font-extrabold text-white font-heading">
              {initials}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[18px] font-bold text-white font-heading tracking-tight">
              {user.firstName || user.email.split("@")[0]}
            </div>
            <div className="text-[12px] text-blue-200/50 mt-0.5 truncate">
              {user.email}
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {yearsSince !== null && yearsSince > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-bold text-emerald-300 bg-emerald-500/15 border-emerald-400/20 px-2 py-0.5"
                >
                  <Award size={9} className="mr-1" />
                  Client depuis {yearsSince > 1 ? `${yearsSince} ans` : "1 an"}
                </Badge>
              )}
              {user.isPro && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-bold text-amber-300 bg-amber-500/15 border-amber-400/20 px-2 py-0.5"
                >
                  Pro
                </Badge>
              )}
            </div>
          </div>
          <Link
            to="/account/profile/edit"
            aria-label="Modifier le profil"
            className="w-9 h-9 rounded-xl bg-white/[0.08] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.15] transition-all"
          >
            <Pencil size={15} />
          </Link>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2.5 mt-5">
          {[
            { n: String(stats.orders.total), l: "Commandes", icon: Package },
            { n: String(stats.messages.unread), l: "Messages", icon: Bell },
            {
              n: `${stats.profile.completeness}%`,
              l: "Profil",
              icon: Settings,
            },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.l}
                className="bg-white/[0.06] border border-white/[0.08] rounded-xl py-3 text-center"
              >
                <Icon size={16} className="text-white/30 mx-auto mb-1" />
                <div className="text-[16px] font-extrabold text-white font-heading">
                  {s.n}
                </div>
                <div className="text-[10px] text-blue-200/40">{s.l}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
