const MODIFIER_ORDER = ["Control", "Alt", "Shift", "Meta"] as const;
const MODIFIER_KEYS = new Set<string>(MODIFIER_ORDER);

export function isModifierKey(key: string): boolean {
    return MODIFIER_KEYS.has(key);
}

export const APP_SHORTCUTS = {
    INTERRUPT_MARKING: ["Escape"],
    SELECTION_MODE: ["F1"],
    MARKING_MODE: ["F2"],
    LOCK_VIEWPORT: ["l"],
    LOCK_SCALE_SYNC: ["m"],
    UNDO_WIN: ["Control", "z"],
    UNDO_MAC: ["Meta", "z"],
    REDO_WIN: ["Control", "y"],
    REDO_MAC: ["Meta", "Shift", "z"],
} as const satisfies Record<string, readonly string[]>;

const SYSTEM_RESERVED = ["Tab", "F5", "F11", "F12"] as const;

function toCombo(keys: readonly string[]): string {
    const modifiers = MODIFIER_ORDER.filter(m => keys.includes(m));
    const main = keys.filter(k => !MODIFIER_KEYS.has(k));
    return [
        ...modifiers,
        ...main.map(k => (k.length === 1 ? k.toUpperCase() : k)),
    ].join("+");
}

export const RESERVED_KEYS = new Set([
    ...SYSTEM_RESERVED,
    ...Object.values(APP_SHORTCUTS).map(toCombo),
]);

const MODIFIER_LABELS: Record<string, string> = {
    Control: "Ctrl",
    Alt: "Alt",
    Shift: "Shift",
    Meta: "⌘",
};

const CODE_LABELS = new Map<string, string>([
    ["Equal", "="],
    ["Minus", "-"],
    ["BracketLeft", "["],
    ["BracketRight", "]"],
    ["Backslash", "\\"],
    ["Semicolon", ";"],
    ["Quote", "'"],
    ["Comma", ","],
    ["Period", "."],
    ["Slash", "/"],
    ["Backquote", "`"],
    ["Space", "Space"],
    ["Numpad0", "Num 0"],
    ["Numpad1", "Num 1"],
    ["Numpad2", "Num 2"],
    ["Numpad3", "Num 3"],
    ["Numpad4", "Num 4"],
    ["Numpad5", "Num 5"],
    ["Numpad6", "Num 6"],
    ["Numpad7", "Num 7"],
    ["Numpad8", "Num 8"],
    ["Numpad9", "Num 9"],
    ["NumpadAdd", "+"],
    ["NumpadSubtract", "-"],
    ["NumpadMultiply", "*"],
    ["NumpadDivide", "/"],
    ["NumpadDecimal", "."],
    ["NumpadEnter", "Enter"],
    ["ArrowUp", "↑"],
    ["ArrowDown", "↓"],
    ["ArrowLeft", "←"],
    ["ArrowRight", "→"],
]);

function codeToKey(code: string): string {
    if (code.startsWith("Key")) return code.slice(3).toUpperCase();
    if (code.startsWith("Digit")) return code.slice(5);

    return code; // F1, Space, ArrowUp, BracketLeft, etc.
}

export function serializeCombo(event: KeyboardEvent): string {
    const modifiers = MODIFIER_ORDER.filter(mod => {
        if (mod === "Control") return event.ctrlKey;
        if (mod === "Alt") return event.altKey;
        if (mod === "Shift") return event.shiftKey;
        if (mod === "Meta") return event.metaKey;
        return false;
    });

    return [...modifiers, codeToKey(event.code)].join("+");
}

export function isModifierOnly(event: KeyboardEvent): boolean {
    return MODIFIER_ORDER.includes(
        event.key as (typeof MODIFIER_ORDER)[number]
    );
}

export function isReserved(event: KeyboardEvent): boolean {
    return RESERVED_KEYS.has(serializeCombo(event));
}

export function formatCombo(
    combo: string,
    layoutMap?: Map<string, string> | null
): string[] {
    return combo.split("+").map(part => {
        const modifier = MODIFIER_LABELS[`${part}`];
        if (modifier) return modifier;

        const fromLayout = layoutMap?.get(part)?.trim();
        if (fromLayout) {
            return fromLayout.length === 1
                ? fromLayout.toUpperCase()
                : fromLayout;
        }

        return CODE_LABELS.get(part) ?? part;
    });
}
