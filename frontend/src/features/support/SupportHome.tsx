import {
  CreateLinkIcon,
  LinksIcon,
  type LinkActionCardProps,
} from "../../components/LinkActionCard";
import { PortalHome } from "../../components/PortalHome";

const SUPPORT_ACTIONS = [
  {
    to: "/support/links",
    number: "01",
    title: "View your links",
    description:
      "Review generated upload links, case IDs, creators, and expiration dates.",
    actionLabel: "Go to links",
    icon: <LinksIcon />,
  },
  {
    to: "/support/links/new",
    number: "02",
    title: "Create a link",
    description:
      "Generate a temporary customer upload link for a support case.",
    actionLabel: "Create link",
    icon: <CreateLinkIcon />,
  },
] satisfies readonly LinkActionCardProps[];

export function SupportHome() {
  return (
    <PortalHome
      headingId="support-home-heading"
      title="How can we help?"
      description="Create secure customer upload links and review existing link activity."
      actions={SUPPORT_ACTIONS}
    />
  );
}