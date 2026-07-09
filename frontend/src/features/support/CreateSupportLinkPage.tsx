import { CreateUploadLinkForm } from "../../components/CreateUploadLinkForm";

export function CreateSupportLinkPage() {
  return (
    <CreateUploadLinkForm
      cancelPath="/support"
      successPath="/support/links"
    />
  );
}