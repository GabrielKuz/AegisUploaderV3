import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useApiAccessToken } from "../features/auth/useApiAccessToken";
import { ApiErrorAlert } from "./ApiErrorAlert";
import { formatDate } from "../utils/formatters";
import {
  getUnexpectedError,
  readApiError,
  type UserFacingError,
} from "../utils/apiErrors";
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
  itar: boolean;
  creator: string;
  timestamp: string;
  expiration_date: string;
  customer: string | null;
  status: string | null;
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

type LinkStatusDisplay = {
  label: string;
  className: string;
};

function getLinkStatus(status: string | null | undefined): LinkStatusDisplay {
  const normalized =
    typeof status === "string" ? status.trim().toLowerCase() : "";

  switch (normalized) {
    case "completed":
    case "complete":
    case "closed":
    case "resolved":
      return {
        label: status ?? "Completed",
        className: "data-table-badge data-table-badge--complete",
      };

    case "in progress":
    case "open":
    case "active":
    case "new":
      return {
        label: status ?? "In progress",
        className: "data-table-badge data-table-badge--progress",
      };

    case "expired":
    case "cancelled":
    case "canceled":
    case "failed":
      return {
        label: status ?? "Expired",
        className: "data-table-badge data-table-badge--danger",
      };

    default:
      return {
        label: typeof status === "string" && status.trim() ? status : "Unknown",
        className: "data-table-badge",
      };
  }
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

      /*
       * Defensively handle an empty response, even though
       * the links endpoint should normally return an array.
       */
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

      const data = parseLinksResponse(payload);

      setLinks(data);
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

  const showActions = Boolean(uploadActionPathPrefix);

  async function copyUploadLink(uuid: string): Promise<void> {
    const uploadLink = `${window.location.origin}/uploads/${uuid}`;

    try {
      await navigator.clipboard.writeText(uploadLink);

      setCopiedUuid(uuid);

      window.setTimeout(() => {
        setCopiedUuid((current) => (current === uuid ? null : current));
      }, 2000);
    } catch {
      window.alert("Unable to copy the upload link. Please copy it manually.");
    }
  }

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
            className="data-page-action"
            onClick={() => void loadLinks()}
            disabled={isLoading}
          >
            {isLoading ? "Refreshing..." : "Refresh"}
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
          <table className="data-table">
            <thead>
              <tr>
                <th
                  scope="col"
                  aria-sort={getAriaSort("uuid", sortKey, sortDirection)}
                >
                  <button
                    className="data-table-sort-button"
                    type="button"
                    onClick={() => handleSort("uuid")}
                  >
                    Upload link {getSortIcon("uuid", sortKey, sortDirection)}
                  </button>
                </th>

                <th
                  scope="col"
                  aria-sort={getAriaSort("case_id", sortKey, sortDirection)}
                >
                  <button
                    className="data-table-sort-button"
                    type="button"
                    onClick={() => handleSort("case_id")}
                  >
                    Case ID {getSortIcon("case_id", sortKey, sortDirection)}
                  </button>
                </th>
                <th
                  scope="col"
                  aria-sort={getAriaSort("customer", sortKey, sortDirection)}
                >
                  <button
                    className="data-table-sort-button"
                    type="button"
                    onClick={() => handleSort("customer")}
                  >
                    Customer {getSortIcon("customer", sortKey, sortDirection)}
                  </button>
                </th>
                <th
                  scope="col"
                  aria-sort={getAriaSort("status", sortKey, sortDirection)}
                >
                  <button
                    className="data-table-sort-button"
                    type="button"
                    onClick={() => handleSort("status")}
                  >
                    Status {getSortIcon("status", sortKey, sortDirection)}
                  </button>
                </th>
                {showItarColumn && (
                  <th
                    scope="col"
                    aria-sort={getAriaSort("itar", sortKey, sortDirection)}
                  >
                    <button
                      className="data-table-sort-button"
                      type="button"
                      onClick={() => handleSort("itar")}
                    >
                      ITAR {getSortIcon("itar", sortKey, sortDirection)}
                    </button>
                  </th>
                )}

                <th
                  scope="col"
                  aria-sort={getAriaSort("creator", sortKey, sortDirection)}
                >
                  <button
                    className="data-table-sort-button"
                    type="button"
                    onClick={() => handleSort("creator")}
                  >
                    Creator {getSortIcon("creator", sortKey, sortDirection)}
                  </button>
                </th>

                <th
                  scope="col"
                  aria-sort={getAriaSort("timestamp", sortKey, sortDirection)}
                >
                  <button
                    className="data-table-sort-button"
                    type="button"
                    onClick={() => handleSort("timestamp")}
                  >
                    Created {getSortIcon("timestamp", sortKey, sortDirection)}
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
                    onClick={() => handleSort("expiration_date")}
                  >
                    Expires{" "}
                    {getSortIcon("expiration_date", sortKey, sortDirection)}
                  </button>
                </th>

                {showActions && <th scope="col">Actions</th>}
              </tr>
            </thead>

            <tbody>
              {sortedLinks.map((supportLink) => (
                <tr key={supportLink.uuid}>
                  <td>
                    <div className="data-table-link-container">
                      <Link
                        className="data-table-primary-link"
                        to={`/uploads/${supportLink.uuid}`}
                      >
                        /uploads/{supportLink.uuid}
                      </Link>

                      <button
                        type="button"
                        className="copy-link-button"
                        onClick={() => void copyUploadLink(supportLink.uuid)}
                        title="Copy upload link"
                        aria-label={`Copy upload link for ${supportLink.case_id}`}
                      >
                        {copiedUuid === supportLink.uuid ? "✓" : "❐"}
                      </button>
                    </div>
                  </td>
                  <td>{supportLink.case_id}</td>
                  <td>{supportLink.customer ?? "Unknown"}</td>
                  <td>
                    {(() => {
                      const status = getLinkStatus(supportLink.status);

                      return (
                        <span className={status.className}>{status.label}</span>
                      );
                    })()}
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

                  {uploadActionPathPrefix && (
                    <td>
                      <Link
                        className="data-table-action-link"
                        to={`${uploadActionPathPrefix}/${supportLink.uuid}`}
                        state={{ caseId: supportLink.case_id }}
                      >
                        View Uploads
                      </Link>
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
