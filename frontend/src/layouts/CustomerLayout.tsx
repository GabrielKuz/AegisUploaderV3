import { Navigate, useParams } from "react-router-dom";
import { useState } from "react";
import { AppLayout } from "./AppLayout";
import {
  CustomerUploadProvider,
  useCustomerUpload,
} from "../features/customer/CustomerUploadContext";
import { formatBytes } from "../utils/formatters";


/**
 * Displays customer upload statistics in the application sidebar.
 */
function CustomerUploadSummary() {
  const {
    uploadedCount,
    uploadedBytes,
    uuid,
    region,
    setRegion,
    uploadStarted,
    settingsLoaded,
    deletionRequested,
    markDeletionRequested,
  } = useCustomerUpload();

  const [requestSent, setRequestSent] = useState(false);

  return (
    <section
      className="customer-upload-summary"
      aria-labelledby="upload-summary-title"
    >
      <h2 id="upload-summary-title" className="customer-upload-summary-title">
        Upload Summary
      </h2>

      <dl className="customer-upload-summary-list">
        <div className="customer-upload-summary-item">
          <dt>Files Uploaded</dt>
          <dd>{uploadedCount}</dd>
        </div>

        <div className="customer-upload-summary-item">
          <dt>Total Uploaded</dt>
          <dd>{formatBytes(uploadedBytes)}</dd>
        </div>

        <div className="customer-upload-summary-item">
          <dt>UUID</dt>
          <dd>
            <code>{uuid}</code>
          </dd>
        </div>
      </dl>

      <div className="customer-upload-region">
        <span className="customer-upload-region-label">
          Upload Region
        </span>

        <label className="region-switch" htmlFor="region-switch">
          <span className={region === "US" ? "region-option active" : "region-option"}>
            US
          </span>

          <input
            id="region-switch"
            type="checkbox"
            checked={region === "EU"}
            disabled={!settingsLoaded || uploadStarted}
            onChange={(event) => {
              setRegion(event.target.checked ? "EU" : "US");
            }}
          />

          <span className="region-slider" />

          <span className={region === "EU" ? "region-option active" : "region-option"}>
            EU
          </span>
        </label>

        {uploadStarted && (
          <small className="region-lock-message">
            Region locked after upload started.
          </small>
        )}
      </div>
      <div className="customer-upload-region">
        <span className="customer-upload-region-label">
          Delete Uploaded Files
        </span>

        <button
          className="customer-delete-button"
          disabled={deletionRequested}
          onClick={async () => {
            const confirmed = window.confirm(
              "Request deletion of all uploaded files?"
            );

            if (!confirmed) {
              return;
            }

            try {
              const response = await fetch(
                `/api/requestfordeletion/${encodeURIComponent(uuid)}`,
                {
                  method: "POST",
                },
              );

              if (!response.ok) {
                throw new Error();
              }

              markDeletionRequested();
              setRequestSent(true);
            } catch {
              window.alert(
                "Unable to send the deletion request. Please try again."
              );
            }
          }}
        >
          {deletionRequested
            ? "Deletion Requested"
            : "Request Deletion"}
        </button>

        
        {(requestSent || deletionRequested) && (
          <small className="region-lock-message">
            Your deletion request has been sent successfully.
          </small>
        )}
      </div>
    </section>
  );
}

/**
 * Provides customer upload routes with shared state and layout.
 */
export function CustomerLayout() {
  const { uuid } = useParams<{
    uuid: string;
  }>();

  if (!uuid) {
    return <Navigate to="/" replace />;
  }

  return (
    <CustomerUploadProvider key={uuid} uuid={uuid}>
      <AppLayout
        productName="Customer Upload"
        sectionName="Provide Files"
        navLabel="Upload summary"
        sidebarContent={<CustomerUploadSummary />}
        showUserMenu={false}
        showSignOut={false}
      />
    </CustomerUploadProvider>
  );
}
