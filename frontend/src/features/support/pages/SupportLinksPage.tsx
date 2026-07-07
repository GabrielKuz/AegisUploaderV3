import { Link, /*useLocation*/ } from "react-router-dom";
import { useCallback, useEffect, useState, useMemo } from "react";
import { useMsal } from "@azure/msal-react";
//import { mockLinks } from "../data/mockLinks";
import "../../../styles/SupportTheme.css";
import "./SupportLinksPage.css";
import { isEntraConfigured } from "../../auth/authConfig";
import {
  getActiveAccount,
  getApiAccessToken,
} from "../../auth/entraAuth";
import { getDevToken } from "../../auth/devAuth";

/**
 * Converts a display status into a CSS-friendly modifier.
 *
 * Example:
 * "In Progress" becomes "in-progress".
 */
/*function getStatusClassName(status: string): string {
  return status
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}*/
type SupportLink = {
    uuid: string;
    case_id: string;
    itar: boolean;
    link: string;
    creator: string;
    users_with_access: string[];
    timestamp: string;
    expired: boolean;
    expiration_date: string;
};
type SortKey = keyof SupportLink;
type SortDirection = "asc" | "desc";
function getSortIcon(
  column: string,
  sortKey: string,
  sortDirection: SortDirection
) {
  if (column !== sortKey) return "⇅";
  return sortDirection === "asc" ? "▲" : "▼";
}

/**
 * Displays previously created support links in a responsive table.
 */
export function SupportLinksPage() {
  const [links, setLinks] = useState<SupportLink[]>([]);
  //const location = useLocation();
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const { accounts, instance } = useMsal();
  const account = getActiveAccount(instance);

  useEffect(() => {
    if (!instance.getActiveAccount() && accounts[0]) {
      instance.setActiveAccount(accounts[0]);
    }
  }, [accounts, instance]);

  const loadLinks = useCallback(async () => {
    if (isEntraConfigured && !account) {
      console.error("No signed-in account found.");
      return;
    }

    const accessToken = isEntraConfigured
      ? await getApiAccessToken(instance, account)
      : getDevToken();

    if (!accessToken) {
      console.error("No access token available.");
      return;
    }

    const response = await fetch("/api/links/", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if(!response.ok) {
      console.error("Failed to load support links.");
      return;
    }
    const data: SupportLink[] = await response.json();
    if (!response.ok) {
      console.error(await response.text());
      return;
    }
    console.log(data);
    setLinks(data);
  }, [account, instance]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLinks();
  }, [loadLinks]);
  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((prev) => ( prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }
  
  const sortedLinks = useMemo(() => {
    const copy = [...links];
    copy.sort((a, b) => {
      if (sortKey === "timestamp") {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      }
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if(typeof aVal === "boolean" && typeof bVal === "boolean") {
        return sortDirection === "asc" ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
      }

      const aStr = String(aVal);
      const bStr = String(bVal);

      const comparison = aStr.localeCompare(bStr);
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return copy;
  }, [links, sortKey, sortDirection]);
  return (
    <section
      className="links-page"
      aria-labelledby="links-page-heading"
    >
      <header className="links-page-header">
        <div className="links-page-heading">
          <p className="links-page-eyebrow">
            Customer support
          </p>

          <h1 id="links-page-heading">
            Created links
          </h1>

          <p className="links-page-description">
            Review previous requests and their current status.
          </p>
        </div>

        <Link
          to="/support/links/new"
          className="new-link-link"
        >
          Create link
        </Link>
      </header>

      <div className="links-table-wrapper">
        <table className="links-table">
          <thead>
          <tr>
            <th onClick={() => handleSort("uuid")} style={{ cursor: "pointer" }}>
              UUID {getSortIcon("uuid", sortKey, sortDirection)}
            </th>

            <th onClick={() => handleSort("case_id")} style={{ cursor: "pointer" }}>
              Case ID {getSortIcon("case_id", sortKey, sortDirection)}
            </th>

            <th onClick={() => handleSort("itar")} style={{ cursor: "pointer" }}>
              ITAR {getSortIcon("itar", sortKey, sortDirection)}
            </th>

            <th onClick={() => handleSort("creator")} style={{ cursor: "pointer" }}>
              Creator {getSortIcon("creator", sortKey, sortDirection)}
            </th>

            <th onClick={() => handleSort("timestamp")} style={{ cursor: "pointer" }}>
              Created (UTC) {getSortIcon("timestamp", sortKey, sortDirection)}
            </th>

            <th
              onClick={() => handleSort("expiration_date")}
              style={{ cursor: "pointer" }}
            >
              Expires (UTC) {getSortIcon("expiration_date", sortKey, sortDirection)}
            </th>
          </tr>
        </thead>

          <tbody>
            {/*{links.map((supportLink) => {
              const statusClassName = getStatusClassName(
                supportLink.status,
              );

              return (
                <tr key={supportLink.id}>
                  <td>{supportLink.id}</td>
                  <td>{supportLink.subject}</td>
                  <td>{supportLink.category}</td>
                  <td>
                    <span className={`link-status link-status-${statusClassName}`} >
                      {supportLink.status}
                    </span>
                  </td>
                  <td>{supportLink.updatedAt}</td>
                </tr>
                
              );
            })}*/}
            {sortedLinks.map((supportLink) => (
              <tr key={supportLink.uuid}>
                  <td>
                      <Link to={`/upload/${supportLink.uuid}`}>
                          /upload/{supportLink.uuid}
                      </Link>
                  </td>

                  <td>{supportLink.case_id}</td>

                  <td>
                      {supportLink.itar ? (
                          <span
                              style={{
                                  fontWeight: "bold",
                                  backgroundColor: "#ff4d4d",
                                  color: "white",
                                  padding: "4px 8px",
                                  borderRadius: "6px"
                              }}
                          >
                              ITAR
                          </span>
                      ) : (
                          "No"
                      )}
                  </td>
                 
                  <td>{supportLink.creator}</td>
                  <td>{new Date(supportLink.timestamp).toLocaleString()}</td>
                  <td>{new Date(supportLink.expiration_date).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
