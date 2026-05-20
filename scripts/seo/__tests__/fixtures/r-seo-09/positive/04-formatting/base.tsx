import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => [
  { title: "Page" },
  { name: "description", content: "Lorem ipsum" },
];

export default function Page() {
  return <div>hello</div>;
}
