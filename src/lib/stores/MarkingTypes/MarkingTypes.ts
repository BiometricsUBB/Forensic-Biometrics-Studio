/* eslint-disable no-param-reassign */
import { MarkingType } from "@/lib/markings/MarkingType";
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
}

const Store = new StoreClass();
export { Store as MarkingTypesStore };
export { type StoreClass as MarkingTypesStoreClass };
