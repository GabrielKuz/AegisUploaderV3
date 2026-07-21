import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    Link,
    useParams,
} from "react-router-dom";

import {
    formatBytes,
    formatDate,
} from "../../utils/formatters";
import {
    applySortDirection,
    getAriaSort,
    getSortIcon,
    type SortDirection,
} from "../../utils/sorting";
import { useApiAccessToken } from "../auth/useApiAccessToken";
import "../../components/DataTablePage.css";

const REQUEST_DEDUPE_WINDOW_MS = 1_000;

type Upload = {
    upload_id: string;
    blob_name: string;
    size: number;
    expiration_date: string;
    upload_complete: boolean;
    date_uploaded: string;
};

type SortKey =
    | "blob_name"
    | "size"
    | "expiration_date"
    | "upload_complete"
    | "date_uploaded";

type UploadRequestEntry = {
    createdAt: number;
    promise: Promise<Upload[]>;
};

const DATE_KEYS = new Set<SortKey>([
    "date_uploaded",
    "expiration_date",
]);

const uploadRequestCache =
    new Map<string, UploadRequestEntry>();

/**
 * Extracts a readable API error message without displaying
 * an entire serialized JSON response.
 */
async function getResponseMessage(
    response: Response,
): Promise<string> {
    const fallback =
        `Failed to load uploaded files. Status: ${response.status}`;

    try {
        const contentType =
            response.headers.get("content-type") ?? "";

        if (
            contentType.includes("application/json")
        ) {
            const body =
                (await response.json()) as {
                    detail?: unknown;
                    message?: unknown;
                };

            if (
                typeof body.detail === "string" &&
                body.detail.trim()
            ) {
                return body.detail.trim();
            }

            if (
                typeof body.message === "string" &&
                body.message.trim()
            ) {
                return body.message.trim();
            }

            return fallback;
        }

        const text =
            await response.text();

        return text.trim() || fallback;
    } catch {
        return fallback;
    }
}

/**
 * Requests uploaded files while deduplicating React Strict Mode's
 * repeated development effect cycle.
 */
function requestUploads(
    uuid: string,
    accessToken: string,
    forceRefresh = false,
): Promise<Upload[]> {
    const existingRequest =
        uploadRequestCache.get(uuid);

    const existingRequestIsCurrent =
        existingRequest &&
        Date.now() - existingRequest.createdAt <
        REQUEST_DEDUPE_WINDOW_MS;

    if (
        !forceRefresh &&
        existingRequestIsCurrent
    ) {
        return existingRequest.promise;
    }

    if (forceRefresh) {
        uploadRequestCache.delete(uuid);
    }

    const request = fetch(
        `/api/links/${uuid}/files`,
        {
            headers: {
                Authorization:
                    `Bearer ${accessToken}`,
            },
        },
    ).then(async (response) => {
        if (!response.ok) {
            throw new Error(await getResponseMessage(response));
        }

        return (
            await response.json()
        ) as Upload[];
    });

    const entry: UploadRequestEntry = {
        createdAt: Date.now(),
        promise: request,
    };

    uploadRequestCache.set(uuid, entry);

    const removeRequest = (): void => {
        window.setTimeout(() => {
            if (
                uploadRequestCache.get(uuid) ===
                entry
            ) {
                uploadRequestCache.delete(uuid);
            }
        }, REQUEST_DEDUPE_WINDOW_MS);
    };

    request.then(
        removeRequest,
        removeRequest,
    );

    return request;
}

/**
 * Returns the display label for the upload's current state.
 * The current API only exposes complete or incomplete state.
 */
function getUploadStatusLabel(
    uploadComplete: boolean,
): string {
    return uploadComplete
        ? "Complete"
        : "In progress";
}

