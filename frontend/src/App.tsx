import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { AdminCreateSupportLinkPage } from "./features/admin/AdminCreateSupportLinkPage";
import { AdminHomePage } from "./features/admin/AdminHomePage";
import { AdminLinksPage } from "./features/admin/AdminLinksPage";
import { AdminUploadPage } from "./features/admin/AdminUploadPage";

import { LoginPage } from "./features/auth/LoginPage";
import { RequireEntraUser } from "./features/auth/RequireEntraUser";
import { SupportLayout } from "./layouts/SupportLayout";
import { CustomerLayout } from "./layouts/CustomerLayout";
import { AdminLayout } from "./layouts/AdminLayout";

import { CreateSupportLinkPage } from "./features/support/CreateSupportLinkPage";
import { SupportHomePage } from "./features/support/SupportHomePage";
import { SupportLinksPage } from "./features/support/SupportLinksPage";
import { SupportUploadPage } from "./features/support/SupportUploadPage";

import { CustomerUpload } from "./features/uploader/CustomerUpload";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<LoginPage />}
        />

        {/* Public customer-facing upload link. */}
        <Route
          path="/upload/:uuid"
          element={<CustomerLayout />}
        >
          <Route
            index
            element={<CustomerUpload />}
          />
        </Route>

        <Route
          path="/support"
          element={
            <RequireEntraUser>
              <SupportLayout />
            </RequireEntraUser>
          }
        >
          <Route
            index
            element={<SupportHomePage />}
          />

          <Route
            path="links"
            element={<SupportLinksPage />}
          />

          <Route
            path="links/new"
            element={<CreateSupportLinkPage />}
          />

          <Route
            path="view-uploads/:uuid"
            element={<SupportUploadPage />}
          />
        </Route>

        <Route
          path="/admin"
          element={
            <RequireEntraUser>
              <RequireEntraUser>
                <AdminLayout />
              </RequireEntraUser>
            </RequireEntraUser>
          }
        >
          <Route
            index
            element={<AdminHomePage />}
          />

          <Route
            path="links"
            element={<AdminLinksPage />}
          />

          <Route
            path="links/new"
            element={<AdminCreateSupportLinkPage />}
          />

          <Route
            path="view-uploads/:uuid"
            element={<AdminUploadPage />}
          />
        </Route>

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}