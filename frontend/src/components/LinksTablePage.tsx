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

type PageError = {
    status?: number;
    title: string;
    message: string;
};

type ApiErrorBody = {
    detail?: unknown;
    message?: unknown;
};

const DATE_KEYS = new Set<SortKey>([
    "timestamp",
    "expiration_date",
]);

/**
 * Returns the appropriate sort icon for a table column.
 */
function getSortIcon(
    column: SortKey,
    sortKey: SortKey,
    sortDirection: SortDirection,
) {
    if (column !== sortKey) {
        return "⇅";
    }

    return sortDirection === "asc" ? "▲" : "▼";
}

/**
 * Formats an API date value for display.
 */
function formatDate(value: string) {
    return new Date(value).toLocaleString();
}

/**
 * Returns a human-readable title for an HTTP error status.
 */
function getHttpErrorTitle(status: number): string {
    switch (status) {
        case 400:
            return "Bad Request";

        case 401:
            return "Unauthorized";

        case 403:
            return "Forbidden";

        case 404:
            return "Not Found";

        case 409:
            return "Conflict";

        case 422:
            return "Validation Error";

        case 429:
            return "Too Many Requests";

        case 500:
            return "Internal Server Error";

        case 502:
            return "Bad Gateway";

        case 503:
            return "Service Unavailable";

        default:
            return "Request Failed";
    }
}

/**
 * Returns a fallback message when the API does not provide one.
 */
function getDefaultErrorMessage(status: number): string {
    switch (status) {
        case 400:
            return "The request could not be completed.";

        case 401:
            return "Your session is not authorized to view support links.";

        case 403:
            return "You do not have permission to view support links.";

        case 404:
            return "The requested support links resource could not be found.";

        case 409:
            return "The request conflicts with the current state of the resource.";

        case 422:
            return "The request contained invalid data.";

        case 429:
            return "Too many requests were made. Please try again shortly.";

        case 500:
            return "The server encountered an unexpected error.";

        case 502:
            return "The server received an invalid response from another service.";

        case 503:
            return "The service is temporarily unavailable.";

        default:
            return "Failed to load support links.";
    }
}

/**
 * Converts an unknown API error value into displayable text.
 *
 * FastAPI usually returns:
 * {
 *   "detail": "Some error message"
 * }
 *
 * Validation errors can also return arrays or objects.
 */
function getApiErrorText(value: unknown): string | null {
    if (typeof value === "string" && value.trim()) {
        return value.trim();
    }

    if (Array.isArray(value) && value.length > 0) {
        return value
            .map((item) => {
                if (
                    typeof item === "object" &&
                    item !== null &&
                    "msg" in item &&
                    typeof item.msg === "string"
                ) {
                    return item.msg;
                }

                return null;
            })
            .filter((message): message is string => Boolean(message))
            .join(" ");
    }

    return null;
}

/**
 * Reads the error response body and returns the most useful message
 * available from the backend.
 */
async function getResponseErrorMessage(
    response: Response,
): Promise<string> {
    const fallbackMessage = getDefaultErrorMessage(response.status);
    const contentType = response.headers.get("content-type") ?? "";

    try {
        if (contentType.includes("application/json")) {
            const body = (await response.json()) as ApiErrorBody;

            return (
                getApiErrorText(body.detail) ??
                getApiErrorText(body.message) ??
                fallbackMessage
            );
        }

        const text = await response.text();

        return text.trim() || fallbackMessage;
    } catch {
        return fallbackMessage;
    }
}

