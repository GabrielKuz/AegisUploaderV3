import { LinksTablePage } from "../../components/LinksTablePage";

export function SupportLinksPage() {
  return (
    <LinksTablePage
      title="Created links"
      description="Review generated upload links, customer case IDs, creators, and expiration dates."
      createPath="/support/links/new"
    />
  );
}