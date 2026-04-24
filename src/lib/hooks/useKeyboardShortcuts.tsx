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
import { APP_SHORTCUTS, serializeCombo } from "../utils/keybinding";

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
    }, APP_SHORTCUTS.INTERRUPT_MARKING);

    useKeyDown(() => {
        setCursorMode(CURSOR_MODES.SELECTION);
    }, APP_SHORTCUTS.SELECTION_MODE);

    useKeyDown(() => {
        setCursorMode(CURSOR_MODES.MARKING);
    }, APP_SHORTCUTS.MARKING_MODE);

    useKeyDown(() => {
        toggleLockedViewport();
    }, APP_SHORTCUTS.LOCK_VIEWPORT);

    useKeyDown(() => {
        toggleLockScaleSync();
    }, APP_SHORTCUTS.LOCK_SCALE_SYNC);

    useKeyDown(() => {
        GlobalHistoryManager.undo();
    }, APP_SHORTCUTS.UNDO_WIN);

    useKeyDown(() => {
        GlobalHistoryManager.undo();
    }, APP_SHORTCUTS.UNDO_MAC);

    useKeyDown(() => {
        GlobalHistoryManager.redo();
    }, APP_SHORTCUTS.REDO_WIN);

    useKeyDown(() => {
        GlobalHistoryManager.redo();
    }, APP_SHORTCUTS.REDO_MAC);

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
