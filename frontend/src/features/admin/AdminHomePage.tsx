import {
  CreateLinkIcon,
  LinkActionCard,
  LinksIcon,
} from "../../components/LinkActionCard";

import "../support/SupportHomePage.css";

export function AdminHomePage() {
  return (
    <section
      className="support-home"
      aria-labelledby="admin-home-heading"
    >
      <header className="support-page-heading">
        <h1 id="admin-home-heading">
          Admin dashboard
        </h1>

        <p className="support-page-description">
          Manage upload links, review customer files, and adjust retention when needed.
        </p>
      </header>

      <div className="admin-home-actions">
        <LinkActionCard
          to="/admin/links"
          number="01"
          title="View links"
          description="Review generated upload links, case IDs, creators, and expiration dates."
          actionLabel="View links"
          icon={<LinksIcon />}
        />

        <LinkActionCard
          to="/admin/links/new"
          number="02"
          title="Create a link"
          description="Generate a temporary customer upload link for a support case."
          actionLabel="Create link"
          icon={<CreateLinkIcon />}
        />
      </div>
    </section>
  );
}