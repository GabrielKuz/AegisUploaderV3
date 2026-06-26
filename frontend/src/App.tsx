import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { LoginPage } from "./features/auth/LoginPage";
import { RequireSupportUser } from "./features/auth/RequireSupportUser";
import { SupportHomePage } from "./features/support/pages/SupportHomePage";
import { SupportLinksPage } from "./features/support/pages/SupportLinksPage";
import { CreateSupportLinkPage } from "./features/support/pages/CreateSupportLinkPage";
import { SupportLayout } from "./layouts/SupportLayout";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />

        <Route
          path="/support"
          element={
            <RequireSupportUser>
              <SupportLayout />
            </RequireSupportUser>
          }
        >
          <Route index element={<SupportHomePage />} />

          <Route
            path="links"
            element={<SupportLinksPage />}
          />

          <Route
            path="links/new"
            element={<CreateSupportLinkPage />}
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}