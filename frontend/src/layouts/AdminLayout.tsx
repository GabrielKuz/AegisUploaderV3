
import { AppLayout } from "./AppLayout";

export function AdminLayout() {
  return (
    <AppLayout
      productName="Secure Data Portal"
      sectionName="Administrative Support"
      navLabel="Administration"
      defaultUserName="Admin User"
      navItems={[
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
      ]}
    />
  );
}