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
  filename: string;
  blob_name: string;
  size: number;
  expiration_date?: string | null;
  date_uploaded: string;
  upload_complete: boolean;
  status?: string | null;
  marked_for_deletion?: boolean;
};

type CaseLink = {
  uuid: string;
  case_id: string;
};

type UploadListResponse =
  | Upload[]
  | {
      files?: Upload[];
      uploads?: Upload[];
    };

type SortKey =
  | "blob_name"
  | "size"
  | "status"
  | "expiration_date"
  | "date_uploaded";

type SortValue = string | number | null | undefined;

type UploadRequestEntry = {
  createdAt: number;
  promise: Promise<Upload[]>;
};

type UploadStatusDisplay = {
  label: string;
  className: string;
};

type SortableHeaderProps = {
  label: string;
  column: SortKey;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
};

type UploadStatusBadgeProps = {
  upload: Upload;
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

// Confirms files endpoint returned a supported response
function parseUploadResponse(payload: UploadListResponse): Upload[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.files)) {
    return payload.files;
  }

  if (Array.isArray(payload.uploads)) {
    return payload.uploads;
  }

  throw new Error("The files endpoint returned an unexpected response format.");
}

// Builds endpoint used to extend one upload's retention.
function getExtendEndpoint(uploadId: string, additionalDays: number): string {
  const encodedUploadId = encodeURIComponent(uploadId);
  const encodedDays = encodeURIComponent(String(additionalDays));

  return (
    `/api/uploads/${encodedUploadId}/extend_expiration` +
    `?additional_days=${encodedDays}`
  );
}

// Builds endpoint used to mark one upload for deletion.
function getDeleteEndpoint(uploadId: string): string {
  return `/api/uploads/${encodeURIComponent(uploadId)}/mark_for_deletion`;
}

// Builds endpoint used to mark all link uploads for deletion.
function getDeleteAllEndpoint(uuid: string): string {
  return `/api/links/${encodeURIComponent(uuid)}/mark_all_for_deletion`;
}

// Formats optional API date.
function formatOptionalDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "—" : formatDate(value);
}

/**
 * Requests files associated with upload link.
 * The short-lived cache prevents React Strict Mode from issuing duplicate requests during development.
 */
function requestUploads(
  uuid: string,
  accessToken: string,
  forceRefresh = false,
): Promise<Upload[]> {
  const requestKey = `admin-uploads-${uuid}`;
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
    const payload = (await response.json()) as UploadListResponse;

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

// Finds case ID associated with upload-link UUID
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

// Converts backend upload states into consistent table labels.
function getUploadStatus(upload: Upload): UploadStatusDisplay {
  const normalizedStatus = upload.status
    ?.trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");

  if (
    upload.marked_for_deletion ||
    normalizedStatus === "pending deletion" ||
    normalizedStatus === "marked for deletion"
  ) {
    return {
      label: "Pending deletion",
      className: "data-table-badge data-table-badge--danger",
    };
  }

  switch (normalizedStatus) {
    case "complete":
    case "completed":
    case "uploaded":
      return {
        label: "Complete",
        className: "data-table-badge data-table-badge--complete",
      };

    case "in progress":
    case "uploading":
    case "pending":
    case "processing":
      return {
        label: "In progress",
        className: "data-table-badge data-table-badge--progress",
      };

    case "failed":
    case "error":
      return {
        label: "Failed",
        className: "data-table-badge data-table-badge--danger",
      };

    case "expired":
      return {
        label: "Expired",
        className: "data-table-badge data-table-badge--danger",
      };

    case "deleted":
      return {
        label: "Deleted",
        className: "data-table-badge data-table-badge--danger",
      };

    default:
      return upload.upload_complete
        ? {
            label: "Complete",
            className: "data-table-badge data-table-badge--complete",
          }
        : {
            label: "In progress",
            className: "data-table-badge data-table-badge--progress",
          };
  }
}

// Returns value used to sort upload
function getSortValue(upload: Upload, key: SortKey): SortValue {
  if (key === "status") {
    return getUploadStatus(upload).label;
  }
  return upload[key];
}

// Displays upload's normalized status
function UploadStatusBadge({ upload }: UploadStatusBadgeProps) {
  const status = getUploadStatus(upload);
  return <span className={status.className}>{status.label}</span>;
}

// Renders sortable table column heading
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

export function AdminUpload() {
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
  const [extendingUploadId, setExtendingUploadId] = useState<string | null>(
    null,
  );
  const [deletingUploadId, setDeletingUploadId] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const uploadLink = uuid ? `${window.location.origin}/uploads/${uuid}` : "";

  // Loads selected link and its uploaded files
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

  // Updates selected sort column or reverses its direction
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
      const firstValue = getSortValue(firstUpload, sortKey);
      const secondValue = getSortValue(secondUpload, sortKey);

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

      const comparison = String(firstValue ?? "").localeCompare(
        String(secondValue ?? ""),
      );

      return applySortDirection(comparison, sortDirection);
    });
  }, [uploads, sortDirection, sortKey]);

  // Extends one upload's retention period
  async function extendUpload(uploadId: string): Promise<void> {
    const input = window.prompt("Extend retention by how many days?");

    if (input === null) {
      return;
    }

    const days = Number(input.trim());

    if (!Number.isInteger(days) || days <= 0) {
      setActionMessage(null);
      setActionError({
        title: "Invalid extension period",
        message: "Enter a positive whole number of days, such as 7 or 30.",
      });

      return;
    }

    setActionError(null);
    setActionMessage(null);
    setExtendingUploadId(uploadId);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        setActionError({
          status: 401,
          title: "Sign-in required",
          message:
            "Your session could not be verified. Sign in again before extending the file retention period.",
        });

        return;
      }

      const response = await fetch(getExtendEndpoint(uploadId, days), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        setActionError(
          await readApiError(response, "extend the file retention period"),
        );

        return;
      }

      setActionMessage(
        `Retention was extended by ${days} ${days === 1 ? "day" : "days"}.`,
      );

      await loadUploads(true);
    } catch (requestError) {
      setActionError(
        getUnexpectedError(requestError, "extend the file retention period"),
      );
    } finally {
      setExtendingUploadId(null);
    }
  }

  // Marks one upload for deletion
  async function deleteUpload(upload: Upload): Promise<void> {
    const confirmed = window.confirm(
      `Mark "${upload.blob_name}" for deletion?`,
    );

    if (!confirmed) {
      return;
    }

    setActionError(null);
    setActionMessage(null);
    setDeletingUploadId(upload.upload_id);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        setActionError({
          status: 401,
          title: "Sign-in required",
          message:
            "Your session could not be verified. Sign in again before marking this file for deletion.",
        });

        return;
      }

      const response = await fetch(getDeleteEndpoint(upload.upload_id), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        setActionError(
          await readApiError(response, "mark the file for deletion"),
        );

        return;
      }

      setActionMessage(`"${upload.blob_name}" was marked for deletion.`);

      await loadUploads(true);
    } catch (requestError) {
      setActionError(
        getUnexpectedError(requestError, "mark the file for deletion"),
      );
    } finally {
      setDeletingUploadId(null);
    }
  }

  // Marks every upload on this link for deletion
  async function deleteAllUploads(): Promise<void> {
    if (!uuid) {
      return;
    }

    const confirmed = window.confirm(
      "Mark ALL uploads on this link for deletion?",
    );

    if (!confirmed) {
      return;
    }

    setActionError(null);
    setActionMessage(null);
    setIsDeletingAll(true);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        setActionError({
          status: 401,
          title: "Sign-in required",
          message:
            "Your session could not be verified. Sign in again before marking all uploads for deletion.",
        });

        return;
      }

      const response = await fetch(getDeleteAllEndpoint(uuid), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        setActionError(
          await readApiError(response, "mark all uploads for deletion"),
        );

        return;
      }

      setActionMessage("All uploads on this link were marked for deletion.");

      await loadUploads(true);
    } catch (requestError) {
      setActionError(
        getUnexpectedError(requestError, "mark all uploads for deletion"),
      );
    } finally {
      setIsDeletingAll(false);
    }
  }

  // Copies customer-facing upload link
  async function copyUploadLink(): Promise<void> {
    if (!uploadLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(uploadLink);

      setLinkCopied(true);
      setActionError(null);
      setActionMessage("Upload link copied to clipboard.");

      window.setTimeout(() => {
        setLinkCopied(false);
      }, ACTION_MESSAGE_DURATION_MS);
    } catch {
      setActionError({
        title: "Unable to copy link",
        message:
          "Your browser prevented the upload link from being copied. Please copy it manually.",
      });
    }
  }

  return (
    <section className="data-page" aria-labelledby="upload-management-heading">
      <header className="data-page-header">
        <div className="data-page-heading">
          <h1 id="upload-management-heading">Upload management</h1>

          <p className="data-page-description">
            View files received through this customer upload link, extend
            retention, or mark files for deletion.
          </p>
        </div>

        <div className="data-page-actions">
          <Link
            to="/admin/links"
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
            disabled={isDeletingAll || isLoading || uploads.length === 0}
            onClick={() => void deleteAllUploads()}
          >
            {isDeletingAll ? "Marking..." : "Mark All for Deletion"}
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
                  column="status"
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

                <th scope="col">Actions</th>
              </tr>
            </thead>

            <tbody>
              {sortedUploads.map((upload) => {
                const status = getUploadStatus(upload);
                const isExtending = extendingUploadId === upload.upload_id;
                const isDeleting = deletingUploadId === upload.upload_id;
                const isRowBusy = isDeletingAll || isExtending || isDeleting;
                const deletionRequested = status.label === "Pending deletion";

                return (
                  <tr key={upload.upload_id}>
                    <td>{upload.blob_name}</td>
                    <td>{formatBytes(upload.size)}</td>

                    <td>
                      <UploadStatusBadge upload={upload} />
                    </td>

                    <td>{formatDate(upload.date_uploaded)}</td>

                    <td>{formatOptionalDate(upload.expiration_date)}</td>

                    <td>
                      <div className="data-table-actions">
                        <button
                          type="button"
                          className="data-table-action-button"
                          disabled={isRowBusy || deletionRequested}
                          onClick={() => void extendUpload(upload.upload_id)}
                        >
                          {isExtending ? "Extending..." : "Extend"}
                        </button>

                        <button
                          type="button"
                          className="data-table-action-button data-table-action-button--danger"
                          disabled={isRowBusy || deletionRequested}
                          onClick={() => void deleteUpload(upload)}
                        >
                          {isDeleting
                            ? "Marking..."
                            : deletionRequested
                              ? "Deletion requested"
                              : "Mark for Deletion"}
                        </button>
                      </div>
                    </td>
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
