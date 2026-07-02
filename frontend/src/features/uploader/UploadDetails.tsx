import { useParams } from "react-router-dom";

import "../../styles/SupportTheme.css";
import "./UploadDetails.css";

export function UploadDetails() {
    const { uuid } = useParams();

    return (
        <section
            className="upload-details-page"
            aria-labelledby="upload-details-heading"
        >
            <header className="upload-details-header">
                <p className="upload-details-eyebrow">
                    Upload details
                </p>

                <h1 id="upload-details-heading">
                    Link information
                </h1>

                <p>
                    Review the current upload link settings and ticket details.
                </p>
            </header>

            <div className="details-panel">
                <div className="details-row">
                    <span className="details-label">
                        UUID
                    </span>

                    <span className="details-value">
                        {uuid ?? "No upload session found"}
                    </span>
                </div>

                <div className="details-row">
                    <span className="details-label">
                        ITAR controlled
                    </span>

                    <span className="details-value">
                        No
                    </span>
                </div>
            </div>
        </section>
    );
}