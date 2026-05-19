import { json, type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ params }: LoaderFunctionArgs) {
  return json({
    items: [],
    pagination: { page: 1, perPage: 20 },
    totals: { count: 0, available: 0 },
    cursor: null,
  });
}

export default function Page() {
  return <div />;
}
