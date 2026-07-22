import { DataTable } from "../../components/DataTable";

export function SupportViewLinks() {
  return (
    <DataTable
      createPath="/support/links/new"
      description="Review generated upload links, customer case IDs, creators, expiration dates, and uploaded files."
      uploadActionPathPrefix="/support/view-uploads"
    />
  );
}
