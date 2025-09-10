import { useSearchParams } from "@remix-run/react";
import { Error410 } from "../components/errors/Error410";

export default function GonePage() {
  const [searchParams] = useSearchParams();
  
  const url = searchParams.get('url') || undefined;
  const isOldLink = searchParams.get('isOldLink') === 'true';
  const redirectTo = searchParams.get('redirectTo') || undefined;
  const userAgent = searchParams.get('userAgent') || undefined;
  const referrer = searchParams.get('referrer') || undefined;
  const method = searchParams.get('method') || undefined;

  return (
    <Error410 
      url={url}
      isOldLink={isOldLink}
      redirectTo={redirectTo}
      userAgent={userAgent}
      referrer={referrer}
      method={method}
    />
  );
}

export function meta() {
  return [
    { title: "410 - Contenu supprimé | NestJS Remix Monorepo" },
    { name: "description", content: "Cette ressource a été définitivement supprimée ou utilise un format d'URL obsolète." },
    { name: "robots", content: "noindex, nofollow" },
  ];
}