export function SupportUploadPage() {
    const { uuid } = useParams<{ uuid: string }>();

    const getAccessToken = useApiAccessToken();

    const [uploads, setUploads] = useState<Upload[]>([]);

    const [sortKey, setSortKey] = useState<SortKey>("date_uploaded");

    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

    const [error, setError] = useState<string | null>(null);

    const [isLoading, setIsLoading] = useState(true);

    // Create a request to extend uuid

    const loadUploads = useCallback(
        async (forceRefresh = false): Promise<void> => {
            setError(null);
            setIsLoading(true);

            if (!uuid) {
                setUploads([]);
                setError("No upload link was selected.");
                setIsLoading(false);
                return;
            }

            try {
                const accessToken = await getAccessToken();

                if (!accessToken) {
                    setUploads([]);
                    setError("Please sign in before viewing uploaded files.");
                    return;
                }

                const data = await requestUploads(uuid, accessToken, forceRefresh);

                setUploads(data);
            } catch (requestError) {
                setUploads([]);
                setError(requestError instanceof Error ? requestError.message : "Something went wrong while loading uploaded files.");
            } finally {
                setIsLoading(false);
            }
        }, [getAccessToken, uuid],
    );

    useEffect(() => {
        void loadUploads();
    }, [loadUploads]);

    function handleSort(key: SortKey): void {
        if (key === sortKey) {
            setSortDirection((currentDirection) => currentDirection === "asc" ? "desc" : "asc");
            return;
        }

        setSortKey(key);

        setSortDirection(DATE_KEYS.has(key) ? "desc" : "asc");
    }

    const sortedUploads = useMemo(() => {
        return [...uploads].sort((a, b) => {
            const aValue = a[sortKey];
            const bValue = b[sortKey];

            if (DATE_KEYS.has(sortKey)) {
                const comparison = new Date(String(aValue)).getTime() - new Date(String(bValue)).getTime();
                return applySortDirection(comparison, sortDirection);
            }

            if (typeof aValue === "number" && typeof bValue === "number") {
                return applySortDirection(aValue - bValue, sortDirection);
            }

            if (typeof aValue === "boolean" && typeof bValue === "boolean") {
                return applySortDirection(Number(aValue) - Number(bValue), sortDirection);
            }

            const comparison = String(aValue ?? "").localeCompare(String(bValue ?? ""));

            return applySortDirection(comparison, sortDirection);
        });
    }, [uploads, sortDirection, sortKey]);


    //async function requestExtend (uploadUuid: string)

    return (
        <section
            className="data-page"
            aria-labelledby="support-upload-heading"
        >
            <header className="data-page-header">
                <div className="data-page-heading">
                    <h1 id="support-upload-heading">
                        Uploaded files
                    </h1>

                    <p className="data-page-description">
                        View files received through this customer upload link.
                    </p>
                </div>

                <Link
                    to="/support/links"
                    className="data-page-action"
                >
                    Back to Links
                </Link>
            </header>

            {isLoading && (
                <p
                    className="data-table-message"
                    role="status"
                >
                    Loading uploaded files...
                </p>
            )}

            {/* Add error status*/}
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
                            <span>
                                Unable to load files
                            </span>
                        </div>

                        <p className="data-error-alert-message">
                            {error}
                        </p>

                        <button
                            className="data-error-retry-button"
                            type="button"
                            onClick={() =>
                                void loadUploads(true)
                            }
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            )}

            {!isLoading &&
                !error &&
                sortedUploads.length === 0 && (
                    <p className="data-table-message">
                        No uploaded file records found.
                    </p>
                )}

            {!isLoading && !error && sortedUploads.length > 0 && (
                <div className="data-table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th
                                    scope="col"
                                    aria-sort={getAriaSort(
                                        "blob_name",
                                        sortKey,
                                        sortDirection,
                                    )}
                                >
                                    <button
                                        className="data-table-sort-button"
                                        type="button"
                                        onClick={() =>
                                            handleSort("blob_name")
                                        }
                                    >
                                        File{" "}
                                        {getSortIcon(
                                            "blob_name",
                                            sortKey,
                                            sortDirection,
                                        )}
                                    </button>
                                </th>

                                <th
                                    scope="col"
                                    aria-sort={getAriaSort(
                                        "size",
                                        sortKey,
                                        sortDirection,
                                    )}
                                >
                                    <button
                                        className="data-table-sort-button"
                                        type="button"
                                        onClick={() =>
                                            handleSort("size")
                                        }
                                    >
                                        Size{" "}
                                        {getSortIcon(
                                            "size",
                                            sortKey,
                                            sortDirection,
                                        )}
                                    </button>
                                </th>

                                <th
                                    scope="col"
                                    aria-sort={getAriaSort(
                                        "upload_complete",
                                        sortKey,
                                        sortDirection,
                                    )}
                                >
                                    <button
                                        className="data-table-sort-button"
                                        type="button"
                                        onClick={() =>
                                            handleSort(
                                                "upload_complete",
                                            )
                                        }
                                    >
                                        Status{" "}
                                        {getSortIcon(
                                            "upload_complete",
                                            sortKey,
                                            sortDirection,
                                        )}
                                    </button>
                                </th>

                                <th
                                    scope="col"
                                    aria-sort={getAriaSort(
                                        "date_uploaded",
                                        sortKey,
                                        sortDirection,
                                    )}
                                >
                                    <button
                                        className="data-table-sort-button"
                                        type="button"
                                        onClick={() =>
                                            handleSort(
                                                "date_uploaded",
                                            )
                                        }
                                    >
                                        Uploaded{" "}
                                        {getSortIcon(
                                            "date_uploaded",
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
                                            handleSort("expiration_date")}
                                    >
                                        Expires{" "}
                                        {getSortIcon("expiration_date", sortKey, sortDirection)}
                                    </button>
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {sortedUploads.map((upload) => (
                                <tr key={upload.blob_name}>
                                    <td>{upload.blob_name}</td>
                                    <td>{formatBytes(upload.size)}</td>

                                    <td>
                                        <span
                                            className={upload.upload_complete
                                                ? "data-table-badge data-table-badge--complete"
                                                : "data-table-badge data-table-badge--progress"
                                            }
                                        >
                                            {getUploadStatusLabel(upload.upload_complete)}
                                        </span>
                                    </td>

                                    <td> {formatDate(upload.date_uploaded)} </td>

                                    <td>{formatDate(upload.expiration_date)} </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}