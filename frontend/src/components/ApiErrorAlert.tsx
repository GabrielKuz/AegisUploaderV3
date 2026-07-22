import type { UserFacingError } from "../utils/apiErrors";

import "./ApiErrorAlert.css";

type ApiErrorAlertProps = {
  error: UserFacingError;
  onRetry?: () => void;
};

export function ApiErrorAlert({ error, onRetry }: ApiErrorAlertProps) {
  return (
    <div className="data-error-alert" role="alert">
      <div className="data-error-alert-icon" aria-hidden="true">
        !
      </div>

      <div className="data-error-alert-content">
        <div className="data-error-alert-heading">
          {error.status !== undefined && (
            <span className="data-error-alert-status">{error.status}</span>
          )}

          <span>{error.title}</span>
        </div>

        <p className="data-error-alert-message">{error.message}</p>

        {onRetry && (
          <button
            className="data-error-retry-button"
            type="button"
            onClick={onRetry}
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
