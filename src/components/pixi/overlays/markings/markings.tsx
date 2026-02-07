import { Graphics } from "@pixi/react";
import { Graphics as PixiGraphics } from "pixi.js";
import { memo, useCallback } from "react";
import { MarkingsStore } from "@/lib/stores/Markings";
import { MarkingClass } from "@/lib/markings/MarkingClass";
import { ShallowViewportStore } from "@/lib/stores/ShallowViewport";
import { CanvasToolbarStore } from "@/lib/stores/CanvasToolbar";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { CANVAS_ID } from "../../canvas/hooks/useCanvasContext";
import { drawMarking } from "./marking.utils";

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
        const showMarkingLabels = CanvasToolbarStore(canvasId).use(
            state => state.settings.markings.showLabels
        );

        // oblicz proporcje viewportu do świata tylko na evencie zoomed, dla lepszej wydajności (nie ma sensu liczyć tego na każdym renderze
        // bo przy samym ruchu nie zmieniają się proporcje viewportu do świata, tylko przy zoomie)
        const { viewportWidthRatio, viewportHeightRatio } =
            ShallowViewportStore(canvasId).use(
                ({
                    size: {
                        screenWorldWidth,
                        screenWorldHeight,
                        worldWidth,
                        worldHeight,
                    },
                }) => ({
                    viewportWidthRatio: screenWorldWidth / worldWidth,
                    viewportHeightRatio: screenWorldHeight / worldHeight,
                })
            );

        const selectedMarkingLabel = MarkingsStore(canvasId).use(
            state => state.selectedMarkingLabel
        );

        const markingTypes = MarkingTypesStore.use(state => state.types);

        const drawMarkings = useCallback(
            (g: PixiGraphics) => {
                g.children
                    .find(x => x.name === "markingsContainer")
                    ?.destroy({
                        children: true,
                        texture: true,
                        baseTexture: true,
                    });

                const markingsContainer = new PixiGraphics();
                markingsContainer.name = "markingsContainer";
                g.addChild(markingsContainer);
                markings.forEach(marking => {
                    const markingType = markingTypes.find(
                        t => t.id === marking.typeId
                    );
                    if (!markingType) return;
                    drawMarking(
                        markingsContainer as PixiGraphics,
                        selectedMarkingLabel === marking.label,
                        marking,
                        markingType,
                        viewportWidthRatio,
                        viewportHeightRatio,
                        showMarkingLabels,
                        rotation,
                        centerX,
                        centerY
                    );
                });

                // Set the alpha to provided value or based on showMarkingLabels config
                // eslint-disable-next-line no-param-reassign
                g.alpha = alpha ?? showMarkingLabels ? 1 : 0.5;
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
            ]
        );

        return <Graphics draw={drawMarkings} />;
    }
);
