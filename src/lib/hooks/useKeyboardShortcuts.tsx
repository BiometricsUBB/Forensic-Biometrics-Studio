import { useEffect } from "react";
import { KeybindingsStore } from "@/lib/stores/Keybindings";
import { useWorkingModeStore } from "@/lib/stores/WorkingMode";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import {
    CURSOR_MODES,
    DashboardToolbarStore,
} from "../stores/DashboardToolbar";
import { CUSTOM_GLOBAL_EVENTS } from "../utils/const";
import { useKeyDown } from "./useKeyDown";
import { GlobalHistoryManager } from "../stores/History/HistoryManager";
import { serializeCombo } from "../utils/keybinding";

export const useKeyboardShortcuts = () => {
    const { actions } = DashboardToolbarStore;
    const { cursor: cursorActions, viewport: viewportActions } =
        actions.settings;

    const workingMode = useWorkingModeStore(state => state.workingMode);
    const keybindings = KeybindingsStore.use(state => state.typesKeybindings);

    const { setCursorMode } = cursorActions;
    const { toggleLockedViewport, toggleLockScaleSync } = viewportActions;

    useKeyDown(() => {
        document.dispatchEvent(
            new Event(CUSTOM_GLOBAL_EVENTS.INTERRUPT_MARKING)
        );
    }, ["Escape"]);

    useKeyDown(() => {
        setCursorMode(CURSOR_MODES.SELECTION);
    }, ["F1"]);

    useKeyDown(() => {
        setCursorMode(CURSOR_MODES.MARKING);
    }, ["F2"]);

    useKeyDown(() => {
        toggleLockedViewport();
    }, ["l"]);

    useKeyDown(() => {
        toggleLockScaleSync();
    }, ["m"]);

    useKeyDown(() => {
        GlobalHistoryManager.undo();
    }, ["Control", "z"]);

    useKeyDown(() => {
        GlobalHistoryManager.undo();
    }, ["Meta", "z"]);

    useKeyDown(() => {
        GlobalHistoryManager.redo();
    }, ["Control", "y"]);

    useKeyDown(() => {
        GlobalHistoryManager.redo();
    }, ["Meta", "Shift", "z"]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (document.querySelector("input:focus, textarea:focus")) return;
            if (!workingMode) return;

            const combo = serializeCombo(event);
            const binding = keybindings.find(
                k => k.boundKey === combo && k.workingMode === workingMode
            );

            if (!binding) return;

            const typeExists = MarkingTypesStore.state.types.some(
                type =>
                    type.id === binding.typeId && type.category === workingMode
            );

            if (!typeExists) {
                KeybindingsStore.actions.typesKeybindings.remove(
                    binding.typeId,
                    workingMode
                );
                return;
            }

            event.preventDefault();
            MarkingTypesStore.actions.selectedType.set(binding.typeId);
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [keybindings, workingMode]);
};
