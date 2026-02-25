/* eslint-disable no-param-reassign */

import { produce } from "immer";
import { CUSTOM_GLOBAL_EVENTS } from "@/lib/utils/const";
import { ActionProduceCallback } from "../immer.helpers";
import {
    DashboardToolbarState as State,
    _useDashboardToolbarStore as useStore,
} from "./DashboardToolbar.store";

class StoreClass {
    readonly use = useStore;

    get state() {
        return this.use.getState();
    }

    private setCursorSettings(
        callback: ActionProduceCallback<State["settings"]["cursor"], State>
    ) {
        this.state.set(draft => {
            draft.settings.cursor = callback(draft.settings.cursor, draft);
        });
        document.dispatchEvent(new Event(CUSTOM_GLOBAL_EVENTS.CLEANUP));
    }

    private setViewportSettings(
        callback: ActionProduceCallback<State["settings"]["viewport"], State>
    ) {
        this.state.set(draft => {
            draft.settings.viewport = callback(draft.settings.viewport, draft);
        });
    }

    readonly actions = {
        settings: {
            viewport: {
                toggleLockedViewport: () => {
                    this.setViewportSettings(
                        produce(settings => {
                            settings.locked = !settings.locked;
                        })
                    );
                },
                setLockedViewport: (state: boolean) => {
                    this.setViewportSettings(
                        produce(settings => {
                            settings.locked = state;
                        })
                    );
                },
                toggleLockScaleSync: () => {
                    this.setViewportSettings(
                        produce(settings => {
                            settings.scaleSync = !settings.scaleSync;
                        })
                    );
                },
                setLockScaleSync: (state: boolean) => {
                    this.setViewportSettings(
                        produce(settings => {
                            settings.scaleSync = state;
                        })
                    );
                },
                toggleRotationSync: () => {
                    this.setViewportSettings(
                        produce(settings => {
                            settings.rotationSync = !settings.rotationSync;
                        })
                    );
                },
                setRotationSync: (state: boolean) => {
                    this.setViewportSettings(
                        produce(settings => {
                            settings.rotationSync = state;
                        })
                    );
                },
            },
            cursor: {
                setCursorMode: (mode: State["settings"]["cursor"]["mode"]) => {
                    this.setCursorSettings(
                        produce(cursor => {
                            cursor.mode = mode;
                        })
                    );
                },
            },
        },
    };

    readonly types = {
        CursorMode: "selection" as const,
    };
}

const Store = new StoreClass();
export { Store as DashboardToolbarStore };
export { type StoreClass as DashboardToolbarStoreClass };
