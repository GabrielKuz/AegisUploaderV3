import { CreateUploadLinkForm } from "../../components/CreateUploadLinkForm";

export function AdminCreateSupportLinkPage() {
  return (
    <CreateUploadLinkForm
      cancelPath="/admin/linka"
      successPath="/admin/links"
    />
  );
}
