import { Link } from "react-router-dom";

import { mockLinks } from "../data/mockLinks";
import "../../../styles/SupportTheme.css";
import "./SupportLinksPage.css";

function getStatusClassName(status: string): string {
  return status
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

export function SupportLinksPage() {
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
              <th scope="col">Link</th>
              <th scope="col">Subject</th>
              <th scope="col">Category</th>
              <th scope="col">Status</th>
              <th scope="col">Last updated</th>
            </tr>
          </thead>

          <tbody>
            {mockLinks.map((supportLink) => {
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
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
