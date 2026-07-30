import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ApiErrorAlert } from "../../components/ApiErrorAlert";
import "../../components/DataTable.css";
import {
  getUnexpectedError,
  readApiError,
  type UserFacingError,
} from "../../utils/apiErrors";
import { formatBytes, formatDate } from "../../utils/formatters";
import {
  applySortDirection,
  getAriaSort,
  getSortIcon,
  type SortDirection,
} from "../../utils/sorting";
import { useApiAccessToken } from "../auth/useApiAccessToken";

const REQUEST_DEDUPE_WINDOW_MS = 1_000;
const ACTION_MESSAGE_DURATION_MS = 3_000;

type Upload = {
  upload_id: string;
  blob_name: string;
  size: number;
  expiration_date?: string | null;
  upload_complete: boolean;
  date_uploaded: string;
};

type CaseLink = {
  uuid: string;
  case_id: string;
};

type SortKey =
  | "blob_name"
  | "size"
  | "upload_complete"
  | "expiration_date"
  | "date_uploaded";

type UploadRequestEntry = {
  createdAt: number;
  promise: Promise<Upload[]>;
};

type SortableHeaderProps = {
  label: string;
  column: SortKey;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
};

type UploadStatusBadgeProps = {
  isComplete: boolean;
};

const DATE_KEYS = new Set<SortKey>(["date_uploaded", "expiration_date"]);

const uploadRequestCache = new Map<string, UploadRequestEntry>();

// Carries a structured API error through a rejected request.
class ApiRequestError extends Error {
  readonly userFacingError: UserFacingError;

  constructor(userFacingError: UserFacingError) {
    super(userFacingError.message);

    this.name = "ApiRequestError";
    this.userFacingError = userFacingError;
  }
}

// Confirms the files endpoint returned an array.
function parseUploadResponse(payload: unknown): Upload[] {
  if (!Array.isArray(payload)) {
    throw new Error(
      "The files service returned an unexpected response format.",
    );
  }

  return payload as Upload[];
}

// Formats an optional API date.
function formatOptionalDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "—" : formatDate(value);
}

/**
 * Requests files associated with an upload link.
 * The short-lived cache prevents React Strict Mode from issuing
 * duplicate requests during development.
 */
function requestUploads(
  uuid: string,
  accessToken: string,
  forceRefresh = false,
): Promise<Upload[]> {
  const requestKey = `support-uploads-${uuid}`;
  const existingRequest = uploadRequestCache.get(requestKey);

  const existingRequestIsCurrent =
    existingRequest !== undefined &&
    Date.now() - existingRequest.createdAt < REQUEST_DEDUPE_WINDOW_MS;

  if (!forceRefresh && existingRequestIsCurrent) {
    return existingRequest.promise;
  }

  if (forceRefresh) {
    uploadRequestCache.delete(requestKey);
  }

  const endpoint = `/api/links/${encodeURIComponent(uuid)}/files`;

  const request = fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }).then(async (response) => {
    if (response.status === 204) {
      return [];
    }

    if (!response.ok) {
      throw new ApiRequestError(
        await readApiError(response, "load the uploaded files"),
      );
    }

    const payload: unknown = await response.json();

    return parseUploadResponse(payload);
  });

  const entry: UploadRequestEntry = {
    createdAt: Date.now(),
    promise: request,
  };

  uploadRequestCache.set(requestKey, entry);

  const removeCachedRequest = (): void => {
    window.setTimeout(() => {
      if (uploadRequestCache.get(requestKey) === entry) {
        uploadRequestCache.delete(requestKey);
      }
    }, REQUEST_DEDUPE_WINDOW_MS);
  };

  request.then(removeCachedRequest, removeCachedRequest);

  return request;
}

// Finds the case ID associated with an upload-link UUID.
async function requestCaseId(
  uuid: string,
  accessToken: string,
): Promise<string> {
  const response = await fetch("/api/links/", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new ApiRequestError(
      await readApiError(response, "load the upload link"),
    );
  }

  const links = (await response.json()) as CaseLink[];
  const matchingLink = links.find((link) => link.uuid === uuid);

  if (!matchingLink) {
    throw new Error("Upload link not found.");
  }

  return matchingLink.case_id;
}

