import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { useApiAccessToken } from "../features/auth/useApiAccessToken";
import { useOptionalPartyMode } from "../features/totally_not_party_mode/PartyModeContext";
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

type CreateLinkResponse = {
  uuid?: unknown;
};

/**
 * Creates a temporary customer upload link.
 */
export function CreateLinkForm({
  cancelPath,
  successPath,
}: CreateLinkFormProps) {
  const navigate = useNavigate();

  const getAccessToken = useApiAccessToken();

  const partyMode = useOptionalPartyMode();

  const [caseId, setCaseId] = useState("");

  const [storageRegion, setStorageRegion] = useState<"US" | "EU">("US");

  const [error, setError] = useState<UserFacingError | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [createdLink, setCreatedLink] = useState<string | null>(null);

  const [awardedXp, setAwardedXp] = useState(0);

  const [linkCopied, setLinkCopied] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

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
    setAwardedXp(0);

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
          storage_region: storageRegion,
        }),
      });

      if (!response.ok) {
        setError(await readApiError(response, "create the upload link"));

        return;
      }

      const payload = (await response.json()) as CreateLinkResponse;

      if (typeof payload.uuid !== "string" || !payload.uuid.trim()) {
        throw new Error(
          "The link service did not return a valid upload-link ID.",
        );
      }

      const normalizedUuid = payload.uuid.trim();

      const uploadLink =
        `${window.location.origin}` + `/uploads/${normalizedUuid}`;

      /*
       * XP is recorded only after:
       *
       * 1. The request succeeds.
       * 2. The API returns a valid UUID.
       * 3. That UUID has not already been rewarded.
       */
      const xpEarned = partyMode?.recordCreatedLink(normalizedUuid) ?? 0;

      setAwardedXp(xpEarned);
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
                let value = event.target.value;

                value = value.replace(/^ais/i, "AIS");

                value = value.replace(/^AIS(?!-)(\d)/, "AIS-$1");

                setCaseId(value);

                if (error) {
                  setError(null);
                }
              }}
              required
            />
          </div>

          <div className="create-link-field">
            <label htmlFor="storage-region">Storage Region</label>

            <select
              id="storage-region"
              value={storageRegion}
              disabled={isSubmitting}
              onChange={(event) =>
                setStorageRegion(event.target.value as "US" | "EU")
              }
            >
              <option className="option" value="US">
                United States
              </option>

              <option className="option" value="EU">
                Europe
              </option>
            </select>
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
            <div className="create-link-modal__heading">
              <div>
                <h2 id="link-created-heading">Upload link created</h2>

                <p>The customer upload link was created successfully.</p>
              </div>

              {awardedXp > 0 && (
                <span className="create-link-xp-award" role="status">
                  +{awardedXp} XP
                </span>
              )}
            </div>

            <div className="created-link-display">
              <code>{createdLink}</code>

              <button
                type="button"
                className="copy-link-button"
                onClick={() => void copyCreatedLink()}
                title={linkCopied ? "Upload link copied" : "Copy upload link"}
                aria-label={
                  linkCopied ? "Upload link copied" : "Copy upload link"
                }
              >
                {linkCopied ? "✓" : "❐"}
              </button>
            </div>

            <button
              type="button"
              className="create-link-modal-submit"
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
