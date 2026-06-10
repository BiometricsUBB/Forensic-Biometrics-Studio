/* eslint-disable security/detect-object-injection */
import { getRkr } from "./signature-constants";
import { SignatureParams } from "./signature-params";

/**
 * Ranks values in descending order (largest value gets rank 1, as in
 * GRAFOTYP 2.0), assigning average ranks to ties.
 */
export const computeRanks = (values: number[]): number[] => {
    const indexed = values.map((value, index) => ({ value, index }));
    indexed.sort((x, y) => y.value - x.value);

    const ranks = new Array<number>(values.length).fill(0);
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

/**
 * Spearman rank correlation between two equally long, index-paired sequences.
 * Returns null when the sequences differ in length or are too short (N < 3).
 */
export const spearman = (a: number[], b: number[]): SpearmanResult | null => {
    if (a.length !== b.length || a.length < 3) return null;
    const n = a.length;
    const ranksA = computeRanks(a);
    const ranksB = computeRanks(b);
    const dSquaredSum = ranksA.reduce(
        (acc, rank, i) => acc + (rank - ranksB[i]!) ** 2,
        0
    );
    const r = 1 - (6 * dSquaredSum) / (n * (n * n - 1));
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

/** Compares two sets of signature parameters using the Grafotype metrics. */
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

/**
 * Hard requirement for any verification result: a signature outline polygon
 * (>= 3 vertices) on BOTH images. W1/W2 axes are optional (best-effort).
 */
export const getComparisonReadiness = (
    a: SignatureParams,
    b: SignatureParams
): { ready: boolean; reason?: ReadinessReason } => {
    if (!a.hasOutline || !b.hasOutline) {
        return { ready: false, reason: "missing-outline" };
    }
    return { ready: true };
};
