import {
    AnyModifier,
    BrightnessModifier,
    ContrastModifier,
    DesaturateModifier,
    FftModifier,
    InvertModifier,
    ModifierType,
} from "./types";

// We use crypto.randomUUID where available, otherwise a simple timestamp id
function newId(): string {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ─── Factory functions ───────────────────────────────────────────────────────

export function createBrightnessModifier(): BrightnessModifier {
    return {
        id: newId(),
        type: "brightness",
        label: "Brightness",
        enabled: true,
        params: { value: 50 },
    };
}

export function createContrastModifier(): ContrastModifier {
    return {
        id: newId(),
        type: "contrast",
        label: "Contrast",
        enabled: true,
        params: { value: 50 },
    };
}

export function createInvertModifier(): InvertModifier {
    return {
        id: newId(),
        type: "invert",
        label: "Invert",
        enabled: true,
        params: { value: 100 },
    };
}

export function createDesaturateModifier(): DesaturateModifier {
    return {
        id: newId(),
        type: "desaturate",
        label: "Desaturate",
        enabled: true,
        params: {
            reds: 40,
            yellows: 60,
            greens: 40,
            cyans: 60,
            blues: 20,
            magentas: 80,
        },
    };
}

export function createFftModifier(): FftModifier {
    return {
        id: newId(),
        type: "fft",
        label: "FFT Filter",
        enabled: true,
        params: {
            brushSize: 30,
            spectrumOpacity: 75,
            maskDataUrl: null,
            _maskCanvas: null,
            _fftResult: null,
            _processor: null,
        },
    };
}

// ─── Registry ────────────────────────────────────────────────────────────────

export interface ModifierDefinition {
    type: ModifierType;
    /** i18n key for the label shown in the "Add" menu */
    labelKey: string;
    create: () => AnyModifier;
}

export const MODIFIER_REGISTRY: ModifierDefinition[] = [
    {
        type: "brightness",
        labelKey: "Brightness",
        create: createBrightnessModifier,
    },
    {
        type: "contrast",
        labelKey: "Contrast",
        create: createContrastModifier,
    },
    {
        type: "invert",
        labelKey: "Invert colors",
        create: createInvertModifier,
    },
    {
        type: "desaturate",
        labelKey: "Desaturate",
        create: createDesaturateModifier,
    },
    {
        type: "fft",
        labelKey: "FFT Filter",
        create: createFftModifier,
    },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Builds a CSS filter string from all lightweight (non-canvas) modifiers.
 * Only enabled modifiers are included.
 */
export function buildCssFilter(): string {
    // Pixel-accurate preview is rendered by the canvas pipeline. Keep this
    // helper for older callers, but do not approximate Photoshop-like sliders
    // with CSS filters because their endpoints behave differently.
    return "none";
}

/**
 * Returns true if any enabled modifier requires canvas processing.
 */
export function hasCanvasModifiers(modifiers: AnyModifier[]): boolean {
    return modifiers.some(
        m =>
            m.enabled &&
            (m.type === "fft" ||
                m.type === "brightness" ||
                m.type === "contrast" ||
                m.type === "invert" ||
                m.type === "desaturate")
    );
}
