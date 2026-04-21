// eslint-disable-next-line import/no-cycle
import { MarkingHandler } from "@/components/pixi/viewport/marking-handlers/markingHandler";
import { FederatedPointerEvent } from "pixi.js";
import { FreehandMarking } from "@/lib/markings/FreehandMarking";
import { getNormalizedMousePosition } from "@/components/pixi/viewport/event-handlers/utils";
import type { MarkingModePlugin } from "@/components/pixi/viewport/plugins/markingModePlugin";
import { RotationStore } from "@/lib/stores/Rotation/Rotation";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { Point } from "@/lib/markings/Point";
import { getAdjustedPosition } from "@/components/pixi/viewport/utils/transform-point";

const MIN_DISTANCE_SQ = 9; // 3px threshold, squared to avoid sqrt

export class FreehandMarkingHandler extends MarkingHandler {
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
            new FreehandMarking(label, pos, this.typeId, [pos])
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

    handleLMBDown() {
        // ignore
    }

    handleMouseMove(e: FederatedPointerEvent) {
        const { markingsStore } = this.plugin.handlerParams;

        const pos = this.getAdjustedPos(e);
        const last = this.points[this.points.length - 1];
        if (last) {
            const dx = pos.x - last.x;
            const dy = pos.y - last.y;
            if (dx * dx + dy * dy < MIN_DISTANCE_SQ) return;
        }

        this.points.push(pos);
        markingsStore.actions.temporaryMarking.updateTemporaryMarking({
            points: [...this.points],
        });
    }

    handleLMBUp(e: FederatedPointerEvent) {
        const pos = this.getAdjustedPos(e);
        const finalPoints = [...this.points, pos];
        const { markingsStore } = this.plugin.handlerParams;

        const updatedMarking = new FreehandMarking(
            markingsStore.state.temporaryMarking!.label,
            markingsStore.state.temporaryMarking!.origin,
            markingsStore.state.temporaryMarking!.typeId,
            finalPoints
        );

        this.addMarkingWithHistory(updatedMarking);
        this.cleanup();
    }

    override handleRMBDown() {
        this.cleanup();
    }
}
