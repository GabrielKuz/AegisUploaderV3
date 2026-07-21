import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";

import "../../components/DataTablePage.css";
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

const FILES_ENDPOINT = "/api/files/";
const REQUEST_DEDUPE_WINDOW_MS = 1_000;

type Upload = {
  upload_id: string;
  filename: string;
  blob_name: string;
  size: number;
  expiration_date: string;
  date_uploaded: string;
  upload_complete?: boolean;
  status?: string | null;
  marked_for_deletion?: boolean;
};

type SortKey =
  | "blob_name"
  | "size"
  | "status"
  | "expiration_date"
  | "date_uploaded";

type UploadRequestEntry = {
  createdAt: number;
  promise: Promise<Upload[]>;
};

type UploadListResponse =
  | Upload[]
  | {
    files?: Upload[];
    uploads?: Upload[];
  };

function parseUploadResponse(
  payload: UploadListResponse,
): Upload[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.files)) {
    return payload.files;
  }

  if (Array.isArray(payload.uploads)) {
    return payload.uploads;
  }

  throw new Error(
    "The files endpoint returned an unexpected response.",
  );
}

type UploadStatusDisplay = {
  label: string;
  className: string;
};

const DATE_KEYS = new Set<SortKey>([
  "date_uploaded",
  "expiration_date",
]);

const ADMIN_UPLOADS_CACHE_KEY =
  "admin-uploads";

const uploadRequestCache =
  new Map<string, UploadRequestEntry>();

// Returns the endpoint used to extend one upload's retention.
function getExtendEndpoint(
  uploadId: string,
): string {
  return `/api/upload/extend/${encodeURIComponent(uploadId)}`;
}
/**
 * Returns endpoint to mark upload for deletion.
 * This implementation assumes DELETE /api/uploads/{upload_id}
 * performs the backend's soft-delete or deletion-marking action.
 */
function getDeleteEndpoint(
  uploadId: string,
): string {
  return `/api/uploads/${encodeURIComponent(uploadId)}/mark_for_deletion`;
}

/**
 * Extracts a readable API error without displaying an entire
 * JSON object to the user.
*/
async function getResponseMessage(
  response: Response,
  fallbackMessage: string,
): Promise<string> {
  try {
    const contentType =
      response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = (await response.json()) as {
        detail?: unknown;
        message?: unknown;
      };

      if (typeof body.detail === "string" && body.detail.trim()) {
        return body.detail.trim();
      }

      if (typeof body.message === "string" && body.message.trim()) {
        return body.message.trim();
      }

      return fallbackMessage;
    }

    const text = await response.text();

    return (text.trim() || fallbackMessage);
  } catch {
    return fallbackMessage;
  }
}

/**
 * Requests uploaded files visible to administrator.
 * Short-lived cache prevents React Strict Mode's development effect cycle from issuing same request twice.
*/
function requestUploads(accessToken: string, forceRefresh = false): Promise<Upload[]> {
  const existingRequest = uploadRequestCache.get(ADMIN_UPLOADS_CACHE_KEY);

  const existingRequestIsCurrent = existingRequest !== undefined && Date.now() - existingRequest.createdAt < REQUEST_DEDUPE_WINDOW_MS;

  if (!forceRefresh && existingRequestIsCurrent) {
    return existingRequest.promise;
  }

  if (forceRefresh) {
    uploadRequestCache.delete(ADMIN_UPLOADS_CACHE_KEY);
  }

  const request = fetch(FILES_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
  },
  ).then(async (response) => {
    if (!response.ok) {
      const message = await getResponseMessage(response, `Failed to load uploaded files. Status: ${response.status}`);
      throw new Error(message);
    }

    const payload = (await response.json()) as UploadListResponse;
    return parseUploadResponse(payload);
  });

  const entry: UploadRequestEntry = {
    createdAt: Date.now(),
    promise: request,
  };

  uploadRequestCache.set(ADMIN_UPLOADS_CACHE_KEY, entry);

  const removeRequest = (): void => {
    window.setTimeout(() => {
      if (uploadRequestCache.get(ADMIN_UPLOADS_CACHE_KEY) === entry) {
        uploadRequestCache.delete(ADMIN_UPLOADS_CACHE_KEY);
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
 * Converts backend status values into consistent table labels.
 *
 * The status field is preferred when present. upload_complete
 * remains supported for compatibility with the current API.
 */
function getUploadStatus(
  upload: Upload,
): UploadStatusDisplay {
  const rawStatus = upload.status?.trim().toLowerCase().replace(/[_-]+/g, " ");

  if (upload.marked_for_deletion || rawStatus === "pending deletion" || rawStatus === "marked for deletion") {
    return {
      label: "Pending deletion",
      className: "data-table-badge data-table-badge--danger",
    };
  }

  switch (rawStatus) {
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
      if (upload.upload_complete === true) {
        return {
          label: "Complete",
          className: "data-table-badge data-table-badge--complete",
        };
      }

      if (upload.upload_complete === false) {
        return {
          label: "In progress",
          className: "data-table-badge data-table-badge--progress",
        };
      }

      return {
        label: "Unknown",
        className: "data-table-badge",
      };
  }
}

//Returns value used to sort one upload by selected column.
function getSortValue(upload: Upload, key: SortKey): string | number {
  if (key === "status") {
    return getUploadStatus(upload).label;
  }
  return upload[key];
}

export function AdminUploadPage() {
  const getAccessToken = useApiAccessToken();

  const [uploads, setUploads] = useState<Upload[]>([]);

  const [sortKey, setSortKey] = useState<SortKey>("date_uploaded");

  const [sortDirection, setSortDirection,] = useState<SortDirection>("desc");

  const [error, setError] = useState<string | null>(null);

  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [extendingUploadId, setExtendingUploadId] = useState<string | null>(null);

  const [deletingUploadId, setDeletingUploadId] = useState<string | null>(null);

  const loadUploads = useCallback(async (forceRefresh = false): Promise<void> => {
    setError(null);
    setIsLoading(true);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        setUploads([]);
        setError("Please sign in before viewing uploaded files.");
        return;
      }

      const data = await requestUploads(accessToken, forceRefresh);
      setUploads(data);
    } catch (requestError) {
      setUploads([]);
      setError(requestError instanceof Error ? requestError.message : "Something went wrong while loading uploaded files.");
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

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
    return [...uploads].sort((firstUpload, secondUpload) => {
      const firstValue = getSortValue(firstUpload, sortKey);
      const secondValue = getSortValue(secondUpload, sortKey);

      if (DATE_KEYS.has(sortKey)) {
        const comparison = new Date(String(firstValue)).getTime() - new Date(String(secondValue)).getTime();

        return applySortDirection(comparison, sortDirection);
      }

      if (typeof firstValue === "number" && typeof secondValue === "number") {
        return applySortDirection(firstValue - secondValue, sortDirection);
      }

      const comparison = String(firstValue ?? "").localeCompare(String(secondValue ?? ""));

      return applySortDirection(comparison, sortDirection);
    });
  }, [uploads, sortDirection, sortKey]);

  async function extendUpload(uploadId: string): Promise<void> {
    const input = window.prompt("Extend retention by how many days?");

    if (input === null) {
      return;
    }

    const days = Number(input.trim());

    if (!Number.isInteger(days) || days <= 0) {
      window.alert("Please enter a positive whole number.");
      return;
    }

    setActionMessage(null);
    setExtendingUploadId(uploadId);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        throw new Error("Please sign in before extending upload retention.");
      }

      const response = await fetch(getExtendEndpoint(uploadId), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uuid: uploadId, days }),
      });

      if (!response.ok) {
        throw new Error(await getResponseMessage(response, `Failed to extend upload retention. Status: ${response.status}`));
      }

      setActionMessage(`Retention was extended by ${days} ${days === 1 ? "day" : "days"}.`);
      await loadUploads(true);

    } catch (requestError) {
      window.alert(requestError instanceof Error ? requestError.message : "Something went wrong while extending upload retention.");
    } finally {
      setExtendingUploadId(null);
    }
  }

  async function deleteUpload(upload: Upload): Promise<void> {
    const confirmed = window.confirm(`Mark "${upload.blob_name}" for deletion?`,
    );

    if (!confirmed) {
      return;
    }

    setActionMessage(null);
    setDeletingUploadId(upload.upload_id);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        throw new Error("Please sign in before deleting an uploaded file.");
      }

      const response = await fetch(
        getDeleteEndpoint(upload.upload_id), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(await getResponseMessage(response, `Failed to mark the file for deletion. Status: ${response.status}`));
      }

      setActionMessage(`"${upload.blob_name}" was marked for deletion.`);
      await loadUploads(true);

    } catch (requestError) {
      window.alert(requestError instanceof Error ? requestError.message : "Something went wrong while marking the file for deletion.");
    } finally {
      setDeletingUploadId(null);
    }
  }

  return (
    <section
      className="data-page"
      aria-labelledby="upload-management-heading"
    >
      <header className="data-page-header">
        <div className="data-page-heading">
          <h1 id="upload-management-heading">
            Upload management
          </h1>

          <p className="data-page-description">
            View files received through customer upload links, extend retention, or mark files for deletion.
          </p>
        </div>

        <Link
          to="/admin/links"
          className="data-page-action"
        >
          Back to Links
        </Link>
      </header>

      {actionMessage && (
        <p
          className="data-table-message"
          role="status"
        >
          {actionMessage}
        </p>
      )}

      {isLoading && (
        <p
          className="data-table-message"
          role="status"
        >
          Loading uploaded files...
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
                    {getSortIcon("blob_name", sortKey, sortDirection)}
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
                    "status",
                    sortKey,
                    sortDirection,
                  )}
                >
                  <button
                    className="data-table-sort-button"
                    type="button"
                    onClick={() =>
                      handleSort(
                        "status",
                      )
                    }
                  >
                    Status{" "}
                    {getSortIcon(
                      "status",
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

                <th scope="col">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {sortedUploads.map(
                (upload) => {
                  const status = getUploadStatus(upload);

                  const isExtending = extendingUploadId === upload.upload_id;

                  const isDeleting = deletingUploadId === upload.upload_id;

                  const isRowBusy = isExtending || isDeleting;

                  return (
                    <tr key={upload.upload_id}>
                      <td>{upload.blob_name}</td>
                      <td>{formatBytes(upload.size)}
                      </td>

                      <td>
                        <span className={status.className}>{status.label}</span>
                      </td>

                      <td>
                        {formatDate(upload.date_uploaded)}
                      </td>

                      <td>
                        {formatDate(upload.expiration_date)}
                      </td>

                      <td>
                        <div className="data-table-actions">
                          <button
                            className="data-table-action-button"
                            type="button"
                            disabled={isRowBusy}
                            onClick={() => void extendUpload(upload.upload_id)}
                          >
                            {isExtending ? "Extending..." : "Extend"}
                          </button>

                          <button
                            className="data-table-action-button data-table-action-button--danger"
                            type="button"
                            disabled={isRowBusy}
                            onClick={() => void deleteUpload(upload)}
                          >
                            {isDeleting ? "Deleting..." : "Delete file"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}