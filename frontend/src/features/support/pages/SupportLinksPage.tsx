import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import "../../../styles/SupportTheme.css";
import "./SupportLinksPage.css";
import { getDevToken } from "../../auth/devAuth";

type SupportLink = {
    uuid: string;
    case_id: string;
    itar: boolean;
    link: string;
    creator: string;
    users_with_access: string[];
    timestamp: string;
    expired: boolean;
    expiration_date: string;
};

type SortKey = keyof SupportLink;
type SortDirection = "asc" | "desc";

function getSortIcon(
    column: SortKey,
    sortKey: SortKey,
    sortDirection: SortDirection
) {
    if (column !== sortKey) return "⇅";
    return sortDirection === "asc" ? "▲" : "▼";
}

export function SupportLinksPage() {
    const [links, setLinks] = useState<SupportLink[]>([]);
    const [sortKey, setSortKey] = useState<SortKey>("timestamp");
    const [sortDirection, setSortDirection] =
        useState<SortDirection>("desc");

    async function loadLinks() {
        try {
            const response = await fetch("/api/links/", {
                headers: {
                    Authorization: `Bearer ${getDevToken()}`
                }
            });

            if (!response.ok) {
                console.error("Failed to load support links.");
                return;
            }

            const data: SupportLink[] = await response.json();
            setLinks(data);
        } catch (err) {
            console.error(err);
        }
    }

    useEffect(() => {
        loadLinks();
    }, []);

    function handleSort(key: SortKey) {
        if (key === sortKey) {
            setSortDirection((prev) =>
                prev === "asc" ? "desc" : "asc"
            );
        } else {
            setSortKey(key);

            // Default newest first for dates.
            if (key === "timestamp" || key === "expiration_date") {
                setSortDirection("desc");
            } else {
                setSortDirection("asc");
            }
        }
    }

    const sortedLinks = useMemo(() => {
        const copy = [...links];

        copy.sort((a, b) => {
            // Date sorting
            if (
                sortKey === "timestamp" ||
                sortKey === "expiration_date"
            ) {
                const aTime = new Date(a[sortKey]).getTime();
                const bTime = new Date(b[sortKey]).getTime();

                return sortDirection === "asc"
                    ? aTime - bTime
                    : bTime - aTime;
            }

            const aVal = a[sortKey];
            const bVal = b[sortKey];

            // Boolean sorting
            if (
                typeof aVal === "boolean" &&
                typeof bVal === "boolean"
            ) {
                return sortDirection === "asc"
                    ? Number(aVal) - Number(bVal)
                    : Number(bVal) - Number(aVal);
            }

            // String sorting
            const comparison = String(aVal).localeCompare(String(bVal));

            return sortDirection === "asc"
                ? comparison
                : -comparison;
        });

        return copy;
    }, [links, sortKey, sortDirection]);

    return (
        <section className="links-page">
            <header className="links-page-header">
                <div className="links-page-heading">
                    <p className="links-page-eyebrow">
                        Customer Support
                    </p>

                    <h1 id="links-page-heading">
                        Created Upload Links
                    </h1>

                    <p className="links-page-description">
                        Review previously created upload links and
                        access uploaded files.
                    </p>
                </div>

                <Link
                    to="/support/links/new"
                    className="new-link-link"
                >
                    Create Link
                </Link>
            </header>

            <div className="links-table-wrapper">
                <table className="links-table">
                    <thead>
                        <tr>
                            <th
                                onClick={() => handleSort("uuid")}
                                style={{ cursor: "pointer" }}
                            >
                                UUID{" "}
                                {getSortIcon(
                                    "uuid",
                                    sortKey,
                                    sortDirection
                                )}
                            </th>

                            <th
                                onClick={() =>
                                    handleSort("case_id")
                                }
                                style={{ cursor: "pointer" }}
                            >
                                Case ID{" "}
                                {getSortIcon(
                                    "case_id",
                                    sortKey,
                                    sortDirection
                                )}
                            </th>

                            <th
                                onClick={() => handleSort("itar")}
                                style={{ cursor: "pointer" }}
                            >
                                ITAR{" "}
                                {getSortIcon(
                                    "itar",
                                    sortKey,
                                    sortDirection
                                )}
                            </th>

                            <th
                                onClick={() =>
                                    handleSort("creator")
                                }
                                style={{ cursor: "pointer" }}
                            >
                                Creator{" "}
                                {getSortIcon(
                                    "creator",
                                    sortKey,
                                    sortDirection
                                )}
                            </th>

                            <th
                                onClick={() =>
                                    handleSort("timestamp")
                                }
                                style={{ cursor: "pointer" }}
                            >
                                Created (UTC){" "}
                                {getSortIcon(
                                    "timestamp",
                                    sortKey,
                                    sortDirection
                                )}
                            </th>

                            <th
                                onClick={() =>
                                    handleSort("expiration_date")
                                }
                                style={{ cursor: "pointer" }}
                            >
                                Expires (UTC){" "}
                                {getSortIcon(
                                    "expiration_date",
                                    sortKey,
                                    sortDirection
                                )}
                            </th>

                            <th>Upload Link</th>

                            <th>Uploads</th>
                        </tr>
                    </thead>

                    <tbody>
                        {sortedLinks.map((link) => (
                            <tr key={link.uuid}>
                                <td>{link.uuid}</td>

                                <td>{link.case_id}</td>

                                <td>
                                    {link.itar ? (
                                        <span
                                            style={{
                                                fontWeight: "bold",
                                                backgroundColor:
                                                    "#ff4d4d",
                                                color: "white",
                                                padding:
                                                    "4px 8px",
                                                borderRadius:
                                                    "6px"
                                            }}
                                        >
                                            ITAR
                                        </span>
                                    ) : (
                                        "No"
                                    )}
                                </td>

                                <td>{link.creator}</td>

                                <td>
                                    {new Date(
                                        link.timestamp
                                    ).toLocaleString()}
                                </td>

                                <td>
                                    {new Date(
                                        link.expiration_date
                                    ).toLocaleString()}
                                </td>

                                <td>
                                    <Link
                                        to={`/upload/${link.uuid}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="table-link-button"
                                    >
                                        Open Upload Page
                                    </Link>
                                </td>

                                <td>
                                    <Link
                                        to={`/support/view-uploads/${link.uuid}`}
                                        className="table-link-button"
                                    >
                                        View Uploads
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}