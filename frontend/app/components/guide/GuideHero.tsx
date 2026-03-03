/**
 * GuideHero — Thin wrapper around HeroBlog for R3 conseil pages.
 * Provides design system defaults: breadcrumb Blog→Conseils→titre, badges, ctaSoft.
 */

import { type HeroBadge } from "~/components/blog/conseil/section-config";
import { HeroBlog } from "~/components/heroes";

interface GuideHeroProps {
  title: string;
  description?: string;
  slogan?: string;
  metaLine?: string;
  badges?: HeroBadge[];
  ctaSoft?: { label: string; href: string };
  image?: { src: string; alt: string };
  className?: string;
}

export function GuideHero({
  title,
  description,
  slogan,
  metaLine,
  badges,
  ctaSoft,
  image,
  className,
}: GuideHeroProps) {
  return (
    <HeroBlog
      title={title}
      description={description}
      slogan={slogan}
      metaLine={metaLine}
      badges={badges}
      ctaSoft={ctaSoft}
      image={image}
      breadcrumb={[
        { label: "Blog", href: "/blog-pieces-auto" },
        { label: "Conseils", href: "/blog-pieces-auto/conseils" },
        { label: title },
      ]}
      className={className}
    />
  );
}