// Displays an upload's completion status.
function UploadStatusBadge({ isComplete }: UploadStatusBadgeProps) {
  const label = isComplete ? "Complete" : "In progress";

  const className = isComplete
    ? "data-table-badge data-table-badge--complete"
    : "data-table-badge data-table-badge--progress";

  return <span className={className}>{label}</span>;
}

// Renders a sortable table column heading.
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

export function SupportUpload() {
  const { uuid } = useParams<{ uuid: string }>();
  const getAccessToken = useApiAccessToken();

  const [uploads, setUploads] = useState<Upload[]>([]);
  const [caseId, setCaseId] = useState("Loading...");
  const [sortKey, setSortKey] = useState<SortKey>("date_uploaded");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [error, setError] = useState<UserFacingError | null>(null);
  const [actionError, setActionError] = useState<UserFacingError | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isRequestingDeletion, setIsRequestingDeletion] = useState(false);

  const uploadLink = uuid ? `${window.location.origin}/uploads/${uuid}` : "";

  // Loads the selected link and its uploaded files.
  const loadUploads = useCallback(
    async (forceRefresh = false): Promise<void> => {
      setError(null);
      setIsLoading(true);

      if (!uuid) {
        setUploads([]);
        setCaseId("Unknown");
        setError({
          title: "Upload link not selected",
          message:
            "The page URL does not contain an upload-link ID. Return to the links table and select View uploads again.",
        });
        setIsLoading(false);

        return;
      }

      try {
        const accessToken = await getAccessToken();

        if (!accessToken) {
          setUploads([]);
          setCaseId("Unknown");
          setError({
            status: 401,
            title: "Sign-in required",
            message:
              "Your session could not be verified. Sign in again before viewing uploaded files.",
          });

          return;
        }

        const [uploadData, currentCaseId] = await Promise.all([
          requestUploads(uuid, accessToken, forceRefresh),
          requestCaseId(uuid, accessToken),
        ]);

        setUploads(uploadData);
        setCaseId(currentCaseId);
      } catch (requestError) {
        setUploads([]);
        setCaseId("Unknown");

        if (requestError instanceof ApiRequestError) {
          setError(requestError.userFacingError);
          return;
        }

        setError(getUnexpectedError(requestError, "load the uploaded files"));
      } finally {
        setIsLoading(false);
      }
    },
    [getAccessToken, uuid],
  );

  useEffect(() => {
    void loadUploads();
  }, [loadUploads]);

  useEffect(() => {
    if (!actionMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setActionMessage(null);
    }, ACTION_MESSAGE_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [actionMessage]);

  useEffect(() => {
    if (!linkCopied) {
      return;
    }

    const timer = window.setTimeout(() => {
      setLinkCopied(false);
    }, ACTION_MESSAGE_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [linkCopied]);

  // Updates the selected sort column or reverses its direction.
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

  const sortedUploads = useMemo(() => {
    return [...uploads].sort((firstUpload, secondUpload) => {
      const firstValue = firstUpload[sortKey];
      const secondValue = secondUpload[sortKey];

      if (DATE_KEYS.has(sortKey)) {
        const firstTime = firstValue
          ? new Date(String(firstValue)).getTime()
          : 0;

        const secondTime = secondValue
          ? new Date(String(secondValue)).getTime()
          : 0;

        return applySortDirection(firstTime - secondTime, sortDirection);
      }

      if (typeof firstValue === "number" && typeof secondValue === "number") {
        return applySortDirection(firstValue - secondValue, sortDirection);
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
  }, [uploads, sortDirection, sortKey]);

  // Copies the customer-facing upload link.
  async function copyUploadLink(): Promise<void> {
    if (!uploadLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(uploadLink);

      setLinkCopied(true);
      setActionError(null);
      setActionMessage("Upload link copied to clipboard.");
    } catch {
      setActionError({
        title: "Unable to copy link",
        message:
          "Your browser prevented the upload link from being copied. Please copy it manually.",
      });
    }
  }

  // Sends a deletion-request email for this upload link.
  async function requestDeletion(): Promise<void> {
    if (!uuid) {
      return;
    }

    const confirmed = window.confirm(
      "Send a deletion request email for this upload link?",
    );

    if (!confirmed) {
      return;
    }

    setActionError(null);
    setActionMessage(null);
    setIsRequestingDeletion(true);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        setActionError({
          status: 401,
          title: "Sign-in required",
          message:
            "Your session could not be verified. Sign in again before requesting deletion.",
        });

        return;
      }

      const response = await fetch(
        `/api/requestfordeletion/${encodeURIComponent(uuid)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) {
        setActionError(
          await readApiError(response, "send the deletion request"),
        );

        return;
      }

      setActionMessage("A deletion request email has been sent successfully.");
    } catch (requestError) {
      setActionError(
        getUnexpectedError(requestError, "send the deletion request"),
      );
    } finally {
      setIsRequestingDeletion(false);
    }
  }

  return (
    <section className="data-page" aria-labelledby="support-upload-heading">
      <header className="data-page-header">
        <div className="data-page-heading">
          <h1 id="support-upload-heading">Uploaded files</h1>

          <p className="data-page-description">
            View files received through this customer upload link.
          </p>
        </div>

        <div className="data-page-actions">
          <Link
            to="/support/links"
            className="data-page-action data-page-icon-action data-page-back"
            aria-label="Back to links"
            title="Back to links"
          >
            <span className="back-symbol" aria-hidden="true">
              ←
            </span>
          </Link>

          <button
            type="button"
            className="data-page-action data-page-icon-action data-page-refresh"
            onClick={() => void loadUploads(true)}
            disabled={isLoading}
            aria-label={
              isLoading ? "Refreshing uploaded files" : "Refresh uploaded files"
            }
            aria-busy={isLoading}
            title={isLoading ? "Refreshing..." : "Refresh"}
          >
            <span
              className={`refresh-symbol ${isLoading ? "is-loading" : ""}`}
              aria-hidden="true"
            >
              ↻
            </span>
          </button>

          <button
            type="button"
            className="data-page-action data-table-action-button--danger"
            disabled={isRequestingDeletion || isLoading}
            onClick={() => void requestDeletion()}
          >
            {isRequestingDeletion ? "Sending..." : "Request Deletion"}
          </button>
        </div>
      </header>

      <div className="upload-link-summary">
        <div className="upload-link-summary-row">
          <strong>Upload Link</strong>

          <div className="upload-link-value">
            {uploadLink ? (
              <a
                href={uploadLink}
                target="_blank"
                rel="noopener noreferrer"
                className="upload-link"
              >
                <code>{uploadLink}</code>
              </a>
            ) : (
              <code>Unavailable</code>
            )}

            <button
              type="button"
              className="copy-link-button data-table-icon-action"
              onClick={() => void copyUploadLink()}
              disabled={!uploadLink}
              title={linkCopied ? "Upload link copied" : "Copy upload link"}
              aria-label={
                linkCopied ? "Upload link copied" : "Copy upload link"
              }
            >
              <span aria-hidden="true">{linkCopied ? "✓" : "❐"}</span>
            </button>
          </div>
        </div>

        <div className="upload-link-summary-row">
          <strong>Case ID</strong>
          <span>{caseId}</span>
        </div>
      </div>

      {actionMessage && (
        <p className="data-table-message" role="status">
          {actionMessage}
        </p>
      )}

      {actionError && <ApiErrorAlert error={actionError} />}

      {isLoading && (
        <p className="data-table-message" role="status">
          Loading uploaded files...
        </p>
      )}

      {!isLoading && error && (
        <ApiErrorAlert error={error} onRetry={() => void loadUploads(true)} />
      )}

      {!isLoading && !error && sortedUploads.length === 0 && (
        <p className="data-table-message">
          No uploaded file records were found for this link.
        </p>
      )}

      {!isLoading && !error && sortedUploads.length > 0 && (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <SortableHeader
                  label="File"
                  column="blob_name"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />

                <SortableHeader
                  label="Size"
                  column="size"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />

                <SortableHeader
                  label="Status"
                  column="upload_complete"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />

                <SortableHeader
                  label="Uploaded"
                  column="date_uploaded"
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
              {sortedUploads.map((upload) => (
                <tr key={upload.upload_id}>
                  <td>{upload.blob_name}</td>

                  <td>{formatBytes(upload.size)}</td>

                  <td>
                    <UploadStatusBadge isComplete={upload.upload_complete} />
                  </td>

                  <td>{formatDate(upload.date_uploaded)}</td>

                  <td>{formatOptionalDate(upload.expiration_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
