import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import { Link } from "react-router-dom";

import { useApiAccessToken } from "../features/auth/useApiAccessToken";
import { formatDate } from "../utils/formatters";
import {
    applySortDirection,
    getAriaSort,
    getSortIcon,
    type SortDirection,
} from "../utils/sorting";

import "./DataTablePage.css";

type SupportLink = {
    uuid: string;
    case_id: string;
    itar: boolean;
    creator: string;
    timestamp: string;
    expiration_date: string;
};

type SortKey =
    | "uuid"
    | "case_id"
    | "itar"
    | "creator"
    | "timestamp"
    | "expiration_date";

type LinksTablePageProps = {
    createPath: string;
    title?: string;
    description?: string;
    uploadActionPathPrefix?: string;
    showItarColumn?: boolean;
};

type PageError = {
    status?: number;
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

function getApiMessage(
    value: unknown,
): string | null {
    if (
        typeof value === "string" &&
        value.trim()
    ) {
        return value.trim();
    }

    if (!Array.isArray(value)) {
        return null;
    }

    const messages = value
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
        .filter(
            (message): message is string =>
                Boolean(message),
        );

    return messages.length > 0
        ? messages.join(" ")
        : null;
}

async function getResponseMessage(
    response: Response,
): Promise<string> {
    const fallback =
        `Failed to load upload links. Status: ${response.status}`;

    try {
        const contentType =
            response.headers.get("content-type") ?? "";

        if (
            contentType.includes("application/json")
        ) {
            const body =
                (await response.json()) as ApiErrorBody;

            return (
                getApiMessage(body.detail) ??
                getApiMessage(body.message) ??
                fallback
            );
        }

        const text = await response.text();

        return text.trim() || fallback;
    } catch {
        return fallback;
    }
}

export function LinksTablePage({
    createPath,
    title = "Created links",
    description =
    "Review generated upload links, customer case IDs, creators, and expiration dates.",
    uploadActionPathPrefix,
    showItarColumn = true,
}: LinksTablePageProps) {
    const getAccessToken =
        useApiAccessToken();

    const [links, setLinks] =
        useState<SupportLink[]>([]);
    const [sortKey, setSortKey] =
        useState<SortKey>("timestamp");
    const [sortDirection, setSortDirection] =
        useState<SortDirection>("desc");
    const [error, setError] =
        useState<PageError | null>(null);
    const [isLoading, setIsLoading] =
        useState(true);

    const loadLinks = useCallback(async () => {
        setError(null);
        setIsLoading(true);

        try {
            const accessToken =
                await getAccessToken();

            if (!accessToken) {
                setLinks([]);
                setError({
                    status: 401,
                    message:
                        "Please sign in before viewing upload links.",
                });
                return;
            }

            const response = await fetch(
                "/api/links/",
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                },
            );

            if (!response.ok) {
                setLinks([]);
                setError({
                    status: response.status,
                    message:
                        await getResponseMessage(response),
                });
                return;
            }

            const data =
                (await response.json()) as SupportLink[];

            setLinks(data);
        } catch {
            setLinks([]);
            setError({
                message:
                    "Something went wrong while loading upload links.",
            });
        } finally {
            setIsLoading(false);
        }
    }, [getAccessToken]);

    useEffect(() => {
        void loadLinks();
    }, [loadLinks]);

    function handleSort(key: SortKey): void {
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

    const sortedLinks = useMemo(() => {
        return [...links].sort((a, b) => {
            const aValue = a[sortKey];
            const bValue = b[sortKey];

            if (DATE_KEYS.has(sortKey)) {
                const comparison =
                    new Date(String(aValue)).getTime() -
                    new Date(String(bValue)).getTime();

                return applySortDirection(
                    comparison,
                    sortDirection,
                );
            }

            if (
                typeof aValue === "boolean" &&
                typeof bValue === "boolean"
            ) {
                return applySortDirection(
                    Number(aValue) - Number(bValue),
                    sortDirection,
                );
            }

            const comparison =
                String(aValue ?? "").localeCompare(
                    String(bValue ?? ""),
                );

            return applySortDirection(
                comparison,
                sortDirection,
            );
        });
    }, [
        links,
        sortDirection,
        sortKey,
    ]);

    const showActions =
        Boolean(uploadActionPathPrefix);

    return (
        <section
            className="data-page"
            aria-labelledby="links-page-heading"
        >
            <header className="data-page-header">
                <div className="data-page-heading">
                    <h1 id="links-page-heading">
                        {title}
                    </h1>

                    <p className="data-page-description">
                        {description}
                    </p>
                </div>

                <Link
                    to={createPath}
                    className="data-page-action"
                >
                    Create link
                </Link>
            </header>

            {isLoading && (
                <p
                    className="data-table-message"
                    role="status"
                >
                    Loading links...
                </p>
            )}

            {!isLoading && error && (
                <div
                    className="data-error-alert"
                    role="alert"
                >
                    <div
                        className="data-error-alert-icon"
                        aria-hidden="true"
                    >
                        !
                    </div>

                    <div className="data-error-alert-content">
                        <div className="data-error-alert-heading">
                            {error.status && (
                                <span className="data-error-alert-status">
                                    {error.status}
                                </span>
                            )}

                            <span>
                                Unable to load links
                            </span>
                        </div>

                        <p className="data-error-alert-message">
                            {error.message}
                        </p>

                        <button
                            className="data-error-retry-button"
                            type="button"
                            onClick={() =>
                                void loadLinks()
                            }
                        >
                            Try again
                        </button>
                    </div>
                </div>
            )}

            {!isLoading &&
                !error &&
                sortedLinks.length === 0 && (
                    <p className="data-table-message">
                        No upload links have been created yet.
                    </p>
                )}

            {!isLoading &&
                !error &&
                sortedLinks.length > 0 && (
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th
                                        scope="col"
                                        aria-sort={getAriaSort(
                                            "uuid",
                                            sortKey,
                                            sortDirection,
                                        )}
                                    >
                                        <button
                                            className="data-table-sort-button"
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

                                    <th
                                        scope="col"
                                        aria-sort={getAriaSort(
                                            "case_id",
                                            sortKey,
                                            sortDirection,
                                        )}
                                    >
                                        <button
                                            className="data-table-sort-button"
                                            type="button"
                                            onClick={() =>
                                                handleSort("case_id")
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
                                        <th
                                            scope="col"
                                            aria-sort={getAriaSort(
                                                "itar",
                                                sortKey,
                                                sortDirection,
                                            )}
                                        >
                                            <button
                                                className="data-table-sort-button"
                                                type="button"
                                                onClick={() =>
                                                    handleSort("itar")
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

                                    <th
                                        scope="col"
                                        aria-sort={getAriaSort(
                                            "creator",
                                            sortKey,
                                            sortDirection,
                                        )}
                                    >
                                        <button
                                            className="data-table-sort-button"
                                            type="button"
                                            onClick={() =>
                                                handleSort("creator")
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

                                    <th
                                        scope="col"
                                        aria-sort={getAriaSort(
                                            "timestamp",
                                            sortKey,
                                            sortDirection,
                                        )}
                                    >
                                        <button
                                            className="data-table-sort-button"
                                            type="button"
                                            onClick={() =>
                                                handleSort("timestamp")
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

                                    <th
                                        scope="col"
                                        aria-sort={getAriaSort(
                                            "expiration_date",
                                            sortKey,
                                            sortDirection,
                                        )}
                                    >
                                        <button
                                            className="data-table-sort-button"
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

                                    {showActions && (
                                        <th scope="col">
                                            Actions
                                        </th>
                                    )}
                                </tr>
                            </thead>

                            <tbody>
                                {sortedLinks.map(
                                    (supportLink) => (
                                        <tr key={supportLink.uuid}>
                                            <td>
                                                <Link
                                                    className="data-table-primary-link"
                                                    to={`/upload/${supportLink.uuid}`}
                                                >
                                                    /upload/{supportLink.uuid}
                                                </Link>

                                            </td>

                                            <td>
                                                {supportLink.case_id}
                                            </td>

                                            {showItarColumn && (
                                                <td>
                                                    {supportLink.itar ? (
                                                        <span className="data-table-badge data-table-badge--danger">
                                                            ITAR
                                                        </span>
                                                    ) : (
                                                        "No"
                                                    )}
                                                </td>
                                            )}

                                            <td>
                                                {supportLink.creator}
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

                                            {uploadActionPathPrefix && (
                                                <td>
                                                    <Link
                                                        className="data-table-action-link"
                                                        to={`${uploadActionPathPrefix}/${supportLink.uuid}`}
                                                    >
                                                        View uploads
                                                    </Link>
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