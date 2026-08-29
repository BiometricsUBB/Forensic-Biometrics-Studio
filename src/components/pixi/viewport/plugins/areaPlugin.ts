import { Plugin, Viewport, Drag } from "pixi-viewport";
import { FederatedPointerEvent } from "pixi.js";
import {
    CURSOR_MODES,
    DashboardToolbarStore,
} from "@/lib/stores/DashboardToolbar";
import { CUSTOM_GLOBAL_EVENTS } from "@/lib/utils/const";
import { AreaStore } from "@/lib/stores/Area/Area";
import { RotationStore } from "@/lib/stores/Rotation/Rotation";
import { Point } from "@/lib/markings/Point";
import { CANVAS_ID } from "../../canvas/hooks/useCanvasContext";
import { getNormalizedMousePosition } from "../event-handlers/utils";
import { getAdjustedPosition } from "../utils/transform-point";

const CLOSE_DISTANCE_PX = 20;

export class AreaPlugin extends Plugin {
    private viewport: Viewport;

    private canvasId: CANVAS_ID;

    private spacePressed = false;

    private dragPlugin: Drag;

    constructor(viewport: Viewport, canvasId: CANVAS_ID) {
        super(viewport);
        this.viewport = viewport;
        this.canvasId = canvasId;
        this.dragPlugin = new Drag(viewport, { wheel: true });

        this.viewport.on("mousedown", this.handleMouseDown);
        this.viewport.on("mousemove", this.handleMouseMove);
        window.addEventListener("keydown", this.handleKeyDown);
        window.addEventListener("keyup", this.handleKeyUp);
        document.addEventListener(
            CUSTOM_GLOBAL_EVENTS.INTERRUPT_MARKING,
            this.handleInterrupt
        );
    }

    public override destroy(): void {
        super.destroy();
        this.viewport.off("mousedown", this.handleMouseDown);
        this.viewport.off("mousemove", this.handleMouseMove);
        window.removeEventListener("keydown", this.handleKeyDown);
        window.removeEventListener("keyup", this.handleKeyUp);
        document.removeEventListener(
            CUSTOM_GLOBAL_EVENTS.INTERRUPT_MARKING,
            this.handleInterrupt
        );
    }

    public cleanup(): void {
        AreaStore.actions.clearTemp(this.canvasId);
    }

    private isAreaModeActive(): boolean {
        return (
            DashboardToolbarStore.state.settings.cursor.mode ===
            CURSOR_MODES.AREA
        );
    }

    private getAdjustedPos(e: FederatedPointerEvent): Point {
        const { rotation } = RotationStore(this.canvasId).state;
        return getAdjustedPosition(
            getNormalizedMousePosition(e, this.viewport),
            rotation,
            this.viewport
        );
    }

    private handleKeyDown = (e: KeyboardEvent): void => {
        if (e.code === "Space") this.spacePressed = true;
    };

    private handleKeyUp = (e: KeyboardEvent): void => {
        if (e.code === "Space") this.spacePressed = false;
    };

    private handleInterrupt = (): void => {
        if (this.isAreaModeActive()) {
            // eslint-disable-next-line security/detect-object-injection
            const pts = AreaStore.state.tempPoints[this.canvasId];
            if (pts.length >= 3) {
                AreaStore.actions.finishPolygon(this.canvasId);
                return;
            }
        }
        this.cleanup();
    };

    private handleMouseMove = (e: FederatedPointerEvent): void => {
        if (!this.isAreaModeActive()) return;
        if (this.viewport.children.length < 1) return;
        AreaStore.actions.setCursorPoint(this.canvasId, this.getAdjustedPos(e));
    };

    private handleMouseDown = (e: FederatedPointerEvent): void => {
        if (!this.isAreaModeActive() || this.spacePressed || e.button !== 0)
            return;
        if (this.viewport.children.length < 1) return;

        const pos = this.getAdjustedPos(e);
        // eslint-disable-next-line security/detect-object-injection
        const tempPoints = AreaStore.state.tempPoints[this.canvasId];

        if (tempPoints.length >= 3 && tempPoints[0]) {
            const dx = pos.x - tempPoints[0].x;
            const dy = pos.y - tempPoints[0].y;
            if (
                Math.sqrt(dx * dx + dy * dy) <
                CLOSE_DISTANCE_PX / this.viewport.scale.x
            ) {
                AreaStore.actions.finishPolygon(this.canvasId);
                return;
            }
        }

        AreaStore.actions.addTempPoint(this.canvasId, pos);
    };

    public override down(event: FederatedPointerEvent): boolean {
        if (!this.isAreaModeActive()) return false;
        if (event.button === 1 || (this.spacePressed && event.button === 0)) {
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
}
