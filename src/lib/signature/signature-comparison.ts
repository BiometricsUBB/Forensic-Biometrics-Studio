/* eslint-disable security/detect-object-injection */
import { getRkr } from "./signature-constants";
import { SignatureParams } from "./signature-params";

// Descending ranks (largest value = rank 1, as in GRAFOTYP 2.0); ties averaged.
export const computeRanks = (values: number[]): number[] => {
    const indexed = values.map((value, index) => ({ value, index }));
    indexed.sort((x, y) => y.value - x.value);

    const ranks: number[] = Array.from({ length: values.length }, () => 0);
    let i = 0;
    while (i < indexed.length) {
        let j = i;
        while (
            j + 1 < indexed.length &&
            indexed[j + 1]!.value === indexed[i]!.value
        ) {
            j += 1;
        }
        const averageRank = (i + j) / 2 + 1; // ranks are 1-based
        for (let k = i; k <= j; k += 1) {
            ranks[indexed[k]!.index] = averageRank;
        }
        i = j + 1;
    }
    return ranks;
};

export type SpearmanResult = {
    n: number;
    r: number; // computed coefficient
    rkr: number | null; // critical value (one-tailed, alpha = 0.05)
    significant: boolean; // r > rkr
    ranksA: number[];
    ranksB: number[];
};

// Null when either vector has zero variance (correlation undefined).
const pearson = (x: number[], y: number[]): number | null => {
    const n = x.length;
    const meanX = x.reduce((acc, v) => acc + v, 0) / n;
    const meanY = y.reduce((acc, v) => acc + v, 0) / n;
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    for (let i = 0; i < n; i += 1) {
        const dx = x[i]! - meanX;
        const dy = y[i]! - meanY;
        sxy += dx * dy;
        sxx += dx * dx;
        syy += dy * dy;
    }
    const denom = Math.sqrt(sxx * syy);
    return denom === 0 ? null : sxy / denom;
};

// Spearman rho computed as Pearson over the rank vectors: exact with ties
// (the 1 - 6*Sum(d^2)/(n(n^2-1)) shortcut is only valid without ties).
export const spearman = (a: number[], b: number[]): SpearmanResult | null => {
    if (a.length !== b.length || a.length < 3) return null;
    const n = a.length;
    const ranksA = computeRanks(a);
    const ranksB = computeRanks(b);
    const r = pearson(ranksA, ranksB);
    if (r === null) return null;
    const rkr = getRkr(n);
    return {
        n,
        r,
        rkr,
        significant: rkr !== null && r > rkr,
        ranksA,
        ranksB,
    };
};

const agreementPercent = (
    a: number | null,
    b: number | null
): number | null => {
    if (a === null || b === null) return null;
    const max = Math.max(Math.abs(a), Math.abs(b));
    if (max === 0) return null;
    return (Math.min(Math.abs(a), Math.abs(b)) / max) * 100;
};

export type SignatureComparison = {
    shapeAgreement: number | null; // % agreement of Wk
    grafotypeAgreement: number | null; // % agreement of G
    spearman: SpearmanResult | null;
    sameSegmentCount: boolean;
};

/**
 * IMPORTANT - rank correlation alignment: the Spearman correlation pairs the
 * two outlines by edge index (l_i in A vs l_i in B), so it assumes both
 * outlines were traced with the same starting vertex and direction. This is by
 * design of the GRAFOTYP method, where the examiner marks corresponding points
 * in both signatures; the sequences are NOT auto-aligned. Two outlines of the
 * same shape traced from a different vertex or in the opposite direction will
 * therefore yield a low correlation. `sameSegmentCount` only checks the vertex
 * count, not this ordering - it is the examiner's responsibility to trace the
 * outlines consistently.
 */
export const compareSignatures = (
    a: SignatureParams,
    b: SignatureParams
): SignatureComparison => {
    const sameSegmentCount =
        a.segmentCount > 0 && a.segmentCount === b.segmentCount;
    return {
        shapeAgreement: agreementPercent(
            a.shapeCoefficient,
            b.shapeCoefficient
        ),
        grafotypeAgreement: agreementPercent(a.grafotype, b.grafotype),
        spearman: sameSegmentCount ? spearman(a.segments, b.segments) : null,
        sameSegmentCount,
    };
};

export type ReadinessReason = "missing-outline";

// Ready requires an outline polygon (>= 3 vertices) on BOTH images;
// W1/W2 axes are optional (best-effort).
export const getComparisonReadiness = (
    a: SignatureParams,
    b: SignatureParams
): { ready: boolean; reason?: ReadinessReason } => {
    if (!a.hasOutline || !b.hasOutline) {
        return { ready: false, reason: "missing-outline" };
    }
    return { ready: true };
};
