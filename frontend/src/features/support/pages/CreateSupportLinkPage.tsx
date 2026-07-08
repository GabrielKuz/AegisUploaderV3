import {
  useState,
  //type ChangeEvent,
  type FormEvent,
} from "react";
import { useMsal } from "@azure/msal-react";
import { useNavigate } from "react-router-dom";
import "./CreateSupportLinkPage.css";
import { isEntraConfigured } from "../../auth/authConfig";
import {
  getActiveAccount,
  getApiAccessToken,
} from "../../auth/entraAuth";
import { getDevToken } from "../../auth/devAuth";

type LinkForm = {
  caseID: string;
  ITAR: boolean | null;
};

const INITIAL_FORM: LinkForm = {
  caseID: "",
  ITAR: null,
};

/**
 * Creates a new customer-support link request.
 *
 * This page is rendered inside the shared SupportLayout, so it should only
 * control the form content and not the full app layout.
 */
export function CreateSupportLinkPage() {
  const navigate = useNavigate();
  const { instance } = useMsal();
  const account = getActiveAccount(instance);

  const [form, setForm] = useState<LinkForm>(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);


  /**
   * Validates the form before submitting.
   *
   * Replace the console statement with the real API request once the
   * backend endpoint is available.
   */
  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const hasRequiredFields =
      form.caseID.trim() !== "" && form.ITAR !== null;

    if (!hasRequiredFields) {
      setError(
        "Case ID and ITAR status are required.",
      );
      return;
    }

    setError(null);

    if (isEntraConfigured && !account) {
      setError("Please sign in before creating a support link.");
      return;
    }

    //console.info("Support link submitted:", form);
    const accessToken = isEntraConfigured
      ? await getApiAccessToken(instance, account)
      : getDevToken();

    if (!accessToken) {
      setError("Please sign in before creating a support link.");
      return;
    }

    const response = await fetch("/api/links/create/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ case_id: form.caseID, itar: form.ITAR }),
    });
    if (!response.ok) {
      setError("Failed to create support link.");
      return;
    }
    const data = await response.json();
    console.log(data.uuid);
    console.log(data.link);
    navigate("/support/links", { state: { refresh: true } });
  };

  return (
    <section
      className="create-support-link-page"
      aria-labelledby="create-link-heading"
    >
      <header className="create-link-header">
        <h1 id="create-link-heading">
          Create a new link
        </h1>

        <p className="create-link-description">
          Describe the customer request and provide enough detail for
          the support team to follow up.
        </p>
      </header>

      <form
        className="link-form"
        onSubmit={handleSubmit}
        noValidate
      >
        {error && (
          <div
            className="link-form-error"
            role="alert"
          >
            {error}
          </div>
        )}

        <label className="link-form-field">
          <span>Case ID</span>

          <input
            name="caseID"
            value={form.caseID}
            onChange={(e) =>
              setForm(prev => ({
                ...prev,
                caseID: e.target.value
              }))
            }
          />
        </label>
        <label className="link-form-field">
          <span>ITAR Status</span>

          <select
            value={
              form.ITAR === null
                ? ""
                : form.ITAR
                  ? "Yes"
                  : "No"
            }
            onChange={(e) =>
              setForm(prev => ({
                ...prev,
                ITAR: e.target.value === "Yes"
              }))
            }
          >
            <option value="">Select...</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </label>
        <div className="link-form-actions">
          <button
            type="button"
            className="link-cancel-button"
            onClick={() => navigate("/support")}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="link-submit-button"
          >
            Submit link
          </button>
        </div>
      </form>
    </section>
  );
}