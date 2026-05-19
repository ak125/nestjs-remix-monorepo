import { json, type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ params }: LoaderFunctionArgs) {
  return json({
    items: [],
    canonical: "https://example.com/page",
  });
}

export default function Page() {
  return <div />;
}
