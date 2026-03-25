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

    const handleKeyDown = (key: string) => {
        const typeId = keybindings.find(
            keybinding =>
                keybinding.boundKey === key &&
                keybinding.workingMode === workingMode
        )?.typeId;

        if (typeId && workingMode) {
            const typeExists = MarkingTypesStore.state.types.some(
                type => type.id === typeId && type.category === workingMode
            );

            if (!typeExists) {
                KeybindingsStore.actions.typesKeybindings.remove(
                    typeId,
                    workingMode
                );
                return;
            }

            MarkingTypesStore.actions.selectedType.set(typeId);
        }
    };

    useKeyDown(() => handleKeyDown("0"), ["0"]);
    useKeyDown(() => handleKeyDown("1"), ["1"]);
    useKeyDown(() => handleKeyDown("2"), ["2"]);
    useKeyDown(() => handleKeyDown("3"), ["3"]);
    useKeyDown(() => handleKeyDown("4"), ["4"]);
    useKeyDown(() => handleKeyDown("5"), ["5"]);
    useKeyDown(() => handleKeyDown("6"), ["6"]);
    useKeyDown(() => handleKeyDown("7"), ["7"]);
    useKeyDown(() => handleKeyDown("8"), ["8"]);
    useKeyDown(() => handleKeyDown("9"), ["9"]);

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
};
