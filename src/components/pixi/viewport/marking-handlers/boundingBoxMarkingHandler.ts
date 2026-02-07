// eslint-disable-next-line import/no-cycle
import { MarkingHandler } from "@/components/pixi/viewport/marking-handlers/markingHandler";
import { FederatedPointerEvent } from "pixi.js";
import { BoundingBoxMarking } from "@/lib/markings/BoundingBoxMarking";
import { getNormalizedMousePosition } from "@/components/pixi/viewport/event-handlers/utils";
import { MarkingModePlugin } from "@/components/pixi/viewport/plugins/markingModePlugin";
import { RotationStore } from "@/lib/stores/Rotation/Rotation";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { getAdjustedPosition } from "@/components/pixi/viewport/utils/transform-point";

export class BoundingBoxMarkingHandler extends MarkingHandler {
    private canvasId: CANVAS_ID;

    constructor(
        plugin: MarkingModePlugin,
        typeId: string,
        startEvent: FederatedPointerEvent
    ) {
        super(plugin, typeId, startEvent);
        this.canvasId = plugin.handlerParams.id;
        this.initMarking(startEvent);
    }

    private initMarking(e: FederatedPointerEvent) {
        const { viewport, markingsStore } = this.plugin.handlerParams;
        const label = markingsStore.actions.labelGenerator.getLabel();
        const { rotation } = RotationStore(this.canvasId).state;
        const pos = getAdjustedPosition(
            getNormalizedMousePosition(e, viewport),
            rotation,
            viewport
        );
        markingsStore.actions.temporaryMarking.setTemporaryMarking(
            new BoundingBoxMarking(label, pos, this.typeId, pos)
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
            endpoint: pos,
        });
    }

    handleLMBUp(e: FederatedPointerEvent) {
        const { cachedViewportStore } = this.plugin.handlerParams;
        cachedViewportStore.actions.viewport.setRayPosition(
            getNormalizedMousePosition(e, this.plugin.handlerParams.viewport)
        );
    }

    handleLMBDown() {
        const { markingsStore } = this.plugin.handlerParams;
        markingsStore.actions.markings.addOne(
            markingsStore.state.temporaryMarking as BoundingBoxMarking
        );
        this.cleanup();
    }
}
