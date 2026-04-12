const MODIFIER_ORDER = ["Control", "Alt", "Shift", "Meta"] as const;

export const RESERVED_KEYS = new Set([
    "Escape",
    "Tab",
    "F5",
    "F12",
    "F11",
    ...MODIFIER_ORDER,
]);

const MODIFIER_LABELS: Record<string, string> = {
    Control: "Ctrl",
    Alt: "Alt",
    Shift: "⇧",
    Meta: "⌘",
};

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
    return RESERVED_KEYS.has(event.key);
}

export function formatCombo(combo: string): string[] {
    return combo.split("+").map(part => MODIFIER_LABELS[`${part}`] ?? part);
}
