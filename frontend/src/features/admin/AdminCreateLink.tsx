import { CreateLinkForm } from "../../components/CreateLinkForm";

export function AdminCreateLink() {
  return (
    <CreateLinkForm cancelPath="/admin/links" successPath="/admin/links" />
  );
}
