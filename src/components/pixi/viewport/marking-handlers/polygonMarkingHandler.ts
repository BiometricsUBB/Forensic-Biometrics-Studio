// eslint-disable-next-line import/no-cycle
import { MarkingHandler } from "@/components/pixi/viewport/marking-handlers/markingHandler";
import { FederatedPointerEvent } from "pixi.js";
import { PolygonMarking } from "@/lib/markings/PolygonMarking";
import { getNormalizedMousePosition } from "@/components/pixi/viewport/event-handlers/utils";
import { MarkingModePlugin } from "@/components/pixi/viewport/plugins/markingModePlugin";
import { RotationStore } from "@/lib/stores/Rotation/Rotation";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { Point } from "@/lib/markings/Point";
import { getAdjustedPosition } from "@/components/pixi/viewport/utils/transform-point";

const distance = (p1: Point, p2: Point): number => {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
};

export class PolygonMarkingHandler extends MarkingHandler {
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
            new PolygonMarking(label, pos, this.typeId, [pos, pos])
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
        if (this.points.length === 1 && this.points[0]) {
            markingsStore.actions.temporaryMarking.updateTemporaryMarking({
                points: [this.points[0], pos],
            });
        } else {
            markingsStore.actions.temporaryMarking.updateTemporaryMarking({
                points: [...this.points, pos],
            });
        }
    }

    handleLMBUp(e: FederatedPointerEvent) {
        const { cachedViewportStore } = this.plugin.handlerParams;
        cachedViewportStore.actions.viewport.setRayPosition(
            getNormalizedMousePosition(e, this.plugin.handlerParams.viewport)
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

        if (
            this.points.length > 2 &&
            this.points[0] &&
            distance(pos, this.points[0]) < 20
        ) {
            const updatedMarking = new PolygonMarking(
                markingsStore.state.temporaryMarking!.label,
                markingsStore.state.temporaryMarking!.origin,
                markingsStore.state.temporaryMarking!.typeId,
                this.points
            );
            markingsStore.actions.markings.addOne(updatedMarking);
            this.cleanup();
        } else {
            this.points.push(pos);
            markingsStore.actions.temporaryMarking.updateTemporaryMarking({
                points: [...this.points, pos],
            });
        }
    }
}
