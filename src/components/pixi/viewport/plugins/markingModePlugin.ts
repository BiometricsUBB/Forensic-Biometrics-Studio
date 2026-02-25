/* eslint import/no-cycle: 0 */
import { Drag, Plugin, Viewport } from "pixi-viewport";
import { FederatedPointerEvent } from "pixi.js";
import {
    CURSOR_MODES,
    DashboardToolbarStore,
} from "@/lib/stores/DashboardToolbar";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { CUSTOM_GLOBAL_EVENTS } from "@/lib/utils/const";
import {
    MarkingHandler,
    PointMarkingHandler,
    RayMarkingHandler,
    LineSegmentMarkingHandler,
    BoundingBoxMarkingHandler,
    PolygonMarkingHandler,
    RectangleMarkingHandler,
} from "@/components/pixi/viewport/marking-handlers";
import { MARKING_CLASS } from "@/lib/markings/MARKING_CLASS";
import { isManualRotateKeyDown } from "./manualRotatePlugin";
import { ViewportHandlerParams } from "../event-handlers/utils";

export class MarkingModePlugin extends Plugin {
    public readonly handlerParams: ViewportHandlerParams;

    private viewport: Viewport;

    private spacePressed = false;

    private dragPlugin: Drag;

    private currentHandler: MarkingHandler | null = null;

    constructor(viewport: Viewport, handlerParams: ViewportHandlerParams) {
        super(viewport);
        this.dragPlugin = new Drag(viewport, { wheel: true });
        this.viewport = viewport;
        this.handlerParams = handlerParams;

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
        document.dispatchEvent(
            new Event(CUSTOM_GLOBAL_EVENTS.INTERRUPT_MARKING)
        );
        this.removeEventListeners();
        this.currentHandler = null;
    }

    private isMarkingModeActive(): boolean {
        return (
            DashboardToolbarStore.state.settings.cursor.mode ===
            CURSOR_MODES.MARKING
        );
    }

    private shouldHandleMarking(): boolean {
        return (
            this.isMarkingModeActive() &&
            !this.spacePressed &&
            !isManualRotateKeyDown()
        );
    }

    private handleMouseDown = (e: FederatedPointerEvent): void => {
        if (this.shouldHandleMarking() && e.button === 0) {
            this.startMarking(e);
        }
    };

    private handleKeyDown = (e: KeyboardEvent): void => {
        if (e.code === "Space") this.spacePressed = true;
    };

    private handleKeyUp = (e: KeyboardEvent): void => {
        if (e.code === "Space") this.spacePressed = false;
    };

    private startMarking(e: FederatedPointerEvent): void {
        const { viewport, markingsStore } = this.handlerParams;
        if (
            viewport.children.length < 1 ||
            markingsStore.state.temporaryMarking !== null
        )
            return;

        document.addEventListener(
            CUSTOM_GLOBAL_EVENTS.INTERRUPT_MARKING,
            this.handleInterrupt
        );

        const type = MarkingTypesStore.actions.selectedType.get();
        if (!type) return;

        const MARKING_HANDLERS = {
            [MARKING_CLASS.POINT]: PointMarkingHandler,
            [MARKING_CLASS.RAY]: RayMarkingHandler,
            [MARKING_CLASS.LINE_SEGMENT]: LineSegmentMarkingHandler,
            [MARKING_CLASS.BOUNDING_BOX]: BoundingBoxMarkingHandler,
            [MARKING_CLASS.POLYGON]: PolygonMarkingHandler,
            [MARKING_CLASS.RECTANGLE]: RectangleMarkingHandler,
        };

        // eslint-disable-next-line security/detect-object-injection
        const MarkingHandler = MARKING_HANDLERS[type.markingClass];

        if (!MarkingHandler) {
            throw new Error(`Unsupported marking class: ${type.markingClass}`);
        }

        this.currentHandler = new MarkingHandler(this, type.id, e);

        this.addEventListeners();
    }

    private handleInterrupt = () => {
        this.handlerParams.markingsStore.actions.temporaryMarking.setTemporaryMarking(
            null
        );
        this.removeEventListeners();
    };

    private addEventListeners(): void {
        this.viewport.on("mousemove", this.handleMouseMove);
        this.viewport.on("mouseup", this.handleLMBUp);
        this.viewport.on("mousedown", this.handleLMBDown);
    }

    private removeEventListeners(): void {
        this.viewport.off("mousemove", this.handleMouseMove);
        this.viewport.off("mouseup", this.handleLMBUp);
        this.viewport.off("mousedown", this.handleLMBDown);
        document.removeEventListener(
            CUSTOM_GLOBAL_EVENTS.INTERRUPT_MARKING,
            this.handleInterrupt
        );
        this.currentHandler = null;
    }

    private handleMouseMove = (e: FederatedPointerEvent): void => {
        if (!this.isMarkingModeActive() || !this.currentHandler) return;
        this.currentHandler.handleMouseMove(e);
    };

    private handleLMBUp = (e: FederatedPointerEvent): void => {
        if (!this.shouldHandleMarking() || !this.currentHandler) return;
        if (e.button === 0) this.currentHandler.handleLMBUp(e);
    };

    private handleLMBDown = (e: FederatedPointerEvent): void => {
        if (!this.shouldHandleMarking() || !this.currentHandler?.handleLMBDown)
            return;

        if (e.button === 0) this.currentHandler.handleLMBDown(e);
    };

    public override down(event: FederatedPointerEvent): boolean {
        if (!this.isMarkingModeActive()) return false;
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
