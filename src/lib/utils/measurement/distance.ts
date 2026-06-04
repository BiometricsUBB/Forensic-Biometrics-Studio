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
