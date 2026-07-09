import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type LinkActionCardProps = {
    to: string;
    number: string;
    title: string;
    description: string;
    actionLabel: string;
    icon: ReactNode;
};

export function LinkActionCard({
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
            aria-label={`${title}: ${actionLabel}`}
        >
            <span className="link-action-accent" aria-hidden="true" />

            <div className="link-action-top">
                <span className="link-action-number" aria-hidden="true">
                    {number}
                </span>

                <span className="link-action-icon" aria-hidden="true">
                    {icon}
                </span>
            </div>

            <div className="link-action-divider" aria-hidden="true" />

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

            <span className="link-action-dots" aria-hidden="true" />
        </Link>
    );
}

export function LinksIcon() {
    return (
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
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

export function CreateLinkIcon() {
    return (
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
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

export function UploadsIcon() {
    return (
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path
                d="M12 16V5M8 9l4-4 4 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            <path
                d="M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
            />
        </svg>
    );
}