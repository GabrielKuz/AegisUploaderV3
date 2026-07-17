import type { LinkActionCardProps } from "./LinkActionCard";
import { LinkActionCard } from "./LinkActionCard";

import "./PortalHomePage.css";

type PortalHomePageProps = {
    headingId: string;
    title: string;
    description: string;
    actions: readonly LinkActionCardProps[];
};

export function PortalHomePage({
    headingId,
    title,
    description,
    actions,
}: PortalHomePageProps) {
    return (
        <section
            className="portal-home"
            aria-labelledby={headingId}
        >
            <header className="portal-home-heading">
                <h1 id={headingId}>
                    {title}
                </h1>

                <p className="portal-home-description">
                    {description}
                </p>
            </header>

            <div className="portal-home-actions">
                {actions.map((action) => (
                    <LinkActionCard
                        key={action.to}
                        {...action}
                    />
                ))}
            </div>
        </section>
    );
}