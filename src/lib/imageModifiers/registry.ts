import {
    AnyModifier,
    BrightnessModifier,
    ContrastModifier,
    FftModifier,
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
        params: { value: 100 },
    };
}

export function createContrastModifier(): ContrastModifier {
    return {
        id: newId(),
        type: "contrast",
        label: "Contrast",
        enabled: true,
        params: { value: 100 },
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
export function buildCssFilter(modifiers: AnyModifier[]): string {
    const parts: string[] = [];
    modifiers.forEach(mod => {
        if (mod.enabled) {
            if (mod.type === "brightness") {
                parts.push(`brightness(${mod.params.value / 100})`);
            } else if (mod.type === "contrast") {
                parts.push(`contrast(${mod.params.value / 100})`);
            }
            // FFT is canvas-based – not included here
        }
    });
    return parts.length > 0 ? parts.join(" ") : "none";
}

/**
 * Returns true if ANY enabled modifier in the list requires canvas processing.
 */
export function hasCanvasModifiers(modifiers: AnyModifier[]): boolean {
    return modifiers.some(m => m.enabled && m.type === "fft");
}
