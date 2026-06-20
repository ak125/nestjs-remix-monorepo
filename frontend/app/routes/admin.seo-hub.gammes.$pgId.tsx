import { redirect, type LoaderFunctionArgs } from "react-router";
export const loader = ({ params }: LoaderFunctionArgs) =>
  redirect(`/admin/gammes-seo/${params.pgId}`, 302);
