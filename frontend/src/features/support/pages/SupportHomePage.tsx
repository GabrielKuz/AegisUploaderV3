import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import "./SupportHomePage.css";

type LinkActionCardProps = {
  to: string;
  number: string;
  title: string;
  description: string;
  actionLabel: string;
  icon: ReactNode;
};

/**
 * Reusable navigation card for a primary support workflow.
 */
function LinkActionCard({
  to,
  number,
  title,
  description,
  actionLabel,
  icon,
}: LinkActionCardProps) {
  return (
    <Link
      to={to}
      className="link-action-card"
      aria-label={`${title}: ${actionLabel} `}
    >
      <span
        className="link-action-accent"
        aria-hidden="true"
      />

      <div className="link-action-top">
        <span
          className="link-action-number"
          aria-hidden="true"
        >
          {number}
        </span>

        <span
          className="link-action-icon"
          aria-hidden="true"
        >
          {icon}
        </span>
      </div>

      <div
        className="link-action-divider"
        aria-hidden="true"
      />

      <div className="link-action-content">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <div className="link-action-footer">
        <span>{actionLabel}</span>

        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          aria-hidden="true"
        >
          <path
            d="M5 12h13M13 6l6 6-6 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <span
        className="link-action-dots"
        aria-hidden="true"
      />
    </Link>
  );
}

/**
 * Icon representing the list of existing support links.
 */
function LinksIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="26"
      height="26"
      aria-hidden="true"
    >
      <rect
        x="5"
        y="3.5"
        width="14"
        height="17"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />

      <path
        d="M9 8h1M12 8h4M9 12h1M12 12h4M9 16h1M12 16h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Icon representing creation of a new support link.
 */
function CreateLinkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="26"
      height="26"
      aria-hidden="true"
    >
      <path
        d="m4.5 19.5 4.2-1 10-10a2.1 2.1 0 0 0-3-3l-10 10-1.2 4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="m14.5 6.7 2.8 2.8M8.7 18.5l-3.2-3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Landing page for the customer-support workflow.
 */
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
          Review an existing support link or create a new link.
        </p>
      </header>

      <div className="support-home-actions">
        <LinkActionCard
          to="/support/links"
          number="01"
          title="View your links"
          description="Review link status, previous requests, and recent support activity."
          actionLabel="Go to my links"
          icon={<LinksIcon />}
        />

        <LinkActionCard
          to="/support/links/new"
          number="02"
          title="Create a link"
          description="Submit a new issue with a category, description, and supporting information."
          actionLabel="Create a new link"
          icon={<CreateLinkIcon />}
        />
      </div>
    </section>
  );
}
