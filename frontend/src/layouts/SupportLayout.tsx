import { AppLayout } from "./AppLayout";

const SUPPORT_NAV_ITEMS = [
  {
    to: "/support",
    label: "Home",
    end: true,
  },
  {
    to: "/support/links",
    label: "View Links",
    end: true,
  },
  {
    to: "/support/links/new",
    label: "Create Link",
    end: true,
  },
] as const;

export function SupportLayout() {
  return (
    <AppLayout
      productName="Secure Data Portal"
      sectionName="Support Portal"
      navLabel="Support navigation"
      navItems={SUPPORT_NAV_ITEMS}
    />
  );
}
