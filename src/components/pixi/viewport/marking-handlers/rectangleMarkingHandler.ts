// eslint-disable-next-line import/no-cycle
import { MarkingHandler } from "@/components/pixi/viewport/marking-handlers/markingHandler";
import { FederatedPointerEvent } from "pixi.js";
import { RectangleMarking } from "@/lib/markings/RectangleMarking";
import { getNormalizedMousePosition } from "@/components/pixi/viewport/event-handlers/utils";
import { MarkingModePlugin } from "@/components/pixi/viewport/plugins/markingModePlugin";
import { RotationStore } from "@/lib/stores/Rotation/Rotation";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { Point } from "@/lib/markings/Point";
import { getAdjustedPosition } from "@/components/pixi/viewport/utils/transform-point";

export class RectangleMarkingHandler extends MarkingHandler {
    private origin: Point | null = null;

    private canvasId: CANVAS_ID;

    constructor(
        plugin: MarkingModePlugin,
        typeId: string,
        startEvent: FederatedPointerEvent
    ) {
        super(plugin, typeId, startEvent);
        this.canvasId = plugin.handlerParams.id;
        this.initOrigin(startEvent);
    }

    private initOrigin(e: FederatedPointerEvent) {
        const { viewport, markingsStore } = this.plugin.handlerParams;
        const label = markingsStore.actions.labelGenerator.getLabel();
        const pos = getNormalizedMousePosition(e, viewport);
        this.origin = pos;
        const { rotation } = RotationStore(this.canvasId).state;
        const worldPos = getAdjustedPosition(pos, rotation, viewport);
        markingsStore.actions.temporaryMarking.setTemporaryMarking(
            new RectangleMarking(label, worldPos, this.typeId, [
                worldPos,
                worldPos,
                worldPos,
                worldPos,
            ])
        );
    }

    handleMouseMove(e: FederatedPointerEvent) {
        if (!this.origin) return;
        const { viewport, markingsStore } = this.plugin.handlerParams;
        const pos = getNormalizedMousePosition(e, viewport);
        const { rotation } = RotationStore(this.canvasId).state;
        const screenPoints: Point[] = [
            this.origin,
            { x: this.origin.x, y: pos.y },
            pos,
            { x: pos.x, y: this.origin.y },
        ];
        const worldPoints = screenPoints.map(p =>
            getAdjustedPosition(p, rotation, viewport)
        );
        markingsStore.actions.temporaryMarking.updateTemporaryMarking({
            points: worldPoints,
        });
    }

    handleLMBUp(e: FederatedPointerEvent) {
        const { cachedViewportStore } = this.plugin.handlerParams;
        cachedViewportStore.actions.viewport.setRayPosition(
            getNormalizedMousePosition(e, this.plugin.handlerParams.viewport)
        );
    }

    handleLMBDown(e: FederatedPointerEvent) {
        if (!this.origin) return;
        const { viewport, markingsStore } = this.plugin.handlerParams;
        const endpoint = getNormalizedMousePosition(e, viewport);
        const { rotation } = RotationStore(this.canvasId).state;

        const adjustedOrigin = getAdjustedPosition(
            this.origin,
            rotation,
            viewport
        );
        const adjustedEndpoint = getAdjustedPosition(
            endpoint,
            rotation,
            viewport
        );
        const points: Point[] = [
            adjustedOrigin,
            getAdjustedPosition(
                { x: this.origin.x, y: endpoint.y },
                rotation,
                viewport
            ),
            adjustedEndpoint,
            getAdjustedPosition(
                { x: endpoint.x, y: this.origin.y },
                rotation,
                viewport
            ),
        ];

        markingsStore.actions.markings.addOne(
            new RectangleMarking(
                markingsStore.state.temporaryMarking!.label,
                adjustedOrigin,
                markingsStore.state.temporaryMarking!.typeId,
                points
            )
        );
        this.cleanup();
    }
}
