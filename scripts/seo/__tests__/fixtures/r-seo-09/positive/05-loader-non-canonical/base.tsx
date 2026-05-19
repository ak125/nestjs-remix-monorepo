import { json, type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ params }: LoaderFunctionArgs) {
  return json({
    items: [],
    pagination: { page: 1, perPage: 20 },
  });
}

export default function Page() {
  return <div />;
}
