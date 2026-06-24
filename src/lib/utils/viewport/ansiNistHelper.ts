import { RayMarking } from "@/lib/markings/RayMarking";
import { Point } from "@/lib/markings/Point";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { resolveSourceafisTypeId } from "./autoMarkWithSourceafis";

export function createMinutiaMarking(
    index: number,
    x: number,
    y: number,
    angleDeg: number,
    typeText: string | undefined
): RayMarking | null {
    const angleRad = (angleDeg - 90) * (Math.PI / 180);

    let typeStr = "ending";
    if (typeText && (typeText === "1" || typeText.includes("BIF"))) {
        typeStr = "bifurcation";
    }

    const typeId =
        resolveSourceafisTypeId(typeStr) ||
        MarkingTypesStore.state.types[0]?.id;

    if (!typeId) {
        return null;
    }

    return new RayMarking(index, { x, y } as Point, typeId, angleRad, []);
}
