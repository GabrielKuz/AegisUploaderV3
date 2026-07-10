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
    caseID: string;
};

const INITIAL_FORM: LinkForm = {
    caseID: "",
};

export function CreateUploadLinkForm({
    cancelPath,
    eyebrow,
}: CreateUploadLinkFormProps) {
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
            form.caseID.trim() !== "";

        if (!hasRequiredFields) {
            setError(
                "Case ID is required.",
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
            body: JSON.stringify({ case_id: form.caseID, itar: false}),
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
                            value={form.caseID}
                            placeholder="Example: AIS-12345"
                            onChange={(event) =>
                                setForm({
                                    caseID: event.target.value,
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
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="link-submit-button"
                        >
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