import { RayMarking } from "@/lib/markings/RayMarking";
import { Point } from "@/lib/markings/Point";

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

const TYPE_ID_RIDGE_ENDING = "e6cbde52-5a18-4236-8287-7a1daf941ba9";
const TYPE_ID_BIFURCATION = "f47c4b97-2d62-4959-aa21-edebfa7a756a";

export function convertSourceafisToRayMarkings(
    source: SourceAfisJson,
    getNextLabel: () => number
): RayMarking[] {
    if (!source?.minutiae || source.minutiae.length === 0) return [];

    return source.minutiae.map(m => {
        const origin: Point = { x: m.x, y: m.y };
        const typeId =
            m.type === "ending"
                ? TYPE_ID_RIDGE_ENDING
                : TYPE_ID_BIFURCATION;
        const label = getNextLabel();
        return new RayMarking(label, origin, typeId, m.direction);
    });
}
