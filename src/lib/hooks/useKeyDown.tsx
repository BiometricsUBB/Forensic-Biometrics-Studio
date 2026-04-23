import { useEffect, useRef } from "react";
import { isModifierKey } from "../utils/keybinding";

export const useKeyDown = (
    callback: (event: KeyboardEvent) => void,
    keys: readonly string[]
) => {
    const callbackRef = useRef(callback);
    useEffect(() => {
        callbackRef.current = callback;
    });

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (document.querySelector("input:focus, textarea:focus")) return;

            const mainKeys = keys.filter(k => !isModifierKey(k));
            if (!mainKeys.every(k => event.key === k)) return;
            if (keys.includes("Control") && !event.ctrlKey) return;
            if (keys.includes("Shift") && !event.shiftKey) return;
            if (keys.includes("Alt") && !event.altKey) return;
            if (keys.includes("Meta") && !event.metaKey) return;

            event.preventDefault();
            callbackRef.current(event);
        };

        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [keys]);
};
