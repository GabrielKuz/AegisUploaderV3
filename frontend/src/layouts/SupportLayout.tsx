import { AppLayout } from "./AppLayout";

const SUPPORT_NAV_ITEMS = [
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
];

// Configures shared support user layout
export function SupportLayout() {
  return (
    <AppLayout
      productName="Secure Data Portal"
      sectionName="Customer Support"
      navLabel="Customer support"
      navItems={SUPPORT_NAV_ITEMS}
    />
  );
}