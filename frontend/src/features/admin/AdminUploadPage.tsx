import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  applySortDirection,
  getAriaSort,
  getSortIcon,
  type SortDirection,
} from "../../utils/sorting";
import { useApiAccessToken } from "../auth/useApiAccessToken";
import "../../components/DataTablePage.css";

const UPLOADS_ENDPOINT = "/api/uploads/";

type Upload = {
  uuid: string;
  days: number;
};

type SortKey = keyof Upload;

export function AdminUploadPage() {
  const getAccessToken =
    useApiAccessToken();

  const [uploads, setUploads] =
    useState<Upload[]>([]);
  const [sortKey, setSortKey] =
    useState<SortKey>("uuid");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("asc");
  const [error, setError] =
    useState<string | null>(null);
  const [isLoading, setIsLoading] =
    useState(true);
  const [extendingUuid, setExtendingUuid] =
    useState<string | null>(null);

  const loadUploads = useCallback(async () => {
    setError(null);
    setIsLoading(true);

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
        UPLOADS_ENDPOINT,
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) {
        setUploads([]);
        setError(
          "Failed to load upload retention records.",
        );
        return;
      }

      const data =
        (await response.json()) as Upload[];

      setUploads(data);
    } catch {
      setUploads([]);
      setError(
        "Something went wrong while loading upload retention records.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

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
    setSortDirection("asc");
  }

  const sortedUploads = useMemo(() => {
    return [...uploads].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

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
        String(aValue).localeCompare(
          String(bValue),
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

  async function extendUpload(
    uploadUuid: string,
  ): Promise<void> {
    const input = window.prompt(
      "Extend retention by how many days?",
    );

    if (!input) {
      return;
    }

    const days = Number(input);

    if (
      !Number.isInteger(days) ||
      days <= 0
    ) {
      window.alert(
        "Please enter a positive whole number.",
      );
      return;
    }

    const accessToken =
      await getAccessToken();

    if (!accessToken) {
      window.alert(
        "Please sign in before extending upload retention.",
      );
      return;
    }

    setExtendingUuid(uploadUuid);

    try {
      const response = await fetch(
        `/api/upload/extend/${uploadUuid}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uuid: uploadUuid,
            days,
          }),
        },
      );

      if (!response.ok) {
        window.alert(
          "Failed to extend upload retention.",
        );
        return;
      }

      await loadUploads();
    } catch {
      window.alert(
        "Something went wrong while extending upload retention.",
      );
    } finally {
      setExtendingUuid(null);
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
            Review upload retention periods and extend them
            when additional time is needed.
          </p>
        </div>
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
            No upload retention records found.
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
                      Upload UUID{" "}
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
                      "days",
                      sortKey,
                      sortDirection,
                    )}
                  >
                    <button
                      className="data-table-sort-button"
                      type="button"
                      onClick={() =>
                        handleSort("days")
                      }
                    >
                      Retention days{" "}
                      {getSortIcon(
                        "days",
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
                {sortedUploads.map((upload) => {
                  const isExtending =
                    extendingUuid === upload.uuid;

                  return (
                    <tr key={upload.uuid}>
                      <td>{upload.uuid}</td>
                      <td>{upload.days}</td>

                      <td>
                        <button
                          className="data-table-action-button"
                          type="button"
                          disabled={isExtending}
                          onClick={() =>
                            void extendUpload(upload.uuid)
                          }
                        >
                          {isExtending
                            ? "Extending..."
                            : "Extend"}
                        </button>
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