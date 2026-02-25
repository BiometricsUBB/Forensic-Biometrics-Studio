import { Drag, Plugin, Viewport } from "pixi-viewport";
import { FederatedPointerEvent } from "pixi.js";
import {
    CURSOR_MODES,
    DashboardToolbarStore,
} from "@/lib/stores/DashboardToolbar";
import { isManualRotateKeyDown } from "./manualRotatePlugin";

export class SelectionModePlugin extends Plugin {
    private dragPlugin: Drag;

    constructor(viewport: Viewport) {
        super(viewport);
        this.dragPlugin = new Drag(viewport, {
            wheel: true,
        });
    }

    public override down(event: FederatedPointerEvent): boolean {
        if (!this.isSelectionModeActive() || isManualRotateKeyDown()) {
            return false;
        }

        if (event.button === 0 || event.button === 1 || event.button === 2) {
            return this.dragPlugin.down(event);
        }
        return false;
    }

    public override move(event: FederatedPointerEvent): boolean {
        return this.dragPlugin.move(event);
    }

    public override up(event: FederatedPointerEvent): boolean {
        return this.dragPlugin.up(event);
    }

    private isSelectionModeActive(): boolean {
        return (
            DashboardToolbarStore.state.settings.cursor.mode ===
            CURSOR_MODES.SELECTION
        );
    }
}
