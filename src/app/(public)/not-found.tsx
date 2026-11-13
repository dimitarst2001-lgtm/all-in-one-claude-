import { NotFoundContent } from "../not-found";

/** notFound() inside public pages renders within the layout's <main>. */
export default function PublicNotFound() {
  return <NotFoundContent as="div" />;
}
