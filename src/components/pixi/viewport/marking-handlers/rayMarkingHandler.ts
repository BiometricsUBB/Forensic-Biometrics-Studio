// eslint-disable-next-line import/no-cycle
import { MarkingHandler } from "@/components/pixi/viewport/marking-handlers/markingHandler";
import { FederatedPointerEvent } from "pixi.js";
import { RayMarking } from "@/lib/markings/RayMarking";
import { getNormalizedMousePosition } from "@/components/pixi/viewport/event-handlers/utils";
import { getAngle } from "@/lib/utils/math/getAngle";
import { MarkingModePlugin } from "@/components/pixi/viewport/plugins/markingModePlugin";
import { RotationStore } from "@/lib/stores/Rotation/Rotation";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { getAdjustedPosition } from "@/components/pixi/viewport/utils/transform-point";

export class RayMarkingHandler extends MarkingHandler {
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
        markingsStore.actions.temporaryMarking.setTemporaryMarking(
            new RayMarking(label, pos, this.typeId, 0)
        );
    }

    handleMouseMove(e: FederatedPointerEvent) {
        const { viewport, markingsStore, cachedViewportStore } =
            this.plugin.handlerParams;
        const { rotation } = RotationStore(this.canvasId).state;

        if (this.stage === 1) {
            const pos = getAdjustedPosition(
                getNormalizedMousePosition(e, viewport),
                rotation,
                viewport
            );
            markingsStore.actions.temporaryMarking.updateTemporaryMarking({
                origin: pos,
            });
        } else {
            const mousePos = getAdjustedPosition(
                getNormalizedMousePosition(e, viewport),
                rotation,
                viewport
            );
            markingsStore.actions.temporaryMarking.updateTemporaryMarking({
                angleRad: getAngle(
                    mousePos,
                    cachedViewportStore.state.rayPosition
                ),
            });
        }
    }

    handleLMBUp(e: FederatedPointerEvent) {
        const { cachedViewportStore, viewport } = this.plugin.handlerParams;
        const { rotation } = RotationStore(this.canvasId).state;

        if (this.stage === 1) {
            this.stage = 2;
            cachedViewportStore.actions.viewport.setRayPosition(
                getAdjustedPosition(
                    getNormalizedMousePosition(e, viewport),
                    rotation,
                    viewport
                )
            );
        }
    }

    handleLMBDown() {
        if (this.stage === 2) {
            const { markingsStore } = this.plugin.handlerParams;
            markingsStore.actions.markings.addOne(
                markingsStore.state.temporaryMarking as RayMarking
            );
            this.cleanup();
        }
    }
}
