import { CreateUploadLinkForm } from "../../components/CreateUploadLinkForm";

export function CreateSupportLinkPage() {
  return (
    <CreateUploadLinkForm
      cancelPath="/support/links"
      successPath="/support/links"
    />
  );
}