import { LinksTablePage } from "../../components/LinksTablePage";

export function AdminLinksPage() {
    return (
        <LinksTablePage
            title="Created links"
            description="Review generated upload links, customer case IDs, creators, expiration dates, and uploaded files."
            createPath="/admin/links/new"
            uploadActionPathPrefix="/admin/view-uploads"
            showUploadActions
        />
    );
}