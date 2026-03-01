import { cn } from "~/lib/utils";

export default function GlassCard({
  children,
  className,
  accentLeft = false,
  hover = true,
}: {
  children: React.ReactNode;
  className?: string;
  accentLeft?: boolean;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative rounded-xl border border-white/10 bg-white/[0.05] backdrop-blur-sm overflow-hidden",
        hover &&
          "hover:bg-white/[0.09] hover:border-white/20 transition-all duration-300",
        className,
      )}
    >
      {accentLeft && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-cta-light via-cta to-cta-dark" />
      )}
      {children}
    </div>
  );
}
