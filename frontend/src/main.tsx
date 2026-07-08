import React from "react";
import ReactDOM from "react-dom/client";
import { MsalProvider } from "@azure/msal-react";

import App from "./App";
import { initializeMsalInstance, msalInstance } from "./features/auth/authConfig";
import { ThemeProvider } from "./theme/ThemeContext";

import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/PortalTheme.css";

async function bootstrap() {
  await initializeMsalInstance();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </MsalProvider>
    </React.StrictMode>,
  );
}

void bootstrap();
