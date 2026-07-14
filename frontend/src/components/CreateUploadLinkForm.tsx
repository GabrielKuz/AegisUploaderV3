import {
    useState,
    type FormEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";

import { isEntraConfigured } from "../features/auth/authConfig";
import {
    getActiveAccount,
    getApiAccessToken,
} from "../features/auth/entraAuth";
import { getDevToken } from "../features/auth/devAuth";

import "../features/support/CreateSupportLinkPage.css";

type CreateUploadLinkFormProps = {
    cancelPath: string;
    successPath: string;
    eyebrow?: string;
};

type LinkForm = {
    caseId: string;
};

const INITIAL_FORM: LinkForm = {
    caseId: "",
};

export function CreateUploadLinkForm({
    cancelPath,
    successPath,
    eyebrow,
}: CreateUploadLinkFormProps) {
    const navigate = useNavigate();
    const { accounts, instance } = useMsal();

    const [form, setForm] = useState<LinkForm>(INITIAL_FORM);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function getAccessToken() {
        if (!isEntraConfigured) {
            return getDevToken();
        }

        const account = getActiveAccount(instance) ?? accounts[0];

        if (!account) {
            return null;
        }

        if (!instance.getActiveAccount()) {
            instance.setActiveAccount(account);
        }

        return getApiAccessToken(instance, account);
    }

    const handleSubmit = async (
        event: FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();

        const caseId = form.caseId.trim();

        if (!caseId) {
            setError("Case ID is required.");
            return;
        }

        setError(null);
        setIsSubmitting(true);

        try {
            const accessToken = await getAccessToken();

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
                body: JSON.stringify({
                    case_id: caseId,

                    // Keep this until the backend no longer requires ITAR.
                    itar: false,
                }),
            });

            if (!response.ok) {
                const message = await response.text();

                setError(
                    message ||
                    `Failed to create support link. Status: ${response.status}`,
                );

                return;
            }

            navigate(successPath, { state: { refresh: true } });
        } catch {
            setError("Something went wrong while creating the support link.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <section
            className="create-support-link-page"
            aria-labelledby="create-link-heading"
        >
            <header className="create-link-header">
                {eyebrow && (
                    <p className="create-link-eyebrow">
                        {eyebrow}
                    </p>
                )}

                <h1 id="create-link-heading">
                    Create a new upload link
                </h1>

                <p className="create-link-description">
                    Enter the customer case ID to create a secure temporary upload link.
                </p>
            </header>

            <div className="create-link-shell">
                <form
                    className="link-form"
                    onSubmit={handleSubmit}
                    noValidate
                >
                    {error && (
                        <div className="link-form-error" role="alert">
                            {error}
                        </div>
                    )}

                    <label className="link-form-field">
                        <span>Case ID</span>

                        <input
                            name="caseId"
                            value={form.caseId}
                            placeholder="Example: AIS-12345"
                            onChange={(event) =>
                                setForm({
                                    caseId: event.target.value,
                                })
                            }
                            required
                        />
                    </label>

                    <div className="link-form-actions">
                        <button
                            type="button"
                            className="link-cancel-button"
                            onClick={() => navigate(cancelPath)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="link-submit-button"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Creating..." : "Submit"}
                        </button>
                    </div>
                </form>

                <aside className="create-link-info">
                    <h2>What happens next?</h2>

                    <p>
                        A temporary upload link will be created for this case.
                        Share it with the customer so they can submit files securely.
                    </p>
                </aside>
            </div>
        </section>
    );
}