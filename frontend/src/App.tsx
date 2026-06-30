import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { LoginPage } from "./features/auth/LoginPage";
import { RequireDevUser } from "./features/auth/RequireDevUser";
import { SupportHomePage } from "./features/support/pages/SupportHomePage";
import { SupportLinksPage } from "./features/support/pages/SupportLinksPage";
import { CreateSupportLinkPage } from "./features/support/pages/CreateSupportLinkPage";
import { SupportLayout } from "./layouts/SupportLayout";
import { CustomerLayout } from "./layouts/CustomerLayout";
import { CustomerUpload } from "./features/uploader/CustomerUpload";
import { UploadDetails } from "./features/uploader/UploadDetails";
export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/" element={<LoginPage />} />

        <Route
          path="/upload"
          element={
            <RequireDevUser>
              <CustomerLayout />
            </RequireDevUser>
          }
        >
          <Route index element={<CustomerUpload />} />
          <Route
            path="/upload/details"
            element={<UploadDetails />}
          />
        </Route>




        <Route
          path="/support"
          element={
            <RequireDevUser>
              <SupportLayout />
            </RequireDevUser>
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
