import { DataTable } from "../../components/DataTable";

export function AdminViewLinks() {
    return (
        <DataTable
            createPath="/admin/links/new"
            description="Review generated upload links, customer case IDs, creators, and expiration dates."
            uploadActionPathPrefix="/admin/view-uploads"
        />
    );
}