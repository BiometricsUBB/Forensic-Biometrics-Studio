// eslint-disable-next-line import/no-cycle
import { MarkingHandler } from "@/components/pixi/viewport/marking-handlers/markingHandler";
import { FederatedPointerEvent } from "pixi.js";
import { MeasurementMarking } from "@/lib/markings/MeasurementMarking";
import { getNormalizedMousePosition } from "@/components/pixi/viewport/event-handlers/utils";
import type { MarkingModePlugin } from "@/components/pixi/viewport/plugins/markingModePlugin";
import { RotationStore } from "@/lib/stores/Rotation/Rotation";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { getAdjustedPosition } from "@/components/pixi/viewport/utils/transform-point";

export class MeasurementMarkingHandler extends MarkingHandler {
    private stage: 1 | 2 = 1;
    private canvasId: CANVAS_ID;

    constructor(
        plugin: MarkingModePlugin,
        typeId: string,
        startEvent: FederatedPointerEvent
    ) {
        super(plugin, typeId, startEvent);
        this.canvasId = plugin.handlerParams.id;
        this.initFirstStage(startEvent);
    }

    private initFirstStage(e: FederatedPointerEvent) {
        const { viewport, markingsStore } = this.plugin.handlerParams;
        const label = markingsStore.actions.labelGenerator.getLabel();
        const { rotation } = RotationStore(this.canvasId).state;
        const pos = getAdjustedPosition(
            getNormalizedMousePosition(e, viewport),
            rotation,
            viewport
        );

        // FIX: Kolejność (label, POS, typeId, POS)
        markingsStore.actions.temporaryMarking.setTemporaryMarking(
            new MeasurementMarking(label, pos, this.typeId, pos)
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

        if (this.stage === 1) {
            markingsStore.actions.temporaryMarking.updateTemporaryMarking({
                origin: pos,
            });
        } else {
            markingsStore.actions.temporaryMarking.updateTemporaryMarking({
                endpoint: pos,
            });
        }
    }

    handleLMBUp(e: FederatedPointerEvent) {
        const { cachedViewportStore } = this.plugin.handlerParams;
        if (this.stage === 1) {
            this.stage = 2;
            cachedViewportStore.actions.viewport.setRayPosition(
                getNormalizedMousePosition(
                    e,
                    this.plugin.handlerParams.viewport
                )
            );
        }
    }

    handleLMBDown() {
        if (this.stage === 2) {
            const { markingsStore } = this.plugin.handlerParams;
            markingsStore.actions.markings.addOne(
                markingsStore.state.temporaryMarking as MeasurementMarking
            );
            this.cleanup();
        }
    }
}