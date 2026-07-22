import { CreateLinkForm } from "../../components/CreateLinkForm";

export function SupportCreateLink() {
  return (
    <CreateLinkForm
      cancelPath="/support/links"
      successPath="/support/links"
    />
  );
}