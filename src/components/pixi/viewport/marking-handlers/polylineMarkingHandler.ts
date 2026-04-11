// eslint-disable-next-line import/no-cycle
import { MarkingHandler } from "@/components/pixi/viewport/marking-handlers/markingHandler";
import { FederatedPointerEvent } from "pixi.js";
import { PolylineMarking } from "@/lib/markings/PolylineMarking";
import { getNormalizedMousePosition } from "@/components/pixi/viewport/event-handlers/utils";
import type { MarkingModePlugin } from "@/components/pixi/viewport/plugins/markingModePlugin";
import { RotationStore } from "@/lib/stores/Rotation/Rotation";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { Point } from "@/lib/markings/Point";
import { getAdjustedPosition } from "@/components/pixi/viewport/utils/transform-point";

const DOUBLE_CLICK_MS = 300;

export class PolylineMarkingHandler extends MarkingHandler {
    private points: Point[] = [];

    private canvasId: CANVAS_ID;

    private lastClickTime = 0;

    constructor(
        plugin: MarkingModePlugin,
        typeId: string,
        startEvent: FederatedPointerEvent
    ) {
        super(plugin, typeId, startEvent);
        this.canvasId = plugin.handlerParams.id;
        this.initFirstPoint(startEvent);
    }

    private initFirstPoint(e: FederatedPointerEvent) {
        const { viewport, markingsStore } = this.plugin.handlerParams;
        const label = markingsStore.actions.labelGenerator.getLabel();
        const { rotation } = RotationStore(this.canvasId).state;
        const pos = getAdjustedPosition(
            getNormalizedMousePosition(e, viewport),
            rotation,
            viewport
        );
        this.points = [pos];
        this.lastClickTime = Date.now();
        markingsStore.actions.temporaryMarking.setTemporaryMarking(
            new PolylineMarking(label, pos, this.typeId, [pos, pos])
        );
    }

    private getAdjustedPos(e: FederatedPointerEvent): Point {
        const { viewport } = this.plugin.handlerParams;
        const { rotation } = RotationStore(this.canvasId).state;
        return getAdjustedPosition(
            getNormalizedMousePosition(e, viewport),
            rotation,
            viewport
        );
    }

    private finalize(finalPoints: Point[]) {
        const { markingsStore } = this.plugin.handlerParams;
        const updatedMarking = new PolylineMarking(
            markingsStore.state.temporaryMarking!.label,
            markingsStore.state.temporaryMarking!.origin,
            markingsStore.state.temporaryMarking!.typeId,
            finalPoints
        );
        this.addMarkingWithHistory(updatedMarking);
        this.cleanup();
    }

    handleMouseMove(e: FederatedPointerEvent) {
        const { markingsStore } = this.plugin.handlerParams;
        const pos = this.getAdjustedPos(e);
        markingsStore.actions.temporaryMarking.updateTemporaryMarking({
            points: [...this.points, pos],
        });
    }

    handleLMBUp(e: FederatedPointerEvent) {
        const { cachedViewportStore, viewport } = this.plugin.handlerParams;
        cachedViewportStore.actions.viewport.setRayPosition(
            getNormalizedMousePosition(e, viewport)
        );
    }

    handleLMBDown(e: FederatedPointerEvent) {
        const now = Date.now();
        const isDoubleClick = now - this.lastClickTime < DOUBLE_CLICK_MS;
        this.lastClickTime = now;

        const pos = this.getAdjustedPos(e);

        if (isDoubleClick && this.points.length >= 1) {
            this.finalize([...this.points, pos]);
            return;
        }

        this.points.push(pos);
        const { markingsStore } = this.plugin.handlerParams;
        markingsStore.actions.temporaryMarking.updateTemporaryMarking({
            points: [...this.points, pos],
        });
    }

    override handleRMBDown() {
        if (this.points.length >= 2) {
            this.finalize(this.points);
        }
    }
}
