export type SortDirection =
    | "asc"
    | "desc";

export type AriaSortValue =
    | "ascending"
    | "descending"
    | "none";

export function applySortDirection(
    comparison: number,
    sortDirection: SortDirection,
): number {
    return sortDirection === "asc"
        ? comparison
        : -comparison;
}

export function getAriaSort<
    SortKey extends string,
>(
    column: SortKey,
    sortKey: SortKey,
    sortDirection: SortDirection,
): AriaSortValue {
    if (column !== sortKey) {
        return "none";
    }

    return sortDirection === "asc"
        ? "ascending"
        : "descending";
}

export function getSortIcon<
    SortKey extends string,
>(
    column: SortKey,
    sortKey: SortKey,
    sortDirection: SortDirection,
): string {
    if (column !== sortKey) {
        return "⇅";
    }

    return sortDirection === "asc"
        ? "▲"
        : "▼";
}