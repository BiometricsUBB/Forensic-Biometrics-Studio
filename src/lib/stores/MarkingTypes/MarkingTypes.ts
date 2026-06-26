import {
    MarkingType,
    MARKING_ATTRIBUTE_KIND,
} from "@/lib/markings/MarkingType";
import { MarkingsStore } from "@/lib/stores/Markings";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { _useMarkingTypesStore } from "./MarkingTypes.store";

class StoreClass {
    readonly use = _useMarkingTypesStore;

    get state() {
        return this.use.getState();
    }

    readonly actions = {
        selectedType: {
            set: (typeId: MarkingType["id"] | null) => {
                if (
                    typeId &&
                    !this.state.types.some(type => type.id === typeId)
                ) {
                    return;
                }
                this.state.set(draft => {
                    draft.selectedTypeId = typeId;
                });
            },
            get: () =>
                this.state.types.find(
                    type => type.id === this.state.selectedTypeId
                ),
        },
        types: {
            add: (type: MarkingType) => {
                this.state.set(draft => {
                    draft.types.push(type);
                });
            },
            getConflicts: (types: MarkingType[]) => {
                return this.state.types.filter(type =>
                    types.some(existingType => existingType.id === type.id)
                );
            },
            addMany: (types: MarkingType[]) => {
                this.state.set(draft => {
                    // Remove existing types that are in the passed array
                    draft.types = draft.types.filter(
                        type => !types.some(c => c.id === type.id)
                    );

                    // Add the passed types
                    draft.types = draft.types.concat(types);
                });
            },
            checkIfTypeIsInUse: (
                typeId: MarkingType["id"],
                canvasId: CANVAS_ID
            ) =>
                MarkingsStore(canvasId).state.markings.some(
                    marking => marking.typeId === typeId
                ),
            removeById: (typeId: MarkingType["id"]) => {
                this.state.set(draft => {
                    draft.types = draft.types.filter(
                        type => type.id !== typeId
                    );
                });

                this.actions.selectedType.set(null);
            },
            reorder: (fromIdx: number, toIdx: number, category: string) => {
                this.state.set(draft => {
                    const catItems = draft.types.filter(
                        t => t.category === category
                    );

                    if (
                        fromIdx < 0 ||
                        toIdx < 0 ||
                        fromIdx >= catItems.length ||
                        toIdx >= catItems.length
                    )
                        return;

                    const moved = catItems.splice(fromIdx, 1)[0] as MarkingType;
                    catItems.splice(toIdx, 0, moved);

                    let catIdx = 0;
                    for (let i = 0; i < draft.types.length; i += 1) {
                        const current = draft.types[`${i}`];
                        if (current && current.category === category) {
                            draft.types[`${i}`] = catItems[
                                `${catIdx}`
                            ] as MarkingType;
                            catIdx += 1;
                        }
                    }
                });
            },
            setType: (
                typeId: MarkingType["id"],
                newValues: Partial<MarkingType>
            ) => {
                this.state.set(draft => {
                    const type = draft.types.find(c => c.id === typeId);
                    if (type) {
                        Object.assign(type, newValues);
                    }
                });
                if ("attributes" in newValues) {
                    const updatedType = this.state.types.find(
                        type => type.id === typeId
                    );
                    if (updatedType) {
                        this.reconcileAttributeValues(updatedType);
                    }
                }
            },
        },
        visibility: {
            toggle: (typeId: MarkingType["id"]) => {
                this.state.set(draft => {
                    const index = draft.hiddenTypes.indexOf(typeId);
                    if (index === -1) {
                        draft.hiddenTypes.push(typeId);
                    } else {
                        draft.hiddenTypes.splice(index, 1);
                    }
                });
            },
            reset: () => {
                this.state.set(draft => {
                    draft.hiddenTypes = [];
                });
            },
        },
    };

    private reconcileAttributeValues(type: MarkingType) {
        const validValueIds = new Map<string, Set<string>>();
        (type.attributes ?? []).forEach(attribute => {
            const items =
                attribute.kind === MARKING_ATTRIBUTE_KIND.CHOICE
                    ? attribute.options
                    : attribute.ranges ?? [];
            validValueIds.set(
                attribute.id,
                new Set(items.map(item => item.id))
            );
        });

        [CANVAS_ID.LEFT, CANVAS_ID.RIGHT].forEach(canvasId => {
            MarkingsStore(canvasId).state.markings.forEach(marking => {
                if (marking.typeId !== type.id || !marking.attributeValues) {
                    return;
                }
                const validEntries = Object.entries(
                    marking.attributeValues
                ).filter(([attributeId, valueId]) =>
                    validValueIds.get(attributeId)?.has(valueId)
                );
                if (
                    validEntries.length !==
                    Object.keys(marking.attributeValues).length
                ) {
                    MarkingsStore(
                        canvasId
                    ).actions.markings.updateAttributeValues(
                        marking.label,
                        Object.fromEntries(validEntries)
                    );
                }
            });
        });
    }
}

const Store = new StoreClass();
export { Store as MarkingTypesStore };
export { type StoreClass as MarkingTypesStoreClass };
