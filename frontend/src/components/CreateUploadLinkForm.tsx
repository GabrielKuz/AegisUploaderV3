import {
    useState,
    type FormEvent,
} from "react";
import { useNavigate } from "react-router-dom";

import { useApiAccessToken } from "../features/auth/useApiAccessToken";

import "./CreateUploadLinkForm.css";

type CreateUploadLinkFormProps = {
    cancelPath: string;
    successPath: string;
};

// Creates temporary customer upload link for support case.
export function CreateUploadLinkForm({
    cancelPath,
    successPath,
}: CreateUploadLinkFormProps) {
    const navigate = useNavigate();
    const getAccessToken = useApiAccessToken();

    const [caseId, setCaseId] = useState("");
    const [error, setError] =
        useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] =
        useState(false);

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>,
    ): Promise<void> {
        event.preventDefault();

        const trimmedCaseId = caseId.trim();

        if (!trimmedCaseId) {
            setError("Case ID is required.");
            return;
        }

        setError(null);
        setIsSubmitting(true);

        try {
            const accessToken = await getAccessToken();

            if (!accessToken) {
                setError(
                    "Please sign in before creating an upload link.",
                );
                return;
            }

            const response = await fetch(
                "/api/links/create/",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        case_id: trimmedCaseId,

                        // Remove when the backend no longer requires this field.
                        itar: false,
                    }),
                },
            );

            if (!response.ok) {
                const message = await response.text();

                setError(
                    message.trim() ||
                    `Failed to create the upload link. Status: ${response.status}`
                );
                return;
            }

            navigate(successPath);
        } catch {
            setError(
                "Something went wrong while creating the upload link.",
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <section
            className="create-link-page"
            aria-labelledby="create-link-heading"
        >
            <header className="create-link-header">
                <h1 id="create-link-heading">
                    Create a new upload link
                </h1>

                <p className="create-link-description">
                    Enter the customer case ID to create a secure
                    temporary upload link.
                </p>
            </header>

            <div className="create-link-shell">
                <form
                    className="create-link-form"
                    onSubmit={handleSubmit}
                    noValidate
                >
                    {error && (
                        <div
                            id="create-link-error"
                            className="create-link-error"
                            role="alert"
                        >
                            {error}
                        </div>
                    )}

                    <div className="create-link-field">
                        <label htmlFor="case-id">
                            Case ID
                        </label>

                        <input
                            id="case-id"
                            name="caseId"
                            type="text"
                            value={caseId}
                            placeholder="Example: AIS-12345"
                            autoComplete="off"
                            aria-describedby={
                                error
                                    ? "create-link-error"
                                    : undefined
                            }
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
                            {isSubmitting
                                ? "Creating..."
                                : "Create link"}
                        </button>
                    </div>
                </form>

                <aside className="create-link-info">
                    <h2>What happens next?</h2>

                    <p>
                        A temporary upload link will be created for
                        this case. Share it with the customer so they
                        can submit files securely.
                    </p>
                </aside>
            </div>
        </section>
    );
}