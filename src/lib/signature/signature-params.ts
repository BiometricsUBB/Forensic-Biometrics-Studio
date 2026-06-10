import { MarkingClass } from "@/lib/markings/MarkingClass";
import { MarkingType } from "@/lib/markings/MarkingType";
import { MARKING_CLASS } from "@/lib/markings/MARKING_CLASS";
import { PolygonMarking } from "@/lib/markings/PolygonMarking";
import { LineSegmentMarking } from "@/lib/markings/LineSegmentMarking";
import { SIGNATURE_TYPE_NAME } from "./signature-constants";
import { dist, polygonArea, polygonSegments } from "./signature-geometry";

/**
 * Grafotype parameters derived from a single signature outline (+ optional axes).
 * Computed fields are `null` when the required markings are missing.
 */
export type SignatureParams = {
    hasOutline: boolean;
    segmentCount: number; // N - number of outline edges
    area: number | null; // F
    perimeter: number | null; // P
    shapeCoefficient: number | null; // Wk = 100 * F / P^2
    w1: number | null; // length of axis W1
    w2: number | null; // length of axis W2
    sizeProportion: number | null; // Pw = min(W1,W2) / max(W1,W2)
    grafotype: number | null; // G = Wk * Pw
    segments: number[]; // edge lengths l1..lN
};

const typeIdsByName = (types: MarkingType[], name: string): Set<string> =>
    new Set(types.filter(type => type.name === name).map(type => type.id));

/**
 * Computes Grafotype parameters from the markings of a single image.
 * Uses the first outline polygon / W1 / W2 markings found (matched by the
 * stable marking-type `name`, see {@link SIGNATURE_TYPE_NAME}).
 */
export const computeSignatureParams = (
    markings: MarkingClass[],
    types: MarkingType[]
): SignatureParams => {
    const outlineIds = typeIdsByName(types, SIGNATURE_TYPE_NAME.OUTLINE);
    const w1Ids = typeIdsByName(types, SIGNATURE_TYPE_NAME.W1);
    const w2Ids = typeIdsByName(types, SIGNATURE_TYPE_NAME.W2);

    const outline = markings.find(
        (m): m is PolygonMarking =>
            m.markingClass === MARKING_CLASS.POLYGON && outlineIds.has(m.typeId)
    );
    const axisW1 = markings.find(
        (m): m is LineSegmentMarking =>
            m.markingClass === MARKING_CLASS.LINE_SEGMENT && w1Ids.has(m.typeId)
    );
    const axisW2 = markings.find(
        (m): m is LineSegmentMarking =>
            m.markingClass === MARKING_CLASS.LINE_SEGMENT && w2Ids.has(m.typeId)
    );

    const points = outline?.points ?? [];
    const hasOutline = points.length >= 3;
    const segments = hasOutline ? polygonSegments(points) : [];
    const area = hasOutline ? polygonArea(points) : null;
    const perimeter = hasOutline
        ? segments.reduce((acc, len) => acc + len, 0)
        : null;
    const shapeCoefficient =
        area !== null && perimeter !== null && perimeter > 0
            ? (100 * area) / perimeter ** 2
            : null;

    const w1 = axisW1 ? dist(axisW1.origin, axisW1.endpoint) : null;
    const w2 = axisW2 ? dist(axisW2.origin, axisW2.endpoint) : null;
    const sizeProportion =
        w1 !== null && w2 !== null && Math.max(w1, w2) > 0
            ? Math.min(w1, w2) / Math.max(w1, w2)
            : null;
    const grafotype =
        shapeCoefficient !== null && sizeProportion !== null
            ? shapeCoefficient * sizeProportion
            : null;

    return {
        hasOutline,
        segmentCount: segments.length,
        area,
        perimeter,
        shapeCoefficient,
        w1,
        w2,
        sizeProportion,
        grafotype,
        segments,
    };
};
