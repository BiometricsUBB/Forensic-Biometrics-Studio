/* eslint-disable no-underscore-dangle */
import { useApp } from "@pixi/react";
import { forwardRef, ReactNode } from "react";
import { Viewport as PixiViewport } from "pixi-viewport";
import { CanvasUpdater } from "@/lib/stores/CanvasUpdater";
import { CachedViewportStore } from "@/lib/stores/CachedViewport";
import { MarkingsStore } from "@/lib/stores/Markings";
import { MarkingModePlugin } from "@/components/pixi/viewport/plugins/markingModePlugin";
import { ReactPixiViewport } from "./react-pixi-viewport";
import { CanvasMetadata } from "../canvas/hooks/useCanvasContext";
import { ViewportHandlerParams } from "./event-handlers/utils";
import { handleMove, handleOppositeMove, handleZoom } from "./event-handlers";
import { SelectionModePlugin } from "./plugins/selectionModePlugin";
import { AutoRotatePlugin } from "./plugins/autoRotatePlugin";
import { ManualRotatePlugin } from "./plugins/manualRotatePlugin";

export type ViewportProps = {
    children?: ReactNode;
    canvasMetadata: CanvasMetadata;
};

export const Viewport = forwardRef<PixiViewport, ViewportProps>(
    ({ children, canvasMetadata: { id } }: ViewportProps, ref) => {
        const app = useApp();
        const updateCanvas = CanvasUpdater.useDry();
        const updateViewport = () => {
            updateCanvas(id, "viewport");
        };

        return (
            <ReactPixiViewport
                ref={ref}
                options={{
                    events: app.renderer.events,
                    ticker: app.ticker,
                    threshold: 0,
                    passiveWheel: false,
                    allowPreserveDragOutside: true,
                }}
                sideEffects={viewport => {
                    viewport.wheel({
                        percent: 0,
                        interrupt: true,
                        wheelZoom: true,
                        center: viewport.center,
                    });

                    const handlerParams: ViewportHandlerParams = {
                        viewport,
                        id,
                        updateViewport,
                        cachedViewportStore: CachedViewportStore(id),
                        markingsStore: MarkingsStore(id),
                    };

                    // Remove default drag plugin
                    viewport.plugins.remove("drag");

                    // Handle operations in marking mode
                    viewport.plugins.add(
                        "markingMode",
                        new MarkingModePlugin(viewport, handlerParams)
                    );

                    // Handle operations in selection mode
                    viewport.plugins.add(
                        "selectionMode",
                        new SelectionModePlugin(viewport)
                    );

                    // Handle operations in auto rotate mode
                    viewport.plugins.add(
                        "autoRotate",
                        new AutoRotatePlugin(viewport, id)
                    );

                    viewport.plugins.add(
                        "manualRotate",
                        new ManualRotatePlugin(viewport, id)
                    );

                    viewport.on("childAdded", updateViewport);
                    viewport.on("childRemoved", updateViewport);
                    viewport.on("frame-end", updateViewport);

                    setTimeout(() => {
                        viewport.off("frame-end", updateViewport);
                    }, app.ticker.deltaMS * 2);

                    viewport.on("drag-start", () =>
                        CachedViewportStore(id).actions.viewport.setIsDragging(
                            true
                        )
                    );

                    viewport.on("drag-end", () =>
                        CachedViewportStore(id).actions.viewport.setIsDragging(
                            false
                        )
                    );

                    viewport.on("moved", e => {
                        handleMove(e, handlerParams);
                    });

                    viewport.on("opposite-moved", (e, delta) => {
                        handleOppositeMove(e, handlerParams, delta);
                    });

                    viewport.on("zoomed", e => {
                        handleZoom(e, handlerParams);
                    });

                    // eslint-disable-next-line no-param-reassign
                    viewport.name = id;

                    return viewport;
                }}
            >
                {children}
            </ReactPixiViewport>
        );
    }
);
