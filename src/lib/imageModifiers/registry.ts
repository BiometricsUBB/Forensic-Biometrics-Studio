import {
    AnyModifier,
    BrightnessModifier,
    ContrastModifier,
    DesaturateModifier,
    EnhancementParams,
    FftModifier,
    InvertModifier,
    LevelsModifier,
    CurvesModifier,
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
            brushSize: 7,
            brushShape: "circle",
            spectrumOpacity: 75,
            _maskCanvas: null,
            _fftResult: null,
            _processor: null,
            runtimeOutputUrl: null,
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
        type: "invert",
        labelKey: "Invert colors",
        group: "default",
        create: createInvertModifier,
    },
    {
        type: "desaturate",
        labelKey: "Desaturate",
        group: "default",
        create: createDesaturateModifier,
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
    {
        type: "levels",
        labelKey: "Levels",
        group: "default",
        create: createLevelsModifier,
    },
    {
        type: "curves",
        labelKey: "Curves",
        group: "default",
        create: createCurvesModifier,
    },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Builds a CSS filter string from all lightweight (non-canvas) modifiers.
 * Only enabled modifiers are included.
 */
export function buildCssFilter(): string {
    // The canvas pipeline provides a pixel-accurate preview for all adjustments.
    return "none";
}

/** Returns true when a live canvas preview needs to be rendered. */
export function hasCanvasModifiers(modifiers: AnyModifier[]): boolean {
    return modifiers.some(
        modifier =>
            modifier.enabled &&
            (modifier.type === "brightness" ||
                modifier.type === "contrast" ||
                modifier.type === "invert" ||
                modifier.type === "desaturate" ||
                modifier.type === "levels" ||
                modifier.type === "curves")
    );
}
