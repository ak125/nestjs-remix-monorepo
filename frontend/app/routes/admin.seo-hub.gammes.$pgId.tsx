import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
export const loader = ({ params }: LoaderFunctionArgs) =>
  redirect(`/admin/gammes-seo/${params.pgId}`, 302);
