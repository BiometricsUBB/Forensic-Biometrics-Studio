/**
 * Constants for the signature (Grafotype) working mode.
 *
 * The `name` fields below MUST match the `name` of the marking types shipped in
 * `presets/*-signature-default.json`. They are stable identifiers used to locate
 * the outline polygon and the W1/W2 axes regardless of the UI language.
 */
export const SIGNATURE_TYPE_NAME = {
    OUTLINE: "SignatureOutline",
    W1: "AxisW1",
    W2: "AxisW2",
} as const;

/**
 * Critical values of the Spearman rank correlation coefficient,
 * one-tailed test, alpha = 0.05, keyed by N (number of paired observations).
 * Matches standard statistical tables (e.g. N=14 -> 0.456, as in GRAFOTYP 2.0).
 */
export const SPEARMAN_CRITICAL_005 = new Map<number, number>([
    [5, 0.9],
    [6, 0.829],
    [7, 0.714],
    [8, 0.643],
    [9, 0.6],
    [10, 0.564],
    [11, 0.523],
    [12, 0.497],
    [13, 0.475],
    [14, 0.456],
    [15, 0.441],
    [16, 0.425],
    [17, 0.412],
    [18, 0.399],
    [19, 0.388],
    [20, 0.377],
    [21, 0.368],
    [22, 0.359],
    [23, 0.351],
    [24, 0.343],
    [25, 0.336],
    [26, 0.329],
    [27, 0.323],
    [28, 0.317],
    [29, 0.311],
    [30, 0.305],
]);

// One-tailed standard-normal critical value at alpha = 0.05, used as the
// t-distribution approximation for sample sizes beyond the tabulated range.
const T_CRIT_005_LARGE = 1.645;

/**
 * Returns the critical Spearman value for a given N (one-tailed, alpha = 0.05),
 * or null when the correlation cannot be assessed (N < 5).
 */
export const getRkr = (n: number): number | null => {
    if (n < 5) return null;
    const tabled = SPEARMAN_CRITICAL_005.get(n);
    if (tabled !== undefined) return tabled;
    // Approximation for N > 30 via the t-distribution.
    return T_CRIT_005_LARGE / Math.sqrt(n - 2 + T_CRIT_005_LARGE ** 2);
};
