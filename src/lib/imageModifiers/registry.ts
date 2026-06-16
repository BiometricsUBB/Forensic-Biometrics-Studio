import {
    AnyModifier,
    BrightnessModifier,
    ContrastModifier,
    FftModifier,
    LevelsModifier,
    CurvesModifier,
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
            _maskCanvas: null,
            _fftResult: null,
            _processor: null,
        },
    };
}

export function createLevelsModifier(): LevelsModifier {
    const defaultParam = { black: 0, white: 255, gamma: 1.0 };
    return {
        id: newId(),
        type: "levels",
        label: "Levels",
        enabled: true,
        params: {
            master: { ...defaultParam },
            r: { ...defaultParam },
            g: { ...defaultParam },
            b: { ...defaultParam },
        },
    };
}

export function createCurvesModifier(): CurvesModifier {
    const defaultPoints = [
        { x: 0, y: 0 },
        { x: 255, y: 255 },
    ];
    return {
        id: newId(),
        type: "curves",
        label: "Curves",
        enabled: true,
        params: {
            master: [...defaultPoints],
            r: [...defaultPoints],
            g: [...defaultPoints],
            b: [...defaultPoints],
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
    {
        type: "levels",
        labelKey: "Levels",
        create: createLevelsModifier,
    },
    {
        type: "curves",
        labelKey: "Curves",
        create: createCurvesModifier,
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
