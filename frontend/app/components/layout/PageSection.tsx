const BG_CLASSES = {
  white: "bg-white",
  slate: "bg-slate-50",
  navy: "bg-[#0d1b3e]",
  "navy-gradient": "bg-gradient-to-br from-[#0d1b3e] to-[#162d5a]",
} as const;

const MAX_WIDTH_CLASSES = {
  "7xl": "max-w-7xl",
  "5xl": "max-w-5xl",
  "3xl": "max-w-3xl",
} as const;

export default function PageSection({
  id,
  bg = "white",
  maxWidth = "7xl",
  className = "",
  children,
}: {
  id?: string;
  bg?: keyof typeof BG_CLASSES;
  maxWidth?: keyof typeof MAX_WIDTH_CLASSES;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`py-10 sm:py-12 ${BG_CLASSES[bg]} ${className}`}
    >
      <div className={`container mx-auto px-4 ${MAX_WIDTH_CLASSES[maxWidth]}`}>
        {children}
      </div>
    </section>
  );
}
