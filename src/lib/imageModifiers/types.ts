import { ImageFFT, FFTResult } from "@/lib/fftProcessor";

// ─── Modifier type discriminants ───────────────────────────────────────────

export type ModifierType = "brightness" | "contrast" | "fft";

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
    /** Serialised mask – a base64-encoded PNG data URL, or null if untouched */
    maskDataUrl: string | null;
    /** Runtime-only: in-memory mask canvas (not persisted across re-renders) */
    _maskCanvas?: HTMLCanvasElement | null;
    /** Runtime-only: cached FFT result so we don't recompute on every render */
    _fftResult?: FFTResult | null;
    /** Runtime-only: cached processor */
    _processor?: ImageFFT | null;
}

// ─── Discriminated union ─────────────────────────────────────────────────────

export type ModifierParams = BrightnessParams | ContrastParams | FftParams;

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

export type AnyModifier = BrightnessModifier | ContrastModifier | FftModifier;

// ─── Pipeline render result ──────────────────────────────────────────────────

/** What the pipeline hands back to EditWindow for display */
export interface PipelineResult {
    /** URL of the image after all canvas-based modifiers */
    processedUrl: string | null;
    /** CSS filter string built from lightweight (non-canvas) modifiers */
    cssFilter: string;
}
