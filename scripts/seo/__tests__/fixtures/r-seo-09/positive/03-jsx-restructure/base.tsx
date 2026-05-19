import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => [{ title: "Page" }];

export default function Page() {
  return (
    <div>
      <h1>Title</h1>
      <p>Paragraph</p>
      <p>Another</p>
    </div>
  );
}
