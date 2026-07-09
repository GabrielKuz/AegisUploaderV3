export type LinkStatus =
  | "Open"
  | "In progress"
  | "Resolved";

export type SupportLink = {
  id: string;
  subject: string;
  category: string;
  status: LinkStatus;
  createdAt: string;
  updatedAt: string;
};

export const mockLinks: SupportLink[] = [
  {
    id: "LNK-1042",
    subject: "Unable to access secure upload request",
    category: "Access",
    status: "Open",
    createdAt: "2026-06-18",
    updatedAt: "2026-06-21",
  },
  {
    id: "LNK-1038",
    subject: "File upload stopped before completion",
    category: "File upload",
    status: "In progress",
    createdAt: "2026-06-14",
    updatedAt: "2026-06-20",
  },
  {
    id: "LNK-1029",
    subject: "Question about request expiration",
    category: "Expiration",
    status: "Resolved",
    createdAt: "2026-06-08",
    updatedAt: "2026-06-10",
  },
];