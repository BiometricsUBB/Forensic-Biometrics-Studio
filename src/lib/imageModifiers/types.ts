import { ImageFFT, FFTResult } from "@/lib/fftProcessor";

// ─── Modifier type discriminants ───────────────────────────────────────────

export type ModifierType =
    | "brightness"
    | "contrast"
    | "fft"
    | "gbfen"
    | "snfen";

export type EnhancementMethod = "gbfen" | "snfen";

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

export type EnhancementStatus = "pending" | "processing" | "ready" | "failed";

export interface EnhancementParams {
    /** DPI passed to pyfing (default 500) */
    dpi: number;
    /** Lifecycle status of the external enhancement run */
    status: EnhancementStatus;
    /** Absolute path of the enhanced PNG written by pyfing (set when ready) */
    outputPath: string | null;
    /** Last error message returned by the pyfing run (set when failed) */
    errorMessage: string | null;
    /** Total pyfing duration in milliseconds */
    durationMs: number | null;
    /** Runtime-only: blob URL of the enhanced image (not persisted) */
    runtimeOutputUrl?: string | null;
}

// ─── Discriminated union ─────────────────────────────────────────────────────

export type ModifierParams =
    | BrightnessParams
    | ContrastParams
    | FftParams
    | EnhancementParams;

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
export type GbfenModifier = Modifier<EnhancementParams> & { type: "gbfen" };
export type SnfenModifier = Modifier<EnhancementParams> & { type: "snfen" };

export type AnyModifier =
    | BrightnessModifier
    | ContrastModifier
    | FftModifier
    | GbfenModifier
    | SnfenModifier;

export type EnhancementModifier = GbfenModifier | SnfenModifier;

export function isEnhancementModifier(
    m: AnyModifier
): m is EnhancementModifier {
    return m.type === "gbfen" || m.type === "snfen";
}

export function getEnhancementMethod(
    m: EnhancementModifier
): EnhancementMethod {
    return m.type;
}
