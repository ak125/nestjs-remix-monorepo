import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => [{ title: "Page" }];

function Header() {
  return <h1>Title</h1>;
}

function Content() {
  return (
    <>
      <p>Paragraph</p>
      <p>Another</p>
    </>
  );
}

export default function Page() {
  return (
    <section>
      <Header />
      <article>
        <Content />
      </article>
    </section>
  );
}
