import { useState, useEffect } from "react";
import { useDebouncedCallback } from "use-debounce";
import {
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import { invoke } from "@tauri-apps/api/core";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { KeybindingsStore, TypeKeybinding } from "@/lib/stores/Keybindings";
import { MarkingType } from "@/lib/markings/MarkingType";
import { WORKING_MODE } from "@/views/selectMode";
import {
    emitMarkingTypesChange,
    emitKeybindingsChange,
} from "@/lib/hooks/useSettingsSync";

export function useMarkingTypes() {
    const [selectedCategory, setSelectedCategory] = useState<
        WORKING_MODE | undefined
    >(undefined);

    useEffect(() => {
        invoke<WORKING_MODE | null>("get_working_mode").then(mode => {
            if (mode) setSelectedCategory(mode);
        });
    }, []);

    const types = MarkingTypesStore.use(state =>
        selectedCategory
            ? state.types.filter(c => c.category === selectedCategory)
            : state.types
    );

    const setType = useDebouncedCallback(
        (id: string, value: Partial<MarkingType>) => {
            MarkingTypesStore.actions.types.setType(id, value);
            emitMarkingTypesChange();
        },
        10
    );

    const keybindings = KeybindingsStore.use(state =>
        selectedCategory
            ? state.typesKeybindings.filter(
                  k => k.workingMode === selectedCategory
              )
            : state.typesKeybindings
    );

    const allKeybindings = KeybindingsStore.use(
        state => state.typesKeybindings
    );

    useEffect(() => {
        emitKeybindingsChange();
    }, [allKeybindings]);

    const activeKeybindings = types
        .map(item => keybindings.find(k => k.typeId === item.id))
        .filter((k): k is NonNullable<typeof k> => !!k?.boundKey);

    const conflictingKeys = new Set(
        activeKeybindings
            .filter((k, _, arr) =>
                arr.some(
                    other =>
                        other.boundKey === k.boundKey &&
                        other.typeId !== k.typeId
                )
            )
            .map(k => k.boundKey)
    );

    const sensors = useSensors(useSensor(PointerSensor));

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const fromIdx = types.findIndex(t => t.id === active.id);
        const toIdx = types.findIndex(t => t.id === over.id);
        if (fromIdx === -1 || toIdx === -1) return;
        MarkingTypesStore.actions.types.reorder(
            fromIdx,
            toIdx,
            selectedCategory!
        );
        emitMarkingTypesChange();
    }

    function handleRemove(item: MarkingType) {
        MarkingTypesStore.actions.types.removeById(item.id);
        KeybindingsStore.actions.typesKeybindings.remove(
            item.id,
            item.category
        );
        emitMarkingTypesChange();
    }

    return {
        selectedCategory,
        setSelectedCategory,
        types,
        setType,
        keybindings: keybindings as TypeKeybinding[],
        conflictingKeys,
        sensors,
        handleDragEnd,
        handleRemove,
    };
}
