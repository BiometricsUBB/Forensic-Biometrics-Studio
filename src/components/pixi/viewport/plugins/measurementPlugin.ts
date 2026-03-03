import { Plugin, Viewport, Drag } from "pixi-viewport";
import { FederatedPointerEvent } from "pixi.js";
import {
    CURSOR_MODES,
    DashboardToolbarStore,
} from "@/lib/stores/DashboardToolbar";
import { CUSTOM_GLOBAL_EVENTS } from "@/lib/utils/const";
import { MeasurementMarking } from "@/lib/markings/MeasurementMarking";
import { MeasurementStore } from "@/lib/stores/Measurement/Measurement";
import { RotationStore } from "@/lib/stores/Rotation/Rotation";
import { CachedViewportStore } from "@/lib/stores/CachedViewport";
import { CANVAS_ID } from "../../canvas/hooks/useCanvasContext";
import { getNormalizedMousePosition } from "../event-handlers/utils";
import { getAdjustedPosition } from "../utils/transform-point";

export class MeasurementPlugin extends Plugin {
    private viewport: Viewport;

    private canvasId: CANVAS_ID;

    private tempLine: MeasurementMarking | null = null;

    private stage: 1 | 2 = 1;

    private spacePressed = false;

    private dragPlugin: Drag;

    constructor(viewport: Viewport, canvasId: CANVAS_ID) {
        super(viewport);
        this.viewport = viewport;
        this.canvasId = canvasId;
        this.dragPlugin = new Drag(viewport, { wheel: true });

        this.viewport.on("mousedown", this.handleMouseDown);
        window.addEventListener("keydown", this.handleKeyDown);
        window.addEventListener("keyup", this.handleKeyUp);
    }

    public override destroy(): void {
        super.destroy();
        this.removeEventListeners();
        window.removeEventListener("keydown", this.handleKeyDown);
        window.removeEventListener("keyup", this.handleKeyUp);
    }

    public cleanup() {
        this.removeEventListeners();
        this.tempLine = null;
        this.stage = 1;
        MeasurementStore.actions.setTempLine(this.canvasId, null);
    }

    private isMeasurementModeActive(): boolean {
        return (
            DashboardToolbarStore.state.settings.cursor.mode ===
            CURSOR_MODES.MEASUREMENT
        );
    }

    private handleKeyDown = (e: KeyboardEvent): void => {
        if (e.code === "Space") this.spacePressed = true;
    };

    private handleKeyUp = (e: KeyboardEvent): void => {
        if (e.code === "Space") this.spacePressed = false;
    };

    private handleMouseDown = (e: FederatedPointerEvent): void => {
        if (
            this.isMeasurementModeActive() &&
            !this.spacePressed &&
            e.button === 0
        ) {
            if (this.stage === 1) {
                this.startDrawing(e);
            } else if (this.stage === 2) {
                this.finishDrawing();
            }
        }
    };

    private startDrawing(e: FederatedPointerEvent): void {
        if (this.viewport.children.length < 1) return;

        document.addEventListener(
            CUSTOM_GLOBAL_EVENTS.INTERRUPT_MARKING,
            this.handleInterrupt
        );

        const { rotation } = RotationStore(this.canvasId).state;
        const pos = getAdjustedPosition(
            getNormalizedMousePosition(e, this.viewport),
            rotation,
            this.viewport
        );

        this.tempLine = new MeasurementMarking(0, pos, "__measurement__", pos);

        MeasurementStore.actions.setTempLine(this.canvasId, this.tempLine);

        this.addEventListeners();
    }

    private handleInterrupt = () => {
        this.cleanup();
    };

    private addEventListeners(): void {
        this.viewport.on("mousemove", this.handleMouseMove);
        this.viewport.on("mouseup", this.handleLMBUp);
    }

    private removeEventListeners(): void {
        this.viewport.off("mousemove", this.handleMouseMove);
        this.viewport.off("mouseup", this.handleLMBUp);
        document.removeEventListener(
            CUSTOM_GLOBAL_EVENTS.INTERRUPT_MARKING,
            this.handleInterrupt
        );
    }

    private handleMouseMove = (e: FederatedPointerEvent): void => {
        if (!this.isMeasurementModeActive() || !this.tempLine) return;

        const { rotation } = RotationStore(this.canvasId).state;
        const pos = getAdjustedPosition(
            getNormalizedMousePosition(e, this.viewport),
            rotation,
            this.viewport
        );

        if (this.stage === 1) {
            this.tempLine = new MeasurementMarking(
                this.tempLine.label,
                pos,
                this.tempLine.typeId,
                this.tempLine.endpoint
            );
        } else {
            this.tempLine = new MeasurementMarking(
                this.tempLine.label,
                this.tempLine.origin,
                this.tempLine.typeId,
                pos
            );
        }
        MeasurementStore.actions.setTempLine(this.canvasId, this.tempLine);
    };

    private handleLMBUp = (): void => {
        if (!this.isMeasurementModeActive() || !this.tempLine) return;

        if (this.stage === 1) {
            this.stage = 2;
            CachedViewportStore(this.canvasId).actions.viewport.setRayPosition(
                this.tempLine.endpoint
            );
        }
    };

    private finishDrawing(): void {
        if (this.tempLine) {
            CachedViewportStore(this.canvasId).actions.viewport.setRayPosition(
                this.tempLine.endpoint
            );

            MeasurementStore.actions.setFinishedLine(
                this.canvasId,
                this.tempLine
            );

            MeasurementStore.actions.setTempLine(this.canvasId, null);

            this.stage = 1;
            this.removeEventListeners();
        }
    }

    public override down(event: FederatedPointerEvent): boolean {
        if (!this.isMeasurementModeActive()) return false;
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
