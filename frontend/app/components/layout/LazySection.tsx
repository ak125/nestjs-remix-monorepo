import { useEffect, useRef, useState } from "react";

/**
 * LazySection — Rend ses enfants uniquement quand la section approche du viewport.
 *
 * Pendant le SSR et avant intersection côté client, un placeholder avec minHeight
 * est rendu à la place. Cela réduit la taille du HTML initial et accélère le FCP.
 *
 * rootMargin="300px" déclenche le rendu 300px avant que la section soit visible,
 * évitant tout flash de contenu vide lors du scroll.
 */
export default function LazySection({
  children,
  minHeight = 200,
  className,
}: {
  children: React.ReactNode;
  minHeight?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Si IntersectionObserver n'est pas supporté, afficher directement
    if (!("IntersectionObserver" in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {isVisible ? children : <div style={{ minHeight }} />}
    </div>
  );
}
