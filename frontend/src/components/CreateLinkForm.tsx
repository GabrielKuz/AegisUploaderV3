import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useApiAccessToken } from "../features/auth/useApiAccessToken";
import {
  getUnexpectedError,
  readApiError,
  type UserFacingError,
} from "../utils/apiErrors";
import { ApiErrorAlert } from "./ApiErrorAlert";
import "./CreateLinkForm.css";

type CreateLinkFormProps = {
  cancelPath: string;
  successPath: string;
};

// Creates temporary customer upload link for support case.
export function CreateLinkForm({
  cancelPath,
  successPath,
}: CreateLinkFormProps) {
  const navigate = useNavigate();

  const getAccessToken = useApiAccessToken();

  const [caseId, setCaseId] = useState("");

  const [error, setError] = useState<UserFacingError | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [createdLink, setCreatedLink] = useState<string | null>(null);

  const [linkCopied, setLinkCopied] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const trimmedCaseId = caseId.trim();

    if (!trimmedCaseId) {
      setError({
        title: "Case ID required",
        message: "Enter the customer case ID before creating an upload link.",
      });

      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        setError({
          status: 401,
          title: "Sign-in required",
          message:
            "Your session could not be verified. Sign in again before creating an upload link.",
        });

        return;
      }

      const response = await fetch("/api/links/create/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          case_id: trimmedCaseId,
        }),
      });

      if (!response.ok) {
        setError(await readApiError(response, "create the upload link"));
        return;
      }

      const payload = await response.json();

      const uploadLink = `${window.location.origin}/uploads/${payload.uuid}`;

      setCreatedLink(uploadLink);
    } catch (requestError) {
      setError(getUnexpectedError(requestError, "create the upload link"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyCreatedLink(): Promise<void> {
    if (!createdLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(createdLink);

      setLinkCopied(true);

      window.setTimeout(() => {
        setLinkCopied(false);
      }, 2000);
    } catch {
      setError({
        title: "Unable to copy link",
        message:
          "Your browser prevented copying the upload link. Please copy it manually.",
      });
    }
  }
  return (
    <section className="create-link-page" aria-labelledby="create-link-heading">
      <header className="create-link-header">
        <h1 id="create-link-heading">Create a new upload link</h1>

        <p className="create-link-description">
          Enter the customer case ID to create a secure temporary upload link.
        </p>
      </header>

      <div className="create-link-shell">
        <form className="create-link-form" onSubmit={handleSubmit} noValidate>
          {error && (
            <div id="create-link-error">
              <ApiErrorAlert error={error} />
            </div>
          )}

          <div className="create-link-field">
            <label htmlFor="case-id">Case ID</label>

            <input
              id="case-id"
              name="caseId"
              type="text"
              value={caseId}
              placeholder="Example: AIS-12345"
              autoComplete="off"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "create-link-error" : undefined}
              disabled={isSubmitting}
              onChange={(event) => {
                setCaseId(event.target.value);

                if (error) {
                  setError(null);
                }
              }}
              required
            />
          </div>

          <div className="create-link-actions">
            <button
              className="create-link-cancel"
              type="button"
              disabled={isSubmitting}
              onClick={() => navigate(cancelPath)}
            >
              Cancel
            </button>

            <button
              className="create-link-submit"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create"}
            </button>
          </div>
        </form>

        <aside className="create-link-info">
          <h2>What happens next?</h2>

          <p>
            A temporary upload link will be created for this case. Share it with
            the customer so they can submit files securely.
          </p>
        </aside>
      </div>
      {createdLink && (
        <div className="create-link-modal-overlay">
          <div
            className="create-link-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="link-created-heading"
          >
            <h2 id="link-created-heading">
              Upload link created
            </h2>

            <p>
              The customer upload link has been created successfully.
            </p>

            <div className="created-link-display">
              <code>{createdLink}</code>

              <button
                type="button"
                className="copy-link-button"
                onClick={() => void copyCreatedLink()}
                title="Copy upload link"
                aria-label="Copy upload link"
              >
                {linkCopied ? "✓" : "❐"}
              </button>
            </div>

            <button
              type="button"
              className="create-link-submit"
              onClick={() => navigate(successPath)}
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
