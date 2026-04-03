// eslint-disable-next-line import/no-cycle
import { MarkingHandler } from "@/components/pixi/viewport/marking-handlers/markingHandler";
import { FederatedPointerEvent } from "pixi.js";
import { TriangleMarking } from "@/lib/markings/TriangleMarking";
import { getNormalizedMousePosition } from "@/components/pixi/viewport/event-handlers/utils";
import type { MarkingModePlugin } from "@/components/pixi/viewport/plugins/markingModePlugin";
import { RotationStore } from "@/lib/stores/Rotation/Rotation";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { Point } from "@/lib/markings/Point";
import { getAdjustedPosition } from "@/components/pixi/viewport/utils/transform-point";

export class TriangleMarkingHandler extends MarkingHandler {
    private points: Point[] = [];

    private canvasId: CANVAS_ID;

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

        markingsStore.actions.temporaryMarking.setTemporaryMarking(
            new TriangleMarking(label, pos, this.typeId, [pos, pos])
        );
    }

    handleMouseMove(e: FederatedPointerEvent) {
        const { viewport, markingsStore } = this.plugin.handlerParams;
        const { rotation } = RotationStore(this.canvasId).state;
        const pos = getAdjustedPosition(
            getNormalizedMousePosition(e, viewport),
            rotation,
            viewport
        );

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
        const { viewport, markingsStore } = this.plugin.handlerParams;
        const { rotation } = RotationStore(this.canvasId).state;
        const pos = getAdjustedPosition(
            getNormalizedMousePosition(e, viewport),
            rotation,
            viewport
        );

        if (this.points.length === 2) {
            const updatedMarking = new TriangleMarking(
                markingsStore.state.temporaryMarking!.label,
                markingsStore.state.temporaryMarking!.origin,
                markingsStore.state.temporaryMarking!.typeId,
                [...this.points, pos]
            );

            this.addMarkingWithHistory(updatedMarking);
            this.cleanup();
        } else {
            this.points.push(pos);
            markingsStore.actions.temporaryMarking.updateTemporaryMarking({
                points: [...this.points, pos],
            });
        }
    }
}
