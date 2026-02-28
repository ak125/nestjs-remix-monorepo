import { cn } from "~/lib/utils";

const BG_CLASSES = {
  white: "bg-white",
  slate: "bg-slate-50",
  navy: "bg-navy",
  "navy-gradient": "bg-gradient-to-br from-navy via-navy-mid to-navy-light",
} as const;

const MAX_WIDTH_CLASSES = {
  "7xl": "max-w-7xl",
  "5xl": "max-w-5xl",
  "3xl": "max-w-3xl",
  full: "max-w-full",
} as const;

export default function PageSection({
  id,
  bg = "white",
  maxWidth = "7xl",
  className,
  children,
  ...rest
}: {
  id?: string;
  bg?: keyof typeof BG_CLASSES;
  maxWidth?: keyof typeof MAX_WIDTH_CLASSES;
  className?: string;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "id" | "className" | "children">) {
  return (
    <section
      {...rest}
      id={id}
      className={cn(
        "py-section-sm sm:py-section-md",
        BG_CLASSES[bg],
        className,
      )}
    >
      <div
        className={cn("container mx-auto px-page", MAX_WIDTH_CLASSES[maxWidth])}
      >
        {children}
      </div>
    </section>
  );
}
