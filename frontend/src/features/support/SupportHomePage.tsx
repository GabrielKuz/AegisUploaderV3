import {
  CreateLinkIcon,
  LinkActionCard,
  LinksIcon,
} from "../../components/LinkActionCard";

import "./SupportHomePage.css";

export function SupportHomePage() {
  return (
    <section
      className="support-home"
      aria-labelledby="support-home-heading"
    >
      <header className="support-page-heading">
        <h1 id="support-home-heading">
          How can we help?
        </h1>

        <p className="support-page-description">
          Create secure customer upload links and review existing link activity.
        </p>
      </header>

      <div className="support-home-actions">
        <LinkActionCard
          to="/support/links"
          number="01"
          title="View your links"
          description="Review generated upload links, case IDs, creators, and expiration dates."
          actionLabel="Go to links"
          icon={<LinksIcon />}
        />

        <LinkActionCard
          to="/support/links/new"
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