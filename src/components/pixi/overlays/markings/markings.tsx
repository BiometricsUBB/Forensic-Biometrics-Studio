import { Graphics, useTick } from "@pixi/react";
import { Graphics as PixiGraphics } from "pixi.js";
import { memo, useCallback, useRef } from "react";
import { MarkingsStore } from "@/lib/stores/Markings";
import { MarkingClass } from "@/lib/markings/MarkingClass";
import { ShallowViewportStore } from "@/lib/stores/ShallowViewport";
import { CanvasToolbarStore } from "@/lib/stores/CanvasToolbar";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { CANVAS_ID } from "../../canvas/hooks/useCanvasContext";
import { drawMarking, isBlinkActive } from "./marking.utils";

export type MarkingsProps = {
    markings: MarkingClass[];
    canvasId: CANVAS_ID;
    alpha?: number;
    rotation?: number;
    centerX?: number;
    centerY?: number;
};

export const Markings = memo(
    ({
        canvasId,
        markings,
        alpha,
        rotation = 0,
        centerX = 0,
        centerY = 0,
    }: MarkingsProps) => {
        const graphicsRef = useRef<PixiGraphics | null>(null);

        const showMarkingLabels = CanvasToolbarStore(canvasId).use(
            state => state.settings.markings.showLabels
        );

        const calibration = MarkingsStore(canvasId).use(state => state.calibration);

        const { viewportWidthRatio, viewportHeightRatio } =
            ShallowViewportStore(canvasId).use(state => ({
                viewportWidthRatio: state.size.screenWorldWidth / state.size.worldWidth,
                viewportHeightRatio: state.size.screenWorldHeight / state.size.worldHeight,
            }));

        const markingTypes = MarkingTypesStore.use(state => state.types);

        const selectedMarkingLabel = MarkingsStore(canvasId).use(
            state => state.selectedMarkingLabel
        );

        const drawMarkings = useCallback(
            (g: PixiGraphics) => {
                // FIX 1: Najważniejsza linijka - usuwa stare teksty przed rysowaniem nowych
                g.removeChildren(); 
                g.clear();

                markings.forEach(marking => {
                    const markingType = markingTypes.find(
                        t => t.id === marking.typeId
                    );
                    if (!markingType) return;

                    drawMarking(
                        g,
                        selectedMarkingLabel === marking.label,
                        marking,
                        markingType,
                        viewportWidthRatio,
                        viewportHeightRatio,
                        showMarkingLabels,
                        rotation,
                        centerX,
                        centerY,
                    );
                });

                // eslint-disable-next-line no-param-reassign
                g.alpha = alpha ?? (showMarkingLabels ? 1 : 0.5);
            },
            [
                alpha,
                viewportHeightRatio,
                viewportWidthRatio,
                markings,
                selectedMarkingLabel,
                showMarkingLabels,
                markingTypes,
                rotation,
                centerX,
                centerY,
                calibration,
            ]
        );

        useTick(() => {
            if (!isBlinkActive()) return;
            const g = graphicsRef.current;
            if (!g) return;
            drawMarkings(g);
        });

        return <Graphics ref={graphicsRef} draw={drawMarkings} />;
    }
);