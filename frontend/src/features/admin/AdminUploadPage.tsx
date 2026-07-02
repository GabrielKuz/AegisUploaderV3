import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import "../../styles/SupportTheme.css";
import "./AdminUploadPage.css";
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

function getSortIcon(
  column: string,
  sortKey: string,
  sortDirection: SortDirection
) {
  if (column !== sortKey) return "⇅";
  return sortDirection === "asc" ? "▲" : "▼";
}

export function AdminUploadPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("date_uploaded");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("desc");

  async function loadUploads() {
    if (!uuid) {return;}
    const response = await fetch(`/api/links/${uuid}/files`, {
      headers: {
        Authorization: `Bearer ${getDevToken()}`
      }
    });

    if (!response.ok) {
      console.error("Failed to load uploads.");
      return;
    }

    const data: Upload[] = await response.json();
    setUploads(data);
  }

  useEffect(() => {
    loadUploads();
  }, [uuid]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection(prev =>
        prev === "asc" ? "desc" : "asc"
      );
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  const sortedUploads = useMemo(() => {
    const copy = [...uploads];

    copy.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc"
          ? aVal - bVal
          : bVal - aVal;
      }

      const comparison = String(aVal).localeCompare(String(bVal));

      return sortDirection === "asc"
        ? comparison
        : -comparison;
    });

    return copy;
  }, [uploads, sortKey, sortDirection]);

  async function extendUpload(uploadUuid: string) {
    const input = prompt("Extend retention by how many days?");

    if (!input) return;

    const days = Number(input);

    if (!Number.isInteger(days) || days <= 0) {
      alert("Please enter a positive whole number.");
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
      alert("Failed to extend upload.");
      return;
    }

    const data = await response.json();

    alert(`Retention extended to ${data.totalPeriod} days.`);

    loadUploads();
  }

  return (
    <section className="links-page">
      <header className="links-page-header">
        <div className="links-page-heading">
          <p className="links-page-eyebrow">
            Administrator
          </p>

          <h1>
            Upload Management
          </h1>

          <p className="links-page-description">
            View uploads and extend their retention period.
          </p>
        </div>
      </header>

      <div className="links-table-wrapper">
        <table className="links-table">
          <thead>
            <tr>
              <th
                  onClick={() => handleSort("filename")}
                  style={{ cursor: "pointer" }}
              >
                  File {getSortIcon("filename", sortKey, sortDirection)}
              </th>

              <th
                  onClick={() => handleSort("size")}
                  style={{ cursor: "pointer" }}
              >
                  Size {getSortIcon("size", sortKey, sortDirection)}
              </th>

              <th
                  onClick={() => handleSort("content_type")}
                  style={{ cursor: "pointer" }}
              >
                  Type {getSortIcon("content_type", sortKey, sortDirection)}
              </th>

              <th
                  onClick={() => handleSort("date_uploaded")}
                  style={{ cursor: "pointer" }}
              >
                  Uploaded {getSortIcon("date_uploaded", sortKey, sortDirection)}
              </th>

              <th>Actions</th>
          </tr>
          </thead>

          <tbody>
            {sortedUploads.map(upload => (
                <tr key={upload.upload_id}>
                    <td>{upload.filename}</td>

                    <td>
                        {(upload.size / 1024).toFixed(1)} KB
                    </td>

                    <td>{upload.content_type}</td>

                    <td>
                        {new Date(upload.date_uploaded).toLocaleString()}
                    </td>

                    <td>
                        <button
                            className="link-submit-button"
                            onClick={() => extendUpload(upload.upload_id)}
                        >
                            Extend
                        </button>
                    </td>
                </tr>
            ))}
        </tbody>
        </table>
      </div>
    </section>
  );
}