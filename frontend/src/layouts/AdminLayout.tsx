import { AppLayout } from "./AppLayout";

const ADMIN_NAV_ITEMS = [
  {
    to: "/admin",
    label: "Home",
    end: true,
  },
  {
    to: "/admin/links",
    label: "View Links",
    end: true,
  },
  {
    to: "/admin/links/new",
    label: "Create Link",
    end: true,
  },
] as const;

export function AdminLayout() {
  return (
    <AppLayout
      productName="Secure Data Portal"
      sectionName="Admin Portal"
      navLabel="Admin navigation"
      navItems={ADMIN_NAV_ITEMS}
      defaultUserName="Admin User"
    />
  );
}