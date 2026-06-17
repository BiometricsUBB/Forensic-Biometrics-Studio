import { ImageFFT, FFTResult } from "@/lib/fftProcessor";

// ─── Modifier type discriminants ───────────────────────────────────────────

export type ModifierType =
    | "brightness"
    | "contrast"
    | "invert"
    | "desaturate"
    | "fft";

// ─── Per-modifier param shapes ──────────────────────────────────────────────

export interface BrightnessParams {
    value: number; // 0-100, default 50; 100 = white
}

export interface ContrastParams {
    value: number; // 0-100, default 50; 0 = grey, 50 = unchanged
}

export interface InvertParams {
    value: number; // 0-100, default 100
}

export interface DesaturateParams {
    reds: number; // 0-200 color range weight
    yellows: number;
    greens: number;
    cyans: number;
    blues: number;
    magentas: number;
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

// ─── Discriminated union ─────────────────────────────────────────────────────

export type ModifierParams =
    | BrightnessParams
    | ContrastParams
    | InvertParams
    | DesaturateParams
    | FftParams;

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
export type InvertModifier = Modifier<InvertParams> & { type: "invert" };
export type DesaturateModifier = Modifier<DesaturateParams> & {
    type: "desaturate";
};
export type FftModifier = Modifier<FftParams> & { type: "fft" };

export type AnyModifier =
    | BrightnessModifier
    | ContrastModifier
    | InvertModifier
    | DesaturateModifier
    | FftModifier;
