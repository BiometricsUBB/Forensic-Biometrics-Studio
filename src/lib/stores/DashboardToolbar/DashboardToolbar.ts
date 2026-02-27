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

    private setTracingSettings(
        callback: ActionProduceCallback<State["settings"]["tracing"], State>
    ) {
        this.state.set(draft => {
            draft.settings.tracing = callback(draft.settings.tracing, draft);
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
            tracing: {
                setIsEnabled: (isEnabled: boolean) => {
                    this.setTracingSettings(
                        produce(tracing => {
                            tracing.isEnabled = isEnabled;
                        })
                    );
                },
                toggleIsEnabled: () => {
                    this.setTracingSettings(
                        produce(tracing => {
                            tracing.isEnabled = !tracing.isEnabled;
                        })
                    );
                },
                setColor: (color: string) => {
                    this.setTracingSettings(
                        produce(tracing => {
                            tracing.color = color;
                        })
                    );
                },
                setOpacity: (opacity: number) => {
                    this.setTracingSettings(
                        produce(tracing => {
                            tracing.opacity = opacity;
                        })
                    );
                },
                setBrushSize: (brushSize: number) => {
                    this.setTracingSettings(
                        produce(tracing => {
                            tracing.brushSize = brushSize;
                        })
                    );
                },
                setMode: (mode: "free" | "line") => {
                    this.setTracingSettings(
                        produce(tracing => {
                            tracing.mode = mode;
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
