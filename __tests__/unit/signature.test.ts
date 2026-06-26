import { describe, it, expect } from "bun:test";
import { PolygonMarking } from "@/lib/markings/PolygonMarking";
import { LineSegmentMarking } from "@/lib/markings/LineSegmentMarking";
import { MarkingType } from "@/lib/markings/MarkingType";
import { MARKING_CLASS } from "@/lib/markings/MARKING_CLASS";
import { WORKING_MODE } from "@/views/selectMode";
import {
    SIGNATURE_TYPE_NAME,
    getRkr,
} from "@/lib/signature/signature-constants";
import {
    polygonArea,
    polygonPerimeter,
    polygonSegments,
} from "@/lib/signature/signature-geometry";
import { computeSignatureParams } from "@/lib/signature/signature-params";
import {
    compareSignatures,
    computeRanks,
    spearman,
} from "@/lib/signature/signature-comparison";

const makeType = (name: string, markingClass: MARKING_CLASS): MarkingType => ({
    id: `type-${name}`,
    name,
    displayName: name,
    markingClass,
    backgroundColor: "#000000",
    textColor: "#ffffff",
    size: 10,
    category: WORKING_MODE.SIGNATURE,
});

// GRAFOTYP 2.0 reference sample: outline segment lengths for samples A and B.
const SAMPLE_SEGMENTS_A = [
    94, 68, 71, 126, 235, 186, 114, 158, 291, 175, 226, 330, 211, 177,
];
const SAMPLE_SEGMENTS_B = [
    63, 81, 49, 114, 242, 194, 87, 208, 379, 170, 209, 317, 212, 180,
];

describe("signature geometry", () => {
    it("computes area and perimeter of a 100x100 square", () => {
        const square = [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
        ];
        expect(polygonArea(square)).toBeCloseTo(10000, 6);
        expect(polygonPerimeter(square)).toBeCloseTo(400, 6);
        expect(polygonSegments(square)).toHaveLength(4);
    });
});

describe("computeSignatureParams", () => {
    it("derives Wk, Pw and G from outline + axes", () => {
        const outlineType = makeType(
            SIGNATURE_TYPE_NAME.OUTLINE,
            MARKING_CLASS.POLYGON
        );
        const w1Type = makeType(
            SIGNATURE_TYPE_NAME.W1,
            MARKING_CLASS.LINE_SEGMENT
        );
        const w2Type = makeType(
            SIGNATURE_TYPE_NAME.W2,
            MARKING_CLASS.LINE_SEGMENT
        );

        const outline = new PolygonMarking(1, { x: 0, y: 0 }, outlineType.id, [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
        ]);
        const w1 = new LineSegmentMarking(2, { x: 0, y: 0 }, w1Type.id, {
            x: 100,
            y: 0,
        });
        const w2 = new LineSegmentMarking(3, { x: 0, y: 0 }, w2Type.id, {
            x: 0,
            y: 80,
        });

        const params = computeSignatureParams(
            [outline, w1, w2],
            [outlineType, w1Type, w2Type]
        );

        expect(params.hasOutline).toBe(true);
        expect(params.segmentCount).toBe(4);
        expect(params.area).toBeCloseTo(10000, 6);
        expect(params.perimeter).toBeCloseTo(400, 6);
        // Wk = 100 * F / P^2 = 100 * 10000 / 160000 = 6.25
        expect(params.shapeCoefficient).toBeCloseTo(6.25, 6);
        expect(params.w1).toBeCloseTo(100, 6);
        expect(params.w2).toBeCloseTo(80, 6);
        // Pw = min/max = 0.8 ; G = Wk * Pw = 5.0
        expect(params.sizeProportion).toBeCloseTo(0.8, 6);
        expect(params.grafotype).toBeCloseTo(5, 6);
    });

    it("reports missing data without throwing", () => {
        const params = computeSignatureParams([], []);
        expect(params.hasOutline).toBe(false);
        expect(params.shapeCoefficient).toBeNull();
        expect(params.sizeProportion).toBeNull();
        expect(params.grafotype).toBeNull();
    });
});

