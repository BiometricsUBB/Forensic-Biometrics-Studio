import { RayMarking } from "@/lib/markings/RayMarking";
import { Point } from "@/lib/markings/Point";
import {
    TYPE_ID_BIFURCATION,
    TYPE_ID_RIDGE_ENDING,
} from "./autoMarkWithSourceafis";

export type SourceAfisJson = {
    width: number;
    height: number;
    dpi: number;
    minutiae: Array<{
        x: number;
        y: number;
        direction: number; // radians
        type: "ending" | "bifurcation";
    }>;
};

export function convertSourceafisToRayMarkings(
    source: SourceAfisJson,
    getNextLabel: () => number
): RayMarking[] {
    if (!source?.minutiae || source.minutiae.length === 0) return [];

    return source.minutiae.map(m => {
        const origin: Point = { x: m.x, y: m.y };
        const typeId =
            m.type === "ending" ? TYPE_ID_RIDGE_ENDING : TYPE_ID_BIFURCATION;
        const label = getNextLabel();
        return new RayMarking(label, origin, typeId, m.direction);
    });
}
