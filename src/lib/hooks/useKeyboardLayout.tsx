import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
    ReactNode,
} from "react";
import { formatCombo } from "@/lib/utils/keybinding";

type LayoutMap = Map<string, string>;

interface KeyboardAPI {
    getLayoutMap(): Promise<LayoutMap>;
    addEventListener?(type: "layoutchange", listener: () => void): void;
    removeEventListener?(type: "layoutchange", listener: () => void): void;
}

function getKeyboard(): KeyboardAPI | undefined {
    return (navigator as Navigator & { keyboard?: KeyboardAPI }).keyboard;
}

const KeyboardLayoutContext = createContext<LayoutMap | null>(null);

export function KeyboardLayoutProvider({ children }: { children: ReactNode }) {
    const [layoutMap, setLayoutMap] = useState<LayoutMap | null>(null);

    useEffect(() => {
        const kb = getKeyboard();
        let cleanup: () => void = () => {};

        if (kb?.getLayoutMap) {
            let cancelled = false;
            const load = () => {
                kb.getLayoutMap()
                    .then(map => {
                        if (!cancelled) setLayoutMap(map);
                    })
                    .catch(() => {});
            };

            load();
            kb.addEventListener?.("layoutchange", load);
            cleanup = () => {
                cancelled = true;
                kb.removeEventListener?.("layoutchange", load);
            };
        }

        return cleanup;
    }, []);

    return (
        <KeyboardLayoutContext.Provider value={layoutMap}>
            {children}
        </KeyboardLayoutContext.Provider>
    );
}

export function useKeyboardLayout(): LayoutMap | null {
    return useContext(KeyboardLayoutContext);
}

export function useFormatCombo() {
    const layoutMap = useKeyboardLayout();
    return useCallback(
        (combo: string) => formatCombo(combo, layoutMap),
        [layoutMap]
    );
}
