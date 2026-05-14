import {
    AnyModifier,
    BrightnessModifier,
    ContrastModifier,
    EnhancementParams,
    FftModifier,
    GbfenModifier,
    ModifierType,
    SnfenModifier,
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

function defaultEnhancementParams(): EnhancementParams {
    return {
        dpi: 500,
        status: "pending",
        outputPath: null,
        errorMessage: null,
        durationMs: null,
        runtimeOutputUrl: null,
    };
}

export function createGbfenModifier(): GbfenModifier {
    return {
        id: newId(),
        type: "gbfen",
        label: "GBFEN",
        enabled: true,
        params: defaultEnhancementParams(),
    };
}

export function createSnfenModifier(): SnfenModifier {
    return {
        id: newId(),
        type: "snfen",
        label: "SNFEN",
        enabled: true,
        params: defaultEnhancementParams(),
    };
}

// ─── Registry ────────────────────────────────────────────────────────────────

export interface ModifierDefinition {
    type: ModifierType;
    /** i18n key for the label shown in the "Add" menu */
    labelKey: string;
    /** Optional grouping for the dropdown – "default" appears first, "enhancement" goes under a separator */
    group?: "default" | "enhancement";
    create: () => AnyModifier;
}

export const MODIFIER_REGISTRY: ModifierDefinition[] = [
    {
        type: "brightness",
        labelKey: "Brightness",
        group: "default",
        create: createBrightnessModifier,
    },
    {
        type: "contrast",
        labelKey: "Contrast",
        group: "default",
        create: createContrastModifier,
    },
    {
        type: "fft",
        labelKey: "FFT Filter",
        group: "default",
        create: createFftModifier,
    },
    {
        type: "gbfen",
        labelKey: "GBFEN",
        group: "enhancement",
        create: createGbfenModifier,
    },
    {
        type: "snfen",
        labelKey: "SNFEN",
        group: "enhancement",
        create: createSnfenModifier,
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
            // FFT / GBFEN / SNFEN are pixel-based – not included here
        }
    });
    return parts.length > 0 ? parts.join(" ") : "none";
}
