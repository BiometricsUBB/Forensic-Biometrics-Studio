import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { getOppositeCanvasId } from "@/components/pixi/canvas/utils/get-opposite-canvas-id";
import { RotationStore } from "@/lib/stores/Rotation/Rotation";
import { DashboardToolbarStore } from "@/lib/stores/DashboardToolbar";

export function applyRotationDelta(canvasId: CANVAS_ID, deltaRadians: number) {
    const currentRotation = RotationStore(canvasId).state.rotation;
    RotationStore(canvasId).actions.setRotation(currentRotation + deltaRadians);

    const { rotationSync } = DashboardToolbarStore.state.settings.viewport;
    if (rotationSync) {
        const oppositeId = getOppositeCanvasId(canvasId);
        const oppositeRotation = RotationStore(oppositeId).state.rotation;
        RotationStore(oppositeId).actions.setRotation(
            oppositeRotation + deltaRadians
        );
    }
}

export function resetRotation(canvasId: CANVAS_ID) {
    const currentRotation = RotationStore(canvasId).state.rotation;
    RotationStore(canvasId).actions.resetRotation();

    const { rotationSync } = DashboardToolbarStore.state.settings.viewport;
    if (rotationSync) {
        const oppositeId = getOppositeCanvasId(canvasId);
        const oppositeRotation = RotationStore(oppositeId).state.rotation;
        RotationStore(oppositeId).actions.setRotation(
            oppositeRotation - currentRotation
        );
    }
}
