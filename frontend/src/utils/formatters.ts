const BYTE_UNITS = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
] as const;

export function formatBytes(
    bytes: number,
): string {
    if (
        !Number.isFinite(bytes) ||
        bytes <= 0
    ) {
        return "0 B";
    }

    const unitIndex = Math.min(
        Math.floor(
            Math.log(bytes) /
            Math.log(1024),
        ),
        BYTE_UNITS.length - 1,
    );

    const value =
        bytes /
        1024 ** unitIndex;

    const precision =
        value >= 10 ||
            unitIndex === 0
            ? 0
            : 1;

    return `${value.toFixed(precision)} ${BYTE_UNITS[unitIndex]}`;
}

export function formatDate(
    value: string,
): string {
    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime(),
        )
    ) {
        return "—";
    }

    return date.toLocaleString();
}