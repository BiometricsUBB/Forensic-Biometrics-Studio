export type DistanceUnit = "px" | "mm" | "cm" | "in";

export const DISTANCE_UNITS: DistanceUnit[] = ["px", "mm", "cm", "in"];

export const DEFAULT_DPI = 500;

export function convertPx(
    px: number,
    unit: DistanceUnit,
    dpi = DEFAULT_DPI
): string {
    switch (unit) {
        case "mm":
            return (px / (dpi / 25.4)).toFixed(2);
        case "cm":
            return (px / (dpi / 2.54)).toFixed(2);
        case "in":
            return (px / dpi).toFixed(3);
        default:
            return px.toFixed(2);
    }
}

export function calcPolygonArea(points: { x: number; y: number }[]): number {
    if (points.length < 3) return 0;
    const area = points.reduce((acc, p, i) => {
        const q = points[(i + 1) % points.length]!;
        return acc + p.x * q.y - q.x * p.y;
    }, 0);
    return Math.abs(area) / 2;
}

export function convertPxArea(
    px2: number,
    unit: DistanceUnit,
    dpi = DEFAULT_DPI
): string {
    switch (unit) {
        case "mm":
            return (px2 / (dpi / 25.4) ** 2).toFixed(2);
        case "cm":
            return (px2 / (dpi / 2.54) ** 2).toFixed(2);
        case "in":
            return (px2 / dpi ** 2).toFixed(4);
        default:
            return px2.toFixed(2);
    }
}

export function calcLinePixels(
    line: {
        origin: { x: number; y: number };
        endpoint: { x: number; y: number };
    } | null
): number | null {
    if (!line) return null;
    const dx = line.endpoint.x - line.origin.x;
    const dy = line.endpoint.y - line.origin.y;
    return Math.sqrt(dx * dx + dy * dy);
}
