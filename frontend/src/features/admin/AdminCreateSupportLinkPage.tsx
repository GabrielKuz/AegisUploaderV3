import {
  useState,
  //type ChangeEvent,
  type FormEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import "./AdminCreateSupportLinkPage.css";
import { getDevToken } from "../auth/devAuth";

type LinkForm = {
  caseID: string;
  ITAR: boolean | null;
};

const INITIAL_FORM: LinkForm = {
  caseID: "",
  ITAR: null,
};

export function AdminCreateSupportLinkPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState<LinkForm>(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);

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
    const response = await fetch("/api/links/create/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getDevToken()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ case_id: form.caseID, itar: form.ITAR })
    });
    if (!response.ok) {
      setError("Failed to create support link.");
      return;
    }
    const data = await response.json();
    console.log(data.uuid);
    console.log(data.link);
    navigate("/admin/links", { state: { refresh: true } });
  };

  return (
    <section
      className="create-link-page"
      aria-labelledby="create-link-heading"
    >
      <header className="create-link-header">
        <p className="create-link-eyebrow">
          Customer support
        </p>

        <h1 id="create-link-heading">
          Create a new link
        </h1>

        <p className="create-link-description">
          Inform the team of the situation and describe the
          assistance they can provide.
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
            onClick={() => navigate("/admin")}
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