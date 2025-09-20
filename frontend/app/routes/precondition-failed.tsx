import { useSearchParams } from "@remix-run/react";
import { Error412 } from "../components/errors/Error412";

export default function PreconditionFailedPage() {
  const [searchParams] = useSearchParams();
  
  const url = searchParams.get('url') || undefined;
  const condition = searchParams.get('condition') || undefined;
  const requirement = searchParams.get('requirement') || undefined;
  const userAgent = searchParams.get('userAgent') || undefined;
  const referrer = searchParams.get('referrer') || undefined;
  const method = searchParams.get('method') || undefined;

  return (
    <Error412 
      url={url}
      condition={condition}
      requirement={requirement}
      userAgent={userAgent}
      referrer={referrer}
      method={method}
    />
  );
}

export function meta() {
  return [
    { title: "412 - Condition préalable échouée | NestJS Remix Monorepo" },
    { name: "description", content: "Une condition préalable spécifiée dans votre requête n'a pas été satisfaite." },
    { name: "robots", content: "noindex, nofollow" },
  ];
}