describe("Spearman rank correlation (GRAFOTYP 2.0 sample, N=14)", () => {
    const segmentsA = SAMPLE_SEGMENTS_A;
    const segmentsB = SAMPLE_SEGMENTS_B;

    it("ranks descending (largest = 1) matching the reference", () => {
        expect(computeRanks(segmentsA)).toEqual([
            12, 14, 13, 10, 3, 6, 11, 9, 2, 8, 4, 1, 5, 7,
        ]);
        expect(computeRanks(segmentsB)).toEqual([
            13, 12, 14, 10, 3, 7, 11, 6, 1, 9, 5, 2, 4, 8,
        ]);
    });

    it("computes R = 0.952 and finds it significant", () => {
        const result = spearman(segmentsA, segmentsB);
        expect(result).not.toBeNull();
        expect(result!.r).toBeCloseTo(0.952, 3);
        expect(result!.rkr).toBe(0.456);
        expect(result!.significant).toBe(true);
    });

    it("getRkr returns the tabulated value for N=14", () => {
        expect(getRkr(14)).toBe(0.456);
        expect(getRkr(4)).toBeNull();
    });
});

describe("compareSignatures (GRAFOTYP 2.0 sample)", () => {
    const a = {
        hasOutline: true,
        segmentCount: 14,
        area: 151080,
        perimeter: 2462,
        shapeCoefficient: 2.49,
        w1: 774,
        w2: 717,
        sizeProportion: 0.93,
        grafotype: 2.32,
        segments: SAMPLE_SEGMENTS_A,
    };
    const b = {
        ...a,
        shapeCoefficient: 2.35,
        grafotype: 2,
        segments: SAMPLE_SEGMENTS_B,
    };

    it("computes shape and grafotype agreement percentages", () => {
        const comparison = compareSignatures(a, b);
        expect(comparison.shapeAgreement).toBeCloseTo(94.38, 1);
        expect(comparison.grafotypeAgreement).toBeCloseTo(86.21, 1);
    });

    it("runs the spearman branch when segment counts match", () => {
        const comparison = compareSignatures(a, b);
        expect(comparison.sameSegmentCount).toBe(true);
        expect(comparison.spearman).not.toBeNull();
        expect(comparison.spearman!.r).toBeCloseTo(0.952, 3);
        expect(comparison.spearman!.significant).toBe(true);
    });

    it("skips correlation when segment counts differ", () => {
        const comparison = compareSignatures(a, {
            ...b,
            segmentCount: 10,
            segments: SAMPLE_SEGMENTS_B.slice(0, 10),
        });
        expect(comparison.sameSegmentCount).toBe(false);
        expect(comparison.spearman).toBeNull();
        // agreements are still computed regardless of segment alignment
        expect(comparison.shapeAgreement).toBeCloseTo(94.38, 1);
    });
});

describe("Spearman with ties (Pearson over ranks)", () => {
    it("stays in [-1, 1] and yields -1 for reversed tied rank vectors", () => {
        // ranksA = [4, 2.5, 2.5, 1], ranksB = [1, 2.5, 2.5, 4].
        // The 1 - 6*Sum(d^2)/(n(n^2-1)) shortcut would give a biased -0.8;
        // Pearson over the rank vectors gives the correct -1.
        const result = spearman([1, 2, 2, 3], [3, 2, 2, 1]);
        expect(result).not.toBeNull();
        expect(result!.r).toBeCloseTo(-1, 6);
        expect(result!.r).toBeGreaterThanOrEqual(-1);
        expect(result!.r).toBeLessThanOrEqual(1);
    });

    it("yields 1 for identical tied rank vectors", () => {
        const result = spearman([10, 10, 20, 30], [5, 5, 15, 25]);
        expect(result).not.toBeNull();
        expect(result!.r).toBeCloseTo(1, 6);
    });
});
