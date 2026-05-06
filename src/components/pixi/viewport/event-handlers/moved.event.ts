import { MovedEvent } from "pixi-viewport/dist/types";
import { Viewport as PixiViewport } from "pixi-viewport";
import { DashboardToolbarStore } from "@/lib/stores/DashboardToolbar";
import {
    Delta,
    ViewportHandlerParams,
    updateCachedViewportStore,
} from "./utils";
import { useGlobalViewport } from "../hooks/useGlobalViewport";
import { getOppositeCanvasId } from "../../canvas/utils/get-opposite-canvas-id";

function calculateDelta(
    e: MovedEvent,
    params: ViewportHandlerParams,
    oppositeViewport: PixiViewport
): Delta {
    const { viewport, cachedViewportStore } = params;

    switch (e.type) {
        case "drag": {
            const isScaleSync =
                DashboardToolbarStore.state.settings.viewport.scaleSync;

            const { position: cachedPosition } = cachedViewportStore.state;

            return {
                x:
                    (viewport.position._x - cachedPosition.x) /
                    (isScaleSync ? viewport.scaled : oppositeViewport.scaled),
                y:
                    (viewport.position._y - cachedPosition.y) /
                    (isScaleSync ? viewport.scaled : oppositeViewport.scaled),
            };
        }
        case "wheel": {
            const { position: cachedPosition } = cachedViewportStore.state;
            return {
                value: viewport.scaled / cachedViewportStore.state.scaled,
                offset: {
                    x:
                        (viewport.position._x - cachedPosition.x) /
                        viewport.scaled,
                    y:
                        (viewport.position._y - cachedPosition.y) /
                        viewport.scaled,
                },
            };
        }
        default:
            return null;
    }
}

export const handleMove = (e: MovedEvent, params: ViewportHandlerParams) => {
    const { id, updateViewport } = params;

    updateViewport();

    const { locked: isViewportLocked } =
        DashboardToolbarStore.state.settings.viewport;

    if (!isViewportLocked) {
        updateCachedViewportStore(params);
        return;
    }

    // Jeśli Viewport jest zalockowany (L): wyślij eventy do drugiego viewportu

    // oxlint-disable-next-line react-hooks/rules-of-hooks
    const oppositeViewport = useGlobalViewport(getOppositeCanvasId(id));
    if (oppositeViewport === null) return;

    const delta = calculateDelta(e, params, oppositeViewport);
    updateCachedViewportStore(params);
    requestAnimationFrame(() => {
        oppositeViewport.emit("opposite-moved", e, delta);
    });
};
