import { redirect, type LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  return redirect("/", 301);
}

export default function Home() {
  return null;
}
