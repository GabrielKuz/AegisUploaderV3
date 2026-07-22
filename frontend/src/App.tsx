import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { AdminCreateLink } from "./features/admin/AdminCreateLink";
import { AdminHome } from "./features/admin/AdminHome";
import { AdminUpload } from "./features/admin/AdminUpload";

import { Login } from "./features/auth/Login";
import { RequireEntraUser } from "./features/auth/RequireEntraUser";
import { SupportLayout } from "./layouts/SupportLayout";
import { CustomerLayout } from "./layouts/CustomerLayout";
import { AdminLayout } from "./layouts/AdminLayout";

import { SupportCreateLink } from "./features/support/SupportCreateLink";
import { SupportHome } from "./features/support/SupportHome";
import { SupportViewLinks } from "./features/support/SupportViewLinks";
import { SupportUpload } from "./features/support/SupportUpload";

import { CustomerUpload } from "./features/customer/CustomerUpload";
import { AdminViewLinks } from "./features/admin/AdminViewLinks";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Login />}
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
            element={<SupportHome />}
          />

          <Route
            path="links"
            element={<SupportViewLinks />}
          />

          <Route
            path="links/new"
            element={<SupportCreateLink />}
          />

          <Route
            path="view-uploads/:uuid"
            element={<SupportUpload />}
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
            element={<AdminHome />}
          />

          <Route
            path="links"
            element={<AdminViewLinks />}
          />

          <Route
            path="links/new"
            element={<AdminCreateLink />}
          />

          <Route
            path="view-uploads/:uuid"
            element={<AdminUpload />}
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