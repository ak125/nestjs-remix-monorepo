import { json, type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ params }: LoaderFunctionArgs) {
  return json({
    items: [],
  });
}

export default function Page() {
  return <div />;
}
