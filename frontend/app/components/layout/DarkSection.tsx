export default function DarkSection({
  id,
  children,
  className = "",
  gridPattern = true,
  glowEffects = true,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
  gridPattern?: boolean;
  glowEffects?: boolean;
}) {
  return (
    <section
      id={id}
      className={`relative py-12 md:py-16 lg:py-20 overflow-hidden bg-gradient-to-b from-[#0f2347] via-[#122a50] to-[#162d5a] ${className}`}
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
            className="absolute -top-20 -right-20 w-80 h-80 bg-[#e8590c]/[0.08] rounded-full blur-3xl pointer-events-none"
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-20 -left-20 w-60 h-60 bg-[#162d5a]/40 rounded-full blur-3xl pointer-events-none"
            aria-hidden="true"
          />
        </>
      )}
      <div className="relative container mx-auto px-4 max-w-7xl">
        {children}
      </div>
    </section>
  );
}
