import type { LinkActionCardProps } from "./LinkActionCard";
import { LinkActionCard } from "./LinkActionCard";

import "./PortalHome.css";

type PortalHomeProps = {
  headingId: string;
  title: string;
  description: string;
  actions: readonly LinkActionCardProps[];
};

export function PortalHome({
  headingId,
  title,
  description,
  actions,
}: PortalHomeProps) {
  return (
    <section className="portal-home" aria-labelledby={headingId}>
      <header className="portal-home-heading">
        <h1 id={headingId}>{title}</h1>

        <p className="portal-home-description">{description}</p>
      </header>

      <div className="portal-home-actions">
        {actions.map((action) => (
          <LinkActionCard key={action.to} {...action} />
        ))}
      </div>
    </section>
  );
}
