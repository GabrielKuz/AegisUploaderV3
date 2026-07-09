import { useEffect, useMemo, useState } from "react";

import { getDevToken } from "../auth/devAuth";

import "../support/SupportLinksPage.css";

const UPLOADS_ENDPOINT = "/api/uploads/";

type Upload = {
  uuid: string;
  days: number;
};

type SortKey = keyof Upload;
type SortDirection = "asc" | "desc";

function getSortIcon(
  column: SortKey,
  sortKey: SortKey,
  sortDirection: SortDirection,
) {
  if (column !== sortKey) return "⇅";
  return sortDirection === "asc" ? "▲" : "▼";
}

export function AdminUploadPage() {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("uuid");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("asc");
  const [error, setError] = useState<string | null>(null);

  async function loadUploads() {
    try {
      const response = await fetch(UPLOADS_ENDPOINT, {
        headers: {
          Authorization: `Bearer ${getDevToken()}`,
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
  }

  useEffect(() => {
    loadUploads();
  }, []);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((current) =>
        current === "asc" ? "desc" : "asc",
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

      if (typeof aValue === "number" && typeof bValue === "number") {
        const comparison = aValue - bValue;
        return sortDirection === "asc" ? comparison : -comparison;
      }

      const comparison = String(aValue).localeCompare(String(bValue));
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [uploads, sortKey, sortDirection]);

  async function extendUpload(uploadUuid: string) {
    const input = window.prompt("Extend retention by how many days?");

    if (!input) return;

    const days = Number(input);

    if (!Number.isInteger(days) || days <= 0) {
      window.alert("Please enter a positive whole number.");
      return;
    }

    const response = await fetch(`/api/upload/extend/${uploadUuid}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${getDevToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uuid: uploadUuid,
        days,
      }),
    });

    if (!response.ok) {
      window.alert("Failed to extend upload.");
      return;
    }

    await loadUploads();
  }

  return (
    <section
      className="links-page"
      aria-labelledby="upload-management-heading"
    >
      <header className="links-page-header">
        <div className="links-page-heading">
          <p className="links-page-eyebrow">
            Administrator
          </p>

          <h1 id="upload-management-heading">
            Upload management
          </h1>

          <p className="links-page-description">
            Review uploaded files and extend retention periods when support needs more time.
          </p>
        </div>
      </header>

      {error && (
        <p className="table-message" role="alert">
          {error}
        </p>
      )}

      {!error && sortedUploads.length === 0 && (
        <p className="table-message">
          No uploads found.
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
                    onClick={() => handleSort("uuid")}
                  >
                    Upload UUID {getSortIcon("uuid", sortKey, sortDirection)}
                  </button>
                </th>

                <th>
                  <button
                    className="table-sort-button"
                    type="button"
                    onClick={() => handleSort("days")}
                  >
                    Retention Days {getSortIcon("days", sortKey, sortDirection)}
                  </button>
                </th>

                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {sortedUploads.map((upload) => (
                <tr key={upload.uuid}>
                  <td>{upload.uuid}</td>
                  <td>{upload.days}</td>

                  <td>
                    <button
                      className="table-action-button"
                      type="button"
                      onClick={() => extendUpload(upload.uuid)}
                    >
                      Extend
                    </button>
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