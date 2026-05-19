import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export const meta: MetaFunction = () => [
  { title: "Example" },
  { name: "description", content: "Example page" },
  { tagName: "link", rel: "canonical", href: "https://example.com/foo" },
];

export async function loader({ params }: LoaderFunctionArgs) {
  return json({ items: ["a", "b", "c"] });
}

export default function FooRoute() {
  const data = useLoaderData<typeof loader>();
  return (
    <div className="p-4 rounded">
      <h1 className="text-foreground">{data.items.length} items</h1>
    </div>
  );
}
