import {
  CreateLinkIcon,
  LinksIcon,
  type LinkActionCardProps,
} from "../../components/LinkActionCard";
import { PortalHomePage } from "../../components/PortalHomePage";

const ADMIN_ACTIONS = [
  {
    to: "/admin/links",
    number: "01",
    title: "View links",
    description:
      "Review generated upload links, case IDs, creators, and expiration dates.",
    actionLabel: "View links",
    icon: <LinksIcon />,
  },
  {
    to: "/admin/links/new",
    number: "02",
    title: "Create a link",
    description:
      "Generate a temporary customer upload link for a support case.",
    actionLabel: "Create link",
    icon: <CreateLinkIcon />,
  },
] satisfies readonly LinkActionCardProps[];

export function AdminHomePage() {
  return (
    <PortalHomePage
      headingId="admin-home-heading"
      title="Admin dashboard"
      description="Manage upload links and adjust upload retention when needed."
      actions={ADMIN_ACTIONS}
    />
  );
}