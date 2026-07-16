import { AppLayout } from "./AppLayout";

const ADMIN_NAV_ITEMS = [
  {
    to: "/admin",
    label: "Home",
    end: true,
  },
  {
    to: "/admin/links",
    label: "Created links",
    end: true,
  },
  {
    to: "/admin/links/new",
    label: "Create link",
  },
];

// Configures shared administrator layout
export function AdminLayout() {
  return (
    <AppLayout
      productName="Secure Data Portal"
      sectionName="Administrative Support"
      navLabel="Administration"
      defaultUserName="Admin User"
      navItems={ADMIN_NAV_ITEMS}
    />
  );
}