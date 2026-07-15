import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import { Link, useParams } from "react-router-dom";
import { useMsal } from "@azure/msal-react";

import "./SupportLinksPage.css";
import { isEntraConfigured } from "../auth/authConfig";
import {
    getActiveAccount,
    getApiAccessToken,
} from "../auth/entraAuth";
import { getDevToken } from "../auth/devAuth";

type Upload = {
    upload_id: string;
    filename: string;
    size: number;
    blob_name: string;
    content_type: string;
    date_uploaded: string;
};

type SortKey = keyof Upload;
type SortDirection = "asc" | "desc";

const DATE_KEYS = new Set<SortKey>(["date_uploaded"]);

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

function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";

    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        units.length - 1,
    );

    const value = bytes / 1024 ** index;
    const precision = value >= 10 || index === 0 ? 0 : 1;

    return `${value.toFixed(precision)} ${units[index]}`;
}

export function SupportUploadPage() {
    const { uuid } = useParams<{ uuid: string }>();

    const [uploads, setUploads] = useState<Upload[]>([]);
    const [sortKey, setSortKey] =
        useState<SortKey>("date_uploaded");
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
        if (!isEntraConfigured) {
            return getDevToken();
        }

        const account = getActiveAccount(instance) ?? accounts[0];

        if (!account) {
            return null;
        }

        if (!instance.getActiveAccount()) {
            instance.setActiveAccount(account);
        }

        return getApiAccessToken(instance, account);
    }, [accounts, instance]);

    const loadUploads = useCallback(async () => {
        if (!uuid) {
            setError("No upload link was selected.");
            return;
        }

        try {
            const accessToken = await getAccessToken();

            if (!accessToken) {
                setError("Please sign in before viewing uploads.");
                return;
            }

            const response = await fetch(`/api/links/${uuid}/files`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                setError("Failed to load uploads.");
                return;
            }

            const data: Upload[] = await response.json();

            setUploads(data);
            setError(null);
        } catch {
            setError("Something went wrong while loading uploads.");
        }
    }, [getAccessToken, uuid]);

    useEffect(() => {
        void loadUploads();
    }, [loadUploads]);

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

    const sortedUploads = useMemo(() => {
        return [...uploads].sort((a, b) => {
            const aValue = a[sortKey];
            const bValue = b[sortKey];

            if (DATE_KEYS.has(sortKey)) {
                const comparison =
                    new Date(String(aValue)).getTime() -
                    new Date(String(bValue)).getTime();

                return sortDirection === "asc" ? comparison : -comparison;
            }

            if (typeof aValue === "number" && typeof bValue === "number") {
                const comparison = aValue - bValue;
                return sortDirection === "asc" ? comparison : -comparison;
            }

            const comparison = String(aValue ?? "").localeCompare(
                String(bValue ?? ""),
            );

            return sortDirection === "asc" ? comparison : -comparison;
        });
    }, [uploads, sortKey, sortDirection]);

    return (
        <section
            className="links-page"
            aria-labelledby="support-upload-heading"
        >
            <header className="links-page-header">
                <div className="links-page-heading">
                    <p className="links-page-eyebrow">
                        Uploaded files
                    </p>

                    <h1 id="support-upload-heading">
                        Upload management
                    </h1>

                    <p className="links-page-description">
                        View files uploaded for this support link.
                    </p>
                </div>

                <Link to="/support/links" className="new-link-link">
                    Back to links
                </Link>
            </header>

            {error && (
                <p className="table-message" role="alert">
                    {error}
                </p>
            )}

            {!error && sortedUploads.length === 0 && (
                <p className="table-message">
                    No uploads found for this link.
                </p>
            )}

            {sortedUploads.length > 0 && (
                <div className="links-table-wrapper">
                    <table className="links-table">
                        <thead>
                            <tr>
                                <th>
                                    <button
                                        className="table-sort-button"
                                        type="button"
                                        onClick={() => handleSort("filename")}
                                    >
                                        File {getSortIcon("filename", sortKey, sortDirection)}
                                    </button>
                                </th>

                                <th>
                                    <button
                                        className="table-sort-button"
                                        type="button"
                                        onClick={() => handleSort("size")}
                                    >
                                        Size {getSortIcon("size", sortKey, sortDirection)}
                                    </button>
                                </th>

                                <th>
                                    <button
                                        className="table-sort-button"
                                        type="button"
                                        onClick={() => handleSort("content_type")}
                                    >
                                        Type {getSortIcon("content_type", sortKey, sortDirection)}
                                    </button>
                                </th>

                                <th>
                                    <button
                                        className="table-sort-button"
                                        type="button"
                                        onClick={() => handleSort("date_uploaded")}
                                    >
                                        Uploaded {getSortIcon("date_uploaded", sortKey, sortDirection)}
                                    </button>
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {sortedUploads.map((upload) => (
                                <tr key={upload.upload_id}>
                                    <td>{upload.filename}</td>
                                    <td>{formatBytes(upload.size)}</td>
                                    <td>{upload.content_type}</td>
                                    <td>{formatDate(upload.date_uploaded)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}