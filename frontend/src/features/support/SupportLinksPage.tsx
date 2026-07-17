import { LinksTablePage } from "../../components/LinksTablePage";

export function SupportLinksPage() {
  return (
    <LinksTablePage
      createPath="/support/links/new"
      description="Review generated upload links, customer case IDs, creators, expiration dates, and uploaded files."
      uploadActionPathPrefix="/support/view-uploads"
    />
  );
}