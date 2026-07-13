import { CreateUploadLinkForm } from "../../components/CreateUploadLinkForm";

export function AdminCreateSupportLinkPage() {
  return (
    <CreateUploadLinkForm
      eyebrow="Administrator"
      cancelPath="/admin"
      successPath="/admin/links"
    />
  );
}