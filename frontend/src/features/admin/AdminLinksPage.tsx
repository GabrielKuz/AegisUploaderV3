import { LinksTablePage } from "../../components/LinksTablePage";

export function AdminLinksPage() {
    return (
        <LinksTablePage
            createPath="/admin/links/new"
            description="Review generated upload links, customer case IDs, creators, and expiration dates."
            uploadActionPathPrefix="/admin/view-uploads"
        />
    );
}
