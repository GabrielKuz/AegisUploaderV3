import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useApiAccessToken } from "../features/auth/useApiAccessToken";
import { ApiErrorAlert } from "./ApiErrorAlert";
import {
  getUnexpectedError,
  readApiError,
  type UserFacingError,
} from "../utils/apiErrors";
import { formatDate } from "../utils/formatters";
import {
  applySortDirection,
  getAriaSort,
  getSortIcon,
  type SortDirection,
} from "../utils/sorting";

import "./DataTable.css";

type SupportLink = {
  uuid: string;
  case_id: string;
  customer: string | null;
  status: string | null;
  itar: boolean;
  creator: string;
  timestamp: string;
  expiration_date: string;
};

type SortKey =
  | "uuid"
  | "case_id"
  | "customer"
  | "status"
  | "itar"
  | "creator"
  | "timestamp"
  | "expiration_date";

type DataTableProps = {
  createPath: string;
  title?: string;
  description?: string;
  uploadActionPathPrefix?: string;
  showItarColumn?: boolean;
};

type LinkStatusDisplay = {
  label: string;
  className: string;
};

type LinkStatusBadgeProps = {
  status: string | null;
};

type SortableHeaderProps = {
  label: string;
  column: SortKey;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
};

const DATE_KEYS = new Set<SortKey>(["timestamp", "expiration_date"]);

/**
 * Confirms that the links endpoint returned an array.
 */
function parseLinksResponse(payload: unknown): SupportLink[] {
  if (!Array.isArray(payload)) {
    throw new Error(
      "The links service returned an unexpected response format.",
    );
  }

  return payload as SupportLink[];
}

// Converts an API status into a display label and badge style.
function getLinkStatus(status: string | null | undefined): LinkStatusDisplay {
  const label = status?.trim() || "Unknown";
  const normalized = label.toLowerCase();

  switch (normalized) {
    case "completed":
    case "complete":
    case "closed":
    case "resolved":
      return {
        label,
        className: "data-table-badge data-table-badge--complete",
      };

    case "in progress":
    case "open":
    case "active":
    case "new":
      return {
        label,
        className: "data-table-badge data-table-badge--progress",
      };

    case "expired":
    case "cancelled":
    case "canceled":
    case "failed":
      return {
        label,
        className: "data-table-badge data-table-badge--danger",
      };

    default:
      return {
        label,
        className: "data-table-badge",
      };
  }
}

// Displays a link status using the appropriate badge style.
function LinkStatusBadge({ status }: LinkStatusBadgeProps) {
  const display = getLinkStatus(status);

  return <span className={display.className}>{display.label}</span>;
}

// Renders a sortable table header.
function SortableHeader({
  label,
  column,
  sortKey,
  sortDirection,
  onSort,
}: SortableHeaderProps) {
  return (
    <th scope="col" aria-sort={getAriaSort(column, sortKey, sortDirection)}>
      <button
        className="data-table-sort-button"
        type="button"
        onClick={() => onSort(column)}
      >
        {label} {getSortIcon(column, sortKey, sortDirection)}
      </button>
    </th>
  );
}

export function DataTable({
  createPath,
  title = "Created links",
  description = "Review generated upload links, customer case IDs, creators, and expiration dates.",
  uploadActionPathPrefix,
  showItarColumn = true,
}: DataTableProps) {
  const getAccessToken = useApiAccessToken();

  const [links, setLinks] = useState<SupportLink[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [error, setError] = useState<UserFacingError | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedUuid, setCopiedUuid] = useState<string | null>(null);

  // Loads all upload links available to the current user.
  const loadLinks = useCallback(async (): Promise<void> => {
    setError(null);
    setIsLoading(true);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        setLinks([]);
        setError({
          status: 401,
          title: "Sign-in required",
          message:
            "Your session could not be verified. Sign in again before viewing upload links.",
        });

        return;
      }

      const response = await fetch("/api/links/", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status === 204) {
        setLinks([]);
        return;
      }

      if (!response.ok) {
        setLinks([]);
        setError(await readApiError(response, "load the upload links"));

        return;
      }

      const payload: unknown = await response.json();
      setLinks(parseLinksResponse(payload));
    } catch (requestError) {
      setLinks([]);
      setError(getUnexpectedError(requestError, "load the upload links"));
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  // Updates selected sort column or reverses its direction.
  function handleSort(key: SortKey): void {
    if (key === sortKey) {
      setSortDirection((currentDirection) =>
        currentDirection === "asc" ? "desc" : "asc",
      );

      return;
    }

    setSortKey(key);
    setSortDirection(DATE_KEYS.has(key) ? "desc" : "asc");
  }

  // Copies customer upload URL to clipboard.
  async function copyUploadLink(uuid: string): Promise<void> {
    const uploadLink = `${window.location.origin}/uploads/${uuid}`;

    try {
      await navigator.clipboard.writeText(uploadLink);
      setCopiedUuid(uuid);

      window.setTimeout(() => {
        setCopiedUuid((currentUuid) =>
          currentUuid === uuid ? null : currentUuid,
        );
      }, 2000);
    } catch {
      window.alert("Unable to copy the upload link. Please copy it manually.");
    }
  }

  const sortedLinks = useMemo(() => {
    return [...links].sort((firstLink, secondLink) => {
      const firstValue = firstLink[sortKey];
      const secondValue = secondLink[sortKey];

      if (DATE_KEYS.has(sortKey)) {
        const firstTime = new Date(String(firstValue)).getTime();
        const secondTime = new Date(String(secondValue)).getTime();

        return applySortDirection(firstTime - secondTime, sortDirection);
      }

      if (typeof firstValue === "boolean" && typeof secondValue === "boolean") {
        return applySortDirection(
          Number(firstValue) - Number(secondValue),
          sortDirection,
        );
      }

      const comparison = String(firstValue ?? "").localeCompare(
        String(secondValue ?? ""),
      );

      return applySortDirection(comparison, sortDirection);
    });
  }, [links, sortDirection, sortKey]);

  return (
    <section className="data-page" aria-labelledby="links-page-heading">
      <header className="data-page-header">
        <div className="data-page-heading">
          <h1 id="links-page-heading">{title}</h1>
          <p className="data-page-description">{description}</p>
        </div>

        <div className="data-page-actions">
          <button
            type="button"
            className="data-page-action data-page-refresh"
            onClick={() => void loadLinks()}
            disabled={isLoading}
            aria-label={
              isLoading ? "Refreshing upload links" : "Refresh upload links"
            }
            aria-busy={isLoading}
            title={isLoading ? "Refreshing..." : "Refresh"}
          >
            <span
              className={`refresh-symbol ${isLoading ? "is-spinning" : ""}`}
              aria-hidden="true"
            >
              ⟳
            </span>
          </button>

          <Link to={createPath} className="data-page-action">
            Create Link
          </Link>
        </div>
      </header>

      {isLoading && (
        <p className="data-table-message" role="status">
          Loading upload links...
        </p>
      )}

      {!isLoading && error && (
        <ApiErrorAlert error={error} onRetry={() => void loadLinks()} />
      )}

      {!isLoading && !error && sortedLinks.length === 0 && (
        <p className="data-table-message">
          No upload links have been created yet.
        </p>
      )}

      {!isLoading && !error && sortedLinks.length > 0 && (
        <div className="data-table-wrapper">
          <table className="data-table links-table">
            <thead>
              <tr>
                <SortableHeader
                  label="Case ID"
                  column="case_id"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />

                <th scope="col">Link Actions</th>

                <SortableHeader
                  label="Customer"
                  column="customer"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />

                <SortableHeader
                  label="Status"
                  column="status"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />

                {showItarColumn && (
                  <SortableHeader
                    label="ITAR"
                    column="itar"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                )}

                <SortableHeader
                  label="Creator"
                  column="creator"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />

                <SortableHeader
                  label="Created"
                  column="timestamp"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />

                <SortableHeader
                  label="Expires"
                  column="expiration_date"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              </tr>
            </thead>

            <tbody>
              {sortedLinks.map((supportLink) => {
                const isCopied = copiedUuid === supportLink.uuid;

                return (
                  <tr key={supportLink.uuid}>
                    <td>{supportLink.case_id}</td>

                    <td>
                      <div className="data-table-link-container">
                        {uploadActionPathPrefix && (
                          <Link
                            className="data-table-action-link"
                            to={`${uploadActionPathPrefix}/${supportLink.uuid}`}
                            state={{
                              caseId: supportLink.case_id,
                            }}
                          >
                            View Uploads
                          </Link>
                        )}

                        <Link
                          className="data-table-action-link data-table-icon-action"
                          to={`/uploads/${supportLink.uuid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Open upload page for ${supportLink.case_id}`}
                          aria-label={`Open upload page for ${supportLink.case_id} in a new tab`}
                        >
                          <span aria-hidden="true">↗</span>
                        </Link>

                        <button
                          type="button"
                          className="copy-link-button data-table-icon-action"
                          onClick={() => void copyUploadLink(supportLink.uuid)}
                          title={
                            isCopied ? "Upload link copied" : "Copy upload link"
                          }
                          aria-label={
                            isCopied
                              ? `Upload link copied for ${supportLink.case_id}`
                              : `Copy upload link for ${supportLink.case_id}`
                          }
                        >
                          <span aria-hidden="true">{isCopied ? "✓" : "❐"}</span>
                        </button>
                      </div>
                    </td>

                    <td>{supportLink.customer ?? "Unknown"}</td>

                    <td>
                      <LinkStatusBadge status={supportLink.status} />
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

                    <td>{supportLink.creator}</td>
                    <td>{formatDate(supportLink.timestamp)}</td>
                    <td>{formatDate(supportLink.expiration_date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
