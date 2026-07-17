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

type Upload = {
    upload_id: string;
    filename: string;
    size: number;
    content_type: string;
    date_uploaded: string;
};

type SortKey =
    | "filename"
    | "size"
    | "content_type"
    | "date_uploaded";

const DATE_KEYS = new Set<SortKey>([
    "date_uploaded",
]);

export function SupportUploadPage() {
    const { uuid } =
        useParams<{ uuid: string }>();

    const getAccessToken =
        useApiAccessToken();

    const [uploads, setUploads] =
        useState<Upload[]>([]);
    const [sortKey, setSortKey] =
        useState<SortKey>("date_uploaded");
    const [sortDirection, setSortDirection] =
        useState<SortDirection>("desc");
    const [error, setError] =
        useState<string | null>(null);
    const [isLoading, setIsLoading] =
        useState(true);

    const loadUploads = useCallback(async () => {
        setError(null);
        setIsLoading(true);

        if (!uuid) {
            setUploads([]);
            setError(
                "No upload link was selected.",
            );
            setIsLoading(false);
            return;
        }

        try {
            const accessToken =
                await getAccessToken();

            if (!accessToken) {
                setUploads([]);
                setError(
                    "Please sign in before viewing uploads.",
                );
                return;
            }

            const response = await fetch(
                `/api/links/${uuid}/files`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                },
            );

            if (!response.ok) {
                setUploads([]);
                setError(
                    "Failed to load uploaded files.",
                );
                return;
            }

            const data =
                (await response.json()) as Upload[];

            setUploads(data);
        } catch {
            setUploads([]);
            setError(
                "Something went wrong while loading uploaded files.",
            );
        } finally {
            setIsLoading(false);
        }
    }, [
        getAccessToken,
        uuid,
    ]);

    useEffect(() => {
        void loadUploads();
    }, [loadUploads]);

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

    const sortedUploads = useMemo(() => {
        return [...uploads].sort((a, b) => {
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
                typeof aValue === "number" &&
                typeof bValue === "number"
            ) {
                return applySortDirection(
                    aValue - bValue,
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
        uploads,
        sortDirection,
        sortKey,
    ]);

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
                        View files uploaded for this support link.
                    </p>
                </div>

                <Link
                    to="/support/links"
                    className="data-page-action"
                >
                    Back to links
                </Link>
            </header>

            {isLoading && (
                <p
                    className="data-table-message"
                    role="status"
                >
                    Loading uploads...
                </p>
            )}

            {!isLoading && error && (
                <p
                    className="data-table-message"
                    role="alert"
                >
                    {error}
                </p>
            )}

            {!isLoading &&
                !error &&
                sortedUploads.length === 0 && (
                    <p className="data-table-message">
                        No uploads found for this link.
                    </p>
                )}

            {!isLoading &&
                !error &&
                sortedUploads.length > 0 && (
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th
                                        scope="col"
                                        aria-sort={getAriaSort(
                                            "filename",
                                            sortKey,
                                            sortDirection,
                                        )}
                                    >
                                        <button
                                            className="data-table-sort-button"
                                            type="button"
                                            onClick={() =>
                                                handleSort("filename")
                                            }
                                        >
                                            File{" "}
                                            {getSortIcon(
                                                "filename",
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
                                            "content_type",
                                            sortKey,
                                            sortDirection,
                                        )}
                                    >
                                        <button
                                            className="data-table-sort-button"
                                            type="button"
                                            onClick={() =>
                                                handleSort("content_type")
                                            }
                                        >
                                            Type{" "}
                                            {getSortIcon(
                                                "content_type",
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
                                                handleSort("date_uploaded")
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
                                </tr>
                            </thead>

                            <tbody>
                                {sortedUploads.map((upload) => (
                                    <tr key={upload.upload_id}>
                                        <td>{upload.filename}</td>

                                        <td>
                                            {formatBytes(upload.size)}
                                        </td>

                                        <td>
                                            {upload.content_type || "—"}
                                        </td>

                                        <td>
                                            {formatDate(
                                                upload.date_uploaded,
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
        </section>
    );
}