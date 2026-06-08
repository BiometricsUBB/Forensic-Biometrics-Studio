export type DistanceUnit = "px" | "mm" | "cm" | "in";

export const DISTANCE_UNITS: DistanceUnit[] = ["px", "mm", "cm", "in"];

const PX_PER_INCH = 96;
const PX_PER_CM = PX_PER_INCH / 2.54;
const PX_PER_MM = PX_PER_CM / 10;

export function convertPx(px: number, unit: DistanceUnit): string {
    switch (unit) {
        case "mm":
            return (px / PX_PER_MM).toFixed(2);
        case "cm":
            return (px / PX_PER_CM).toFixed(2);
        case "in":
            return (px / PX_PER_INCH).toFixed(3);
        default:
            return px.toFixed(2);
    }
}

export function calcPolygonArea(points: { x: number; y: number }[]): number {
    if (points.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        area += points[i]!.x * points[j]!.y;
        area -= points[j]!.x * points[i]!.y;
    }
    return Math.abs(area) / 2;
}

export function convertPxArea(px2: number, unit: DistanceUnit): string {
    switch (unit) {
        case "mm":
            return (px2 / PX_PER_MM ** 2).toFixed(2);
        case "cm":
            return (px2 / PX_PER_CM ** 2).toFixed(2);
        case "in":
            return (px2 / PX_PER_INCH ** 2).toFixed(4);
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