export function LinksTablePage({
    eyebrow,
    title = "Created links",
    description =
    "Review generated upload links, customer case IDs, creators, and expiration dates.",
    createPath,
    uploadActionPathPrefix,
    showUploadActions = false,
    showItarColumn = true,
}: LinksTablePageProps) {
    const [links, setLinks] = useState<SupportLink[]>([]);

    const [sortKey, setSortKey] =
        useState<SortKey>("timestamp");

    const [sortDirection, setSortDirection] =
        useState<SortDirection>("desc");

    const [error, setError] =
        useState<PageError | null>(null);

    const { accounts, instance } = useMsal();

    /**
     * Ensures MSAL has an active account when an account is available.
     */
    useEffect(() => {
        if (!instance.getActiveAccount() && accounts[0]) {
            instance.setActiveAccount(accounts[0]);
        }
    }, [accounts, instance]);

    /**
     * Returns the appropriate API access token for the current environment.
     */
    const getAccessToken = useCallback(async () => {
        if (!isEntraConfigured) {
            return getDevToken();
        }

        const account =
            getActiveAccount(instance) ??
            accounts[0];

        if (!account) {
            return null;
        }

        if (!instance.getActiveAccount()) {
            instance.setActiveAccount(account);
        }

        return getApiAccessToken(
            instance,
            account,
        );
    }, [accounts, instance]);

    /**
     * Loads all support links from the API.
     */
    const loadLinks = useCallback(async () => {
        setError(null);

        try {
            const accessToken = await getAccessToken();

            if (!accessToken) {
                setLinks([]);

                setError({
                    status: 401,
                    title: "Authentication Required",
                    message:
                        "Please sign in before viewing support links.",
                });

                return;
            }

            const response = await fetch(
                "/api/links/",
                {
                    headers: {
                        Authorization:
                            `Bearer ${accessToken}`,
                    },
                },
            );

            if (!response.ok) {
                const message =
                    await getResponseErrorMessage(response);

                setLinks([]);

                setError({
                    status: response.status,
                    title: getHttpErrorTitle(
                        response.status,
                    ),
                    message,
                });

                return;
            }

            const data =
                (await response.json()) as SupportLink[];

            setLinks(data);
            setError(null);
        } catch {
            setLinks([]);

            setError({
                title: "Connection Error",
                message:
                    "Something went wrong while loading support links. Check your connection and try again.",
            });
        }
    }, [getAccessToken]);

    /**
     * Loads the links when the page first mounts.
     */
    useEffect(() => {
        void loadLinks();
    }, [loadLinks]);

    /**
     * Changes the active table sort.
     */
    function handleSort(key: SortKey) {
        if (key === sortKey) {
            setSortDirection(
                (currentDirection) =>
                    currentDirection === "asc"
                        ? "desc"
                        : "asc",
            );

            return;
        }

        setSortKey(key);

        setSortDirection(
            DATE_KEYS.has(key)
                ? "desc"
                : "asc",
        );
    }

    /**
     * Returns a sorted copy of the support links.
     */
    const sortedLinks = useMemo(() => {
        return [...links].sort((a, b) => {
            const aValue = a[sortKey];
            const bValue = b[sortKey];

            if (DATE_KEYS.has(sortKey)) {
                const comparison =
                    new Date(
                        String(aValue),
                    ).getTime() -
                    new Date(
                        String(bValue),
                    ).getTime();

                return sortDirection === "asc"
                    ? comparison
                    : -comparison;
            }

            if (
                typeof aValue === "boolean" &&
                typeof bValue === "boolean"
            ) {
                const comparison =
                    Number(aValue) -
                    Number(bValue);

                return sortDirection === "asc"
                    ? comparison
                    : -comparison;
            }

            const comparison =
                String(aValue ?? "").localeCompare(
                    String(bValue ?? ""),
                );

            return sortDirection === "asc"
                ? comparison
                : -comparison;
        });
    }, [
        links,
        sortKey,
        sortDirection,
    ]);

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
                <div
                    className="links-error-alert"
                    role="alert"
                    aria-live="assertive"
                >
                    <div
                        className="links-error-alert-icon"
                        aria-hidden="true"
                    >
                        !
                    </div>

                    <div className="links-error-alert-content">
                        <div className="links-error-alert-heading">
                            {error.status && (
                                <span className="links-error-alert-status">
                                    {error.status}
                                </span>
                            )}

                            <span className="links-error-alert-title">
                                {error.title}
                            </span>
                        </div>

                        <p className="links-error-alert-message">
                            {error.message}
                        </p>

                        <button
                            type="button"
                            className="links-error-retry-button"
                            onClick={() => void loadLinks()}
                        >
                            Try again
                        </button>
                    </div>
                </div>
            )}

            {!error && sortedLinks.length === 0 && (
                <p className="table-message">
                    No upload links have been created yet.
                </p>
            )}

            {!error && sortedLinks.length > 0 && (
                <div className="links-table-wrapper">
                    <table className="links-table">
                        <thead>
                            <tr>
                                <th>
                                    <button
                                        className="table-sort-button"
                                        type="button"
                                        onClick={() =>
                                            handleSort("uuid")
                                        }
                                    >
                                        Upload link{" "}
                                        {getSortIcon(
                                            "uuid",
                                            sortKey,
                                            sortDirection,
                                        )}
                                    </button>
                                </th>

                                <th>
                                    <button
                                        className="table-sort-button"
                                        type="button"
                                        onClick={() =>
                                            handleSort(
                                                "case_id",
                                            )
                                        }
                                    >
                                        Case ID{" "}
                                        {getSortIcon(
                                            "case_id",
                                            sortKey,
                                            sortDirection,
                                        )}
                                    </button>
                                </th>

                                {showItarColumn && (
                                    <th>
                                        <button
                                            className="table-sort-button"
                                            type="button"
                                            onClick={() =>
                                                handleSort(
                                                    "itar",
                                                )
                                            }
                                        >
                                            ITAR{" "}
                                            {getSortIcon(
                                                "itar",
                                                sortKey,
                                                sortDirection,
                                            )}
                                        </button>
                                    </th>
                                )}

                                <th>
                                    <button
                                        className="table-sort-button"
                                        type="button"
                                        onClick={() =>
                                            handleSort(
                                                "creator",
                                            )
                                        }
                                    >
                                        Creator{" "}
                                        {getSortIcon(
                                            "creator",
                                            sortKey,
                                            sortDirection,
                                        )}
                                    </button>
                                </th>

                                <th>
                                    <button
                                        className="table-sort-button"
                                        type="button"
                                        onClick={() =>
                                            handleSort(
                                                "timestamp",
                                            )
                                        }
                                    >
                                        Created{" "}
                                        {getSortIcon(
                                            "timestamp",
                                            sortKey,
                                            sortDirection,
                                        )}
                                    </button>
                                </th>

                                <th>
                                    <button
                                        className="table-sort-button"
                                        type="button"
                                        onClick={() =>
                                            handleSort(
                                                "expiration_date",
                                            )
                                        }
                                    >
                                        Expires{" "}
                                        {getSortIcon(
                                            "expiration_date",
                                            sortKey,
                                            sortDirection,
                                        )}
                                    </button>
                                </th>

                                {showUploadActions && (
                                    <th>
                                        Actions
                                    </th>
                                )}
                            </tr>
                        </thead>

                        <tbody>
                            {sortedLinks.map(
                                (supportLink) => (
                                    <tr
                                        key={
                                            supportLink.uuid
                                        }
                                    >
                                        <td>
                                            <Link
                                                to={`/upload/${supportLink.uuid}`}
                                            >
                                                /upload/
                                                {
                                                    supportLink.uuid
                                                }
                                            </Link>
                                        </td>

                                        <td>
                                            {
                                                supportLink.case_id
                                            }
                                        </td>

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

                                        <td>
                                            {
                                                supportLink.creator
                                            }
                                        </td>

                                        <td>
                                            {formatDate(
                                                supportLink.timestamp,
                                            )}
                                        </td>

                                        <td>
                                            {formatDate(
                                                supportLink.expiration_date,
                                            )}
                                        </td>

                                        {showUploadActions && (
                                            <td>
                                                {uploadActionPathPrefix ? (
                                                    <Link
                                                        className="table-action-link"
                                                        to={`${uploadActionPathPrefix}/${supportLink.uuid}`}
                                                    >
                                                        View Uploads
                                                    </Link>
                                                ) : (
                                                    <span className="table-muted-text">
                                                        —
                                                    </span>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ),
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}