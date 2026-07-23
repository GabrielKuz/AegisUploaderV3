import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ApiErrorAlert } from "../../components/ApiErrorAlert";
import "../../components/DataTable.css";

import { formatBytes, formatDate } from "../../utils/formatters";
import {
  getUnexpectedError,
  readApiError,
  type UserFacingError,
} from "../../utils/apiErrors";
import {
  applySortDirection,
  getAriaSort,
  getSortIcon,
  type SortDirection,
} from "../../utils/sorting";
import { useApiAccessToken } from "../auth/useApiAccessToken";

const REQUEST_DEDUPE_WINDOW_MS = 1_000;

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
  | "expiration_date"
  | "upload_complete"
  | "date_uploaded";

type UploadRequestEntry = {
  createdAt: number;
  promise: Promise<Upload[]>;
};

class ApiRequestError extends Error {
  readonly userFacingError: UserFacingError;

  constructor(userFacingError: UserFacingError) {
    super(userFacingError.message);

    this.name = "ApiRequestError";
    this.userFacingError = userFacingError;
  }
}

const DATE_KEYS = new Set<SortKey>(["date_uploaded", "expiration_date"]);

const uploadRequestCache = new Map<string, UploadRequestEntry>();

function parseUploadResponse(payload: unknown): Upload[] {
  if (!Array.isArray(payload)) {
    throw new Error(
      "The files service returned an unexpected response format.",
    );
  }

  return payload as Upload[];
}

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

  const removeRequest = (): void => {
    window.setTimeout(() => {
      if (uploadRequestCache.get(requestKey) === entry) {
        uploadRequestCache.delete(requestKey);
      }
    }, REQUEST_DEDUPE_WINDOW_MS);
  };

  request.then(removeRequest, removeRequest);

  return request;
}

async function requestCaseId(
  uuid: string,
  accessToken: string,
): Promise<string> {
  const response = await fetch("/api/links", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new ApiRequestError(
      await readApiError(response, "load the upload link")
    );
  }

  const links = (await response.json()) as CaseLink[];

  const matchingLink = links.find((link) => link.uuid === uuid);

  if (!matchingLink) {
    throw new Error("Upload link not found.");
  }

  return matchingLink.case_id;
}

function getUploadStatusLabel(uploadComplete: boolean): string {
  return uploadComplete ? "Complete" : "In progress";
}

function formatOptionalDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  return formatDate(value);
}

export function SupportUpload() {
  const { uuid } = useParams<{
    uuid: string;
  }>();

  const getAccessToken = useApiAccessToken();

  const [uploads, setUploads] = useState<Upload[]>([]);

  const [caseId, setCaseId] = useState<string>("Loading...");

  const [sortKey, setSortKey] = useState<SortKey>("date_uploaded");

  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const [error, setError] = useState<UserFacingError | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [actionError, setActionError] = useState<UserFacingError | null>(null);

  const [actionMessage, setActionMessage] = useState<string | null>(null);
  
  const [linkCopied, setLinkCopied] = useState(false);

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

        const [data, currentCaseId] = await Promise.all([
          requestUploads(uuid, accessToken, forceRefresh),
          requestCaseId(uuid, accessToken),
        ]);

        setUploads(data);
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

  async function copyUploadLink(): Promise<void> {
    if (!uuid) {
      return;
    }

    const uploadLink = `${window.location.origin}/uploads/${uuid}`;

    try {
      await navigator.clipboard.writeText(uploadLink);

      setLinkCopied(true);
      setActionError(null);
      setActionMessage("Upload link copied to clipboard.");

      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setActionError({
        title: "Unable to copy link",
        message:
          "Your browser prevented the upload link from being copied. Please copy it manually.",
      });
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

        <Link to="/support/links" className="data-page-action">
          Back to links
        </Link>
      </header>
      <div className="upload-link-summary">
        <div className="upload-link-summary-row">
          <strong>Upload Link</strong>

          <div className="upload-link-value">
            <code>{`${window.location.origin}/uploads/${uuid}`}</code>

            <button
              type="button"
              className="copy-link-button"
              onClick={() => void copyUploadLink()}
              title="Copy upload link"
              aria-label="Copy upload link"
            >
              {linkCopied ? "✓" : "❐"}
            </button>
          </div>
        </div>

        <div className="upload-link-summary-row">
          <strong>Case ID</strong>
          <span>{caseId}</span>
        </div>
      </div>
      {actionError && (
        <ApiErrorAlert
          error={actionError}
          onRetry={() => setActionError(null)}
        />
      )}

      {actionMessage && (
        <p className="data-table-message" role="status">
          {actionMessage}
        </p>
      )}
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
                <th
                  scope="col"
                  aria-sort={getAriaSort("blob_name", sortKey, sortDirection)}
                >
                  <button
                    className="data-table-sort-button"
                    type="button"
                    onClick={() => handleSort("blob_name")}
                  >
                    File {getSortIcon("blob_name", sortKey, sortDirection)}
                  </button>
                </th>

                <th
                  scope="col"
                  aria-sort={getAriaSort("size", sortKey, sortDirection)}
                >
                  <button
                    className="data-table-sort-button"
                    type="button"
                    onClick={() => handleSort("size")}
                  >
                    Size {getSortIcon("size", sortKey, sortDirection)}
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
                    onClick={() => handleSort("upload_complete")}
                  >
                    Status{" "}
                    {getSortIcon("upload_complete", sortKey, sortDirection)}
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
                    onClick={() => handleSort("date_uploaded")}
                  >
                    Uploaded{" "}
                    {getSortIcon("date_uploaded", sortKey, sortDirection)}
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
              </tr>
            </thead>

            <tbody>
              {sortedUploads.map((upload) => (
                <tr key={upload.upload_id}>
                  <td>{upload.blob_name}</td>

                  <td>{formatBytes(upload.size)}</td>

                  <td>
                    <span
                      className={
                        upload.upload_complete
                          ? "data-table-badge data-table-badge--complete"
                          : "data-table-badge data-table-badge--progress"
                      }
                    >
                      {getUploadStatusLabel(upload.upload_complete)}
                    </span>
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
