import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AdminCreateLink } from "./features/admin/AdminCreateLink";
import { AdminHome } from "./features/admin/AdminHome";
import { AdminUpload } from "./features/admin/AdminUpload";
import { AdminViewLinks } from "./features/admin/AdminViewLinks";

import { Login } from "./features/auth/Login";
import { RequireEntraUser } from "./features/auth/RequireEntraUser";
import { RoleAwareRedirect } from "./features/auth/RoleAwareRedirect";

import { CustomerUpload } from "./features/customer/CustomerUpload";

import { PartyModeProvider } from "./features/totally_not_party_mode/PartyModeProvider";
import { TributePage } from "./features/totally_not_party_mode/TributePage";

import { SupportCreateLink } from "./features/support/SupportCreateLink";
import { SupportHome } from "./features/support/SupportHome";
import { SupportUpload } from "./features/support/SupportUpload";
import { SupportViewLinks } from "./features/support/SupportViewLinks";

import { AdminLayout } from "./layouts/AdminLayout";
import { CustomerLayout } from "./layouts/CustomerLayout";
import { SupportLayout } from "./layouts/SupportLayout";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ================================================================
            PUBLIC ROUTES
            ================================================================ */}

        <Route path="/" element={<Login />} />

        <Route path="/uploads/:uuid" element={<CustomerLayout />}>
          <Route index element={<CustomerUpload />} />
        </Route>

        <Route
          path="/view-uploads/:uuid"
          element={
            <RequireEntraUser>
              <RoleAwareRedirect />
            </RequireEntraUser>
          }
        />

        {/* ================================================================
            SUPPORT ROUTES
            ================================================================ */}

        <Route
          path="/support"
          element={
            <RequireEntraUser requiredRole="support">
              <PartyModeProvider>
                <SupportLayout />
              </PartyModeProvider>
            </RequireEntraUser>
          }
        >
          <Route index element={<SupportHome />} />

          <Route path="links" element={<SupportViewLinks />} />

          <Route path="links/new" element={<SupportCreateLink />} />

          <Route path="view-uploads/:uuid" element={<SupportUpload />} />

          <Route path="intern-tribute-2026" element={<TributePage />} />
        </Route>

        {/* ================================================================
            ADMIN ROUTES
            ================================================================ */}

        <Route
          path="/admin"
          element={
            <RequireEntraUser requiredRole="admin">
              <PartyModeProvider>
                <AdminLayout />
              </PartyModeProvider>
            </RequireEntraUser>
          }
        >
          <Route index element={<AdminHome />} />

          <Route path="links" element={<AdminViewLinks />} />

          <Route path="links/new" element={<AdminCreateLink />} />

          <Route path="view-uploads/:uuid" element={<AdminUpload />} />

          <Route path="intern-tribute-2026" element={<TributePage />} />
        </Route>

        {/* ================================================================
            FALLBACK
            ================================================================ */}

        {/* Send unknown URLs back to the login/root page. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
