import { LinksTablePage } from "../../components/LinksTablePage";

export function SupportLinksPage() {
  return (
    <LinksTablePage
      title="Created links"
      description="Review generated upload links, customer case IDs, creators, expiration dates, and uploaded files."
      createPath="/support/links/new"
      uploadActionPathPrefix="/support/view-uploads"
      showUploadActions
    />
  );
}