import { AppLayout } from "./AppLayout";

export function SupportLayout() {
  return (
    <AppLayout
      productName="Secure Data Portal"
      sectionName="Customer Support"
      navLabel="Customer support"
      defaultUserName="Support User"
      navItems={[
        {
          to: "/support",
          label: "Home",
          end: true,
        },
        {
          to: "/support/links",
          label: "Created links",
          end: true,
        },
        {
          to: "/support/links/new",
          label: "Create link",
        },
      ]}
    />
  );
}