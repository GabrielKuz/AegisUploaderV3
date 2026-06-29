import "./UploadDetails.css";
import { useState } from "react";
import "../../styles/SupportTheme.css";

export function UploadDetails() {
    const [mode, setMode] = useState<"USA" | "EU">("USA");
    return (

        <main className="support-main">
            <div className="details-panel">
                <div className="details-row">
                    <div className="details-label">Ticket ID</div>
                    <div className="details-value">AES12345</div>
                </div>
                <div className="details-row">
                    <div className="details-label">Is ITAR?</div>
                    <div className="details-value">No</div>
                </div>

                {/*</div><div className="details-row">
                    <div className="details-label">Server Location</div>

                    <div className="details-toggle">
                        <button
                            className={mode === "USA" ? "toggle-btn active" : "toggle-btn"}
                            onClick={() => setMode("USA")}
                        >
                            USA
                        </button>

                        <button
                            className={mode === "EU" ? "toggle-btn active" : "toggle-btn"}
                            onClick={() => setMode("EU")}
                        >
                            EU
                        </button>
                    </div>
                </div>
                */}
            </div>
        </main>
    );

}