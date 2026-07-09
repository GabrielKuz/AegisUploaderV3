import { Link } from "react-router-dom";
import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import { useMsal } from "@azure/msal-react";

import "../features/support/SupportLinksPage.css";
import { isEntraConfigured } from "../features/auth/authConfig";
import {
    getActiveAccount,
    getApiAccessToken,
} from "../features/auth/entraAuth";
import { getDevToken } from "../features/auth/devAuth";

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

type LinksTablePageProps = {
    eyebrow?: string;
    title?: string;
    description?: string;
    createPath: string;
    uploadActionPathPrefix?: string;
    showUploadActions?: boolean;
    showItarColumn?: boolean;
};

const DATE_KEYS = new Set<SortKey>([
    "timestamp",
    "expiration_date",
]);

function getSortIcon(
    column: SortKey,
    sortKey: SortKey,
    sortDirection: SortDirection,
) {
    if (column !== sortKey) return "⇅";
    return sortDirection === "asc" ? "▲" : "▼";
}

function formatDate(value: string) {
    return new Date(value).toLocaleString();
}

export function LinksTablePage({
    eyebrow,
    title = "Created links",
    description = "Review generated upload links, customer case IDs, creators, and expiration dates.",
    createPath,
    uploadActionPathPrefix,
    showUploadActions = false,
    showItarColumn = true,
}: LinksTablePageProps) {
    const [links, setLinks] = useState<SupportLink[]>([]);
    const [sortKey, setSortKey] = useState<SortKey>("timestamp");
    const [sortDirection, setSortDirection] =
        useState<SortDirection>("desc");
    const [error, setError] = useState<string | null>(null);

    const { accounts, instance } = useMsal();

    useEffect(() => {
        if (!instance.getActiveAccount() && accounts[0]) {
            instance.setActiveAccount(accounts[0]);
        }
    }, [accounts, instance]);

    const getAccessToken = useCallback(async () => {
        const account = getActiveAccount(instance) ?? accounts[0];

        if (isEntraConfigured && !account) {
            return null;
        }

        if (account && !instance.getActiveAccount()) {
            instance.setActiveAccount(account);
        }

        return isEntraConfigured
            ? getApiAccessToken(instance, account)
            : getDevToken();
    }, [accounts, instance]);

    const loadLinks = useCallback(async () => {
        try {
            const accessToken = await getAccessToken();

            if (!accessToken) {
                setError("Please sign in before viewing support links.");
                return;
            }

            const response = await fetch("/api/links/", {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                setError("Failed to load support links.");
                return;
            }

            const data: SupportLink[] = await response.json();

            setLinks(data);
            setError(null);
        } catch {
            setError("Something went wrong while loading support links.");
        }
    }, [getAccessToken]);

    useEffect(() => {
        void loadLinks();
    }, [loadLinks]);

    function handleSort(key: SortKey) {
        if (key === sortKey) {
            setSortDirection((currentDirection) =>
                currentDirection === "asc" ? "desc" : "asc",
            );
            return;
        }

        setSortKey(key);
        setSortDirection(DATE_KEYS.has(key) ? "desc" : "asc");
    }

    const sortedLinks = useMemo(() => {
        return [...links].sort((a, b) => {
            const aValue = a[sortKey];
            const bValue = b[sortKey];

            if (DATE_KEYS.has(sortKey)) {
                const comparison =
                    new Date(String(aValue)).getTime() -
                    new Date(String(bValue)).getTime();

                return sortDirection === "asc" ? comparison : -comparison;
            }

            if (
                typeof aValue === "boolean" &&
                typeof bValue === "boolean"
            ) {
                const comparison = Number(aValue) - Number(bValue);
                return sortDirection === "asc" ? comparison : -comparison;
            }

            const comparison = String(aValue ?? "").localeCompare(
                String(bValue ?? ""),
            );

            return sortDirection === "asc" ? comparison : -comparison;
        });
    }, [links, sortKey, sortDirection]);

    return (
        <section
            className="links-page"
            aria-labelledby="links-page-heading"
        >
            <header className="links-page-header">
                <div className="links-page-heading">
                    {eyebrow && (
                        <p className="links-page-eyebrow">
                            {eyebrow}
                        </p>
                    )}

                    <h1 id="links-page-heading">
                        {title}
                    </h1>

                    <p className="links-page-description">
                        {description}
                    </p>
                </div>

                <Link
                    to={createPath}
                    className="new-link-link"
                >
                    Create link
                </Link>
            </header>

            {error && (
                <p className="table-message" role="alert">
                    {error}
                </p>
            )}

            {!error && sortedLinks.length === 0 && (
                <p className="table-message">
                    No upload links have been created yet.
                </p>
            )}

            {sortedLinks.length > 0 && (
                <div className="links-table-wrapper">
                    <table className="links-table">
                        <thead>
                            <tr>
                                <th>
                                    <button
                                        className="table-sort-button"
                                        type="button"
                                        onClick={() => handleSort("uuid")}
                                    >
                                        Upload link {getSortIcon("uuid", sortKey, sortDirection)}
                                    </button>
                                </th>

                                <th>
                                    <button
                                        className="table-sort-button"
                                        type="button"
                                        onClick={() => handleSort("case_id")}
                                    >
                                        Case ID {getSortIcon("case_id", sortKey, sortDirection)}
                                    </button>
                                </th>

                                {showItarColumn && (
                                    <th>
                                        <button
                                            className="table-sort-button"
                                            type="button"
                                            onClick={() => handleSort("itar")}
                                        >
                                            ITAR {getSortIcon("itar", sortKey, sortDirection)}
                                        </button>
                                    </th>
                                )}

                                <th>
                                    <button
                                        className="table-sort-button"
                                        type="button"
                                        onClick={() => handleSort("creator")}
                                    >
                                        Creator {getSortIcon("creator", sortKey, sortDirection)}
                                    </button>
                                </th>

                                <th>
                                    <button
                                        className="table-sort-button"
                                        type="button"
                                        onClick={() => handleSort("timestamp")}
                                    >
                                        Created {getSortIcon("timestamp", sortKey, sortDirection)}
                                    </button>
                                </th>

                                <th>
                                    <button
                                        className="table-sort-button"
                                        type="button"
                                        onClick={() => handleSort("expiration_date")}
                                    >
                                        Expires {getSortIcon("expiration_date", sortKey, sortDirection)}
                                    </button>
                                </th>

                                {showUploadActions && (
                                    <th>Actions</th>
                                )}
                            </tr>
                        </thead>

                        <tbody>
                            {sortedLinks.map((supportLink) => (
                                <tr key={supportLink.uuid}>
                                    <td>
                                        <Link to={`/upload/${supportLink.uuid}`}>
                                            /upload/{supportLink.uuid}
                                        </Link>
                                    </td>

                                    <td>{supportLink.case_id}</td>

                                    {showItarColumn && (
                                        <td>
                                            {supportLink.itar ? (
                                                <span className="link-badge link-badge-danger">
                                                    ITAR
                                                </span>
                                            ) : (
                                                "No"
                                            )}
                                        </td>
                                    )}

                                    <td>{supportLink.creator}</td>
                                    <td>{formatDate(supportLink.timestamp)}</td>
                                    <td>{formatDate(supportLink.expiration_date)}</td>

                                    {showUploadActions && (
                                        <td>
                                            {uploadActionPathPrefix ? (
                                                <Link
                                                    className="table-action-link"
                                                    to={`${uploadActionPathPrefix}/${supportLink.uuid}`}
                                                >
                                                    View uploads
                                                </Link>
                                            ) : (
                                                <span className="table-muted-text">
                                                    —
                                                </span>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}