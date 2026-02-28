import { cn } from "~/lib/utils";

export default function DarkSection({
  id,
  children,
  className,
  gridPattern = true,
  glowEffects = true,
  ...rest
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
  gridPattern?: boolean;
  glowEffects?: boolean;
} & Omit<React.HTMLAttributes<HTMLElement>, "id" | "className" | "children">) {
  return (
    <section
      {...rest}
      id={id}
      className={cn(
        "relative py-section-md lg:py-section-lg overflow-hidden",
        "bg-gradient-to-b from-navy-mid via-navy-mid-light to-navy-light",
        className,
      )}
    >
      {gridPattern && (
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none"
          aria-hidden="true"
        />
      )}
      {glowEffects && (
        <>
          <div
            className="absolute -top-20 -right-20 w-80 h-80 bg-cta/[0.08] rounded-full blur-3xl pointer-events-none"
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-20 -left-20 w-60 h-60 bg-navy-light/40 rounded-full blur-3xl pointer-events-none"
            aria-hidden="true"
          />
        </>
      )}
      <div className="relative container mx-auto px-page max-w-7xl">
        {children}
      </div>
    </section>
  );
}
