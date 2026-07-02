import {
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useNavigate } from "react-router-dom";

import "../../../styles/SupportTheme.css";
import "./CreateSupportLinkPage.css";

type LinkForm = {
  subject: string;
  category: string;
  description: string;
  urgency: string;
};

type LinkFormField = keyof LinkForm;

const INITIAL_FORM: LinkForm = {
  subject: "",
  category: "",
  description: "",
  urgency: "Normal",
};

const categoryOptions = [
  "Access",
  "File upload",
  "Expiration",
  "Account",
  "Other",
] as const;

const urgencyOptions = [
  "Low",
  "Normal",
  "High",
] as const;

/**
 * Creates a new customer-support link request.
 *
 * This page is rendered inside the shared SupportLayout, so it should only
 * control the form content and not the full app layout.
 */
export function CreateSupportLinkPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState<LinkForm>(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);

  /**
   * Updates one form field and clears stale validation errors.
   */
  const updateField = (
    field: LinkFormField,
    value: string,
  ) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));

    if (error) {
      setError(null);
    }
  };

  /**
   * Handles input, select, and textarea changes.
   */
  const handleFieldChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const field = event.target.name as LinkFormField;
    updateField(field, event.target.value);
  };

  /**
   * Validates the form before submitting.
   *
   * Replace the console statement with the real API request once the
   * backend endpoint is available.
   */
  const handleSubmit = (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const hasRequiredFields =
      form.subject.trim() &&
      form.category &&
      form.description.trim();

    if (!hasRequiredFields) {
      setError(
        "Subject, category, and description are required.",
      );
      return;
    }

    setError(null);

    console.info("Support link submitted:", form);
    navigate("/support/links");
  };

  return (
    <section
      className="create-support-link-page"
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
          <span>Subject</span>

          <input
            name="subject"
            type="text"
            value={form.subject}
            onChange={handleFieldChange}
            autoComplete="off"
            required
          />
        </label>

        <label className="link-form-field">
          <span>Category</span>

          <select
            name="category"
            value={form.category}
            onChange={handleFieldChange}
            required
          >
            <option value="">
              Select a category
            </option>

            {categoryOptions.map((category) => (
              <option
                key={category}
                value={category}
              >
                {category}
              </option>
            ))}
          </select>
        </label>

        <label className="link-form-field">
          <span>Urgency</span>

          <select
            name="urgency"
            value={form.urgency}
            onChange={handleFieldChange}
          >
            {urgencyOptions.map((urgency) => (
              <option
                key={urgency}
                value={urgency}
              >
                {urgency}
              </option>
            ))}
          </select>
        </label>

        <label className="link-form-field link-description-field">
          <span>Description</span>

          <textarea
            name="description"
            rows={8}
            value={form.description}
            onChange={handleFieldChange}
            required
          />
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