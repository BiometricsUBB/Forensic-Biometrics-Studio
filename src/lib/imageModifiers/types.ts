import { ImageFFT, FFTResult } from "@/lib/fftProcessor";

// ─── Modifier type discriminants ───────────────────────────────────────────

export type ModifierType = "brightness" | "contrast" | "fft" | "levels" | "curves";

// ─── Per-modifier param shapes ──────────────────────────────────────────────

export interface BrightnessParams {
    value: number; // 0-200, default 100
}

export interface ContrastParams {
    value: number; // 0-200, default 100
}

export interface FftParams {
    brushSize: number;
    spectrumOpacity: number;
    /** Runtime-only: in-memory mask canvas (not persisted across re-renders) */
    _maskCanvas?: HTMLCanvasElement | null;
    /** Runtime-only: cached FFT result so we don't recompute on every render */
    _fftResult?: FFTResult | null;
    /** Runtime-only: cached processor */
    _processor?: ImageFFT | null;
}

export interface LevelParam {
    black: number;
    white: number;
    gamma: number;
}

export interface LevelsParams {
    master: LevelParam;
    r: LevelParam;
    g: LevelParam;
    b: LevelParam;
}

export interface CurvePoint {
    x: number;
    y: number;
}

export interface CurvesParams {
    master: CurvePoint[];
    r: CurvePoint[];
    g: CurvePoint[];
    b: CurvePoint[];
}

// ─── Discriminated union ─────────────────────────────────────────────────────

export type ModifierParams = BrightnessParams | ContrastParams | FftParams | LevelsParams | CurvesParams;

export interface Modifier<P extends ModifierParams = ModifierParams> {
    /** Stable unique identifier */
    id: string;
    type: ModifierType;
    /** Human-readable label (may be i18n key) */
    label: string;
    enabled: boolean;
    params: P;
}

export type BrightnessModifier = Modifier<BrightnessParams> & {
    type: "brightness";
};
export type ContrastModifier = Modifier<ContrastParams> & {
    type: "contrast";
};
export type FftModifier = Modifier<FftParams> & { type: "fft" };
export type LevelsModifier = Modifier<LevelsParams> & { type: "levels" };
export type CurvesModifier = Modifier<CurvesParams> & { type: "curves" };

export type AnyModifier = BrightnessModifier | ContrastModifier | FftModifier | LevelsModifier | CurvesModifier;
