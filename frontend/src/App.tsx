import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { LoginPage } from "./features/auth/LoginPage";
import { RequireEntraUser } from "./features/auth/RequireEntraUser";

import { SupportLayout } from "./layouts/SupportLayout";
import { CustomerLayout } from "./layouts/CustomerLayout";
import { AdminLayout } from "./layouts/AdminLayout";

import { SupportHomePage } from "./features/support/pages/SupportHomePage";
import { SupportLinksPage } from "./features/support/pages/SupportLinksPage";
import { CreateSupportLinkPage } from "./features/support/pages/CreateSupportLinkPage";

import { AdminHomePage } from "./features/admin/AdminHomePage";
import { AdminLinksPage } from "./features/admin/AdminLinksPage";
import { AdminCreateSupportLinkPage } from "./features/admin/AdminCreateSupportLinkPage";
import { AdminUploadPage } from "./features/admin/AdminUploadPage";

import { CustomerUpload } from "./features/uploader/CustomerUpload";
import { UploadDetails } from "./features/uploader/UploadDetails";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />

        <Route
          path="/upload/:uuid"
          element={<CustomerLayout />}
        >
          <Route index element={<CustomerUpload />} />
          <Route path="details" element={<UploadDetails />} />
        </Route>

        <Route
          path="/support"
          element={
            <RequireEntraUser>
              <SupportLayout />
            </RequireEntraUser>
          }
        >
          <Route index element={<SupportHomePage />} />
          <Route path="links" element={<SupportLinksPage />} />
          <Route path="links/new" element={<CreateSupportLinkPage />} />
        </Route>

        <Route
          path="/admin"
          element={
            <RequireDevUser>
              <AdminLayout />
            </RequireDevUser>
          }
        >
          <Route index element={<AdminHomePage />} />
          <Route path="links" element={<AdminLinksPage />} />
          <Route path="links/new" element={<AdminCreateSupportLinkPage />} />
          <Route path="view-uploads" element={<AdminUploadPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}