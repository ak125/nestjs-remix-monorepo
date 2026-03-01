import { cn } from "~/lib/utils";

/**
 * Container — Responsive centered container with fluid padding.
 *
 * Replaces repetitive `container mx-auto px-4` patterns with a
 * single component that uses the fluid `px-page` utility.
 *
 * @example
 * <Container>Content</Container>
 * <Container size="narrow">Narrow content</Container>
 * <Container as="section" id="features">Section content</Container>
 */

const SIZE_CLASSES = {
  narrow: "max-w-3xl",
  default: "max-w-5xl",
  wide: "max-w-7xl",
  full: "max-w-full",
} as const;

interface ContainerProps {
  children: React.ReactNode;
  /** Max-width variant */
  size?: keyof typeof SIZE_CLASSES;
  /** HTML element to render */
  as?: "div" | "section" | "article" | "main" | "header" | "footer";
  /** Additional classes */
  className?: string;
  /** HTML id */
  id?: string;
}

export default function Container({
  children,
  size = "wide",
  as: Tag = "div",
  className,
  id,
}: ContainerProps) {
  return (
    <Tag
      id={id}
      className={cn("mx-auto w-full px-page", SIZE_CLASSES[size], className)}
    >
      {children}
    </Tag>
  );
}
