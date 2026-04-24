/* eslint-disable no-param-reassign */
import { _useKeybindingsStore, TypeKeybinding } from "./Keybindings.store";

class StoreClass {
    readonly use = _useKeybindingsStore;

    get state() {
        return this.use.getState();
    }

    readonly actions = {
        typesKeybindings: {
            add: (keybinding: TypeKeybinding) => {
                this.state.set(draft => {
                    // One type can only have one key per mode — remove its previous binding
                    draft.typesKeybindings = draft.typesKeybindings.filter(
                        x =>
                            !(
                                x.typeId === keybinding.typeId &&
                                x.workingMode === keybinding.workingMode
                            )
                    );
                    draft.typesKeybindings.push(keybinding);
                });
            },
            remove: (
                typeId: TypeKeybinding["typeId"],
                mode: TypeKeybinding["workingMode"]
            ) => {
                this.state.set(draft => {
                    draft.typesKeybindings = draft.typesKeybindings.filter(
                        x => x.typeId !== typeId || x.workingMode !== mode
                    );
                });
            },
            cleanupOrphans: (validTypeIds: string[]) => {
                this.state.set(draft => {
                    draft.typesKeybindings = draft.typesKeybindings.filter(x =>
                        validTypeIds.includes(x.typeId)
                    );
                });
            },
        },
    };
}

const Store = new StoreClass();
export { Store as KeybindingsStore };
export { StoreClass as KeybindingsStoreClass };
