import { PortalLayout } from "./PortalLayout";

export function SupportLayout() {
  return (
    <PortalLayout
      productName="Secure Data Portal"
      sectionName="Customer Support"
      navLabel="Customer support"
      defaultUserName="Support User"
      navItems={[
        { to: "/support", label: "Home", end: true },
        { to: "/support/links", label: "Created links", end: true },
        { to: "/support/links/new", label: "Create link" },
      ]}
    />
  );
}