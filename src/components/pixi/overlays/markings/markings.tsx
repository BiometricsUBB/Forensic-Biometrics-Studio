import { Graphics } from "@pixi/react";
import { Graphics as PixiGraphics } from "pixi.js";
import { memo, useCallback } from "react";
import { MarkingsStore } from "@/lib/stores/Markings";
import { MarkingClass } from "@/lib/markings/MarkingClass";
import { MARKING_CLASS } from "@/lib/markings/MARKING_CLASS";
import { MarkingType } from "@/lib/markings/MarkingType";
import { ShallowViewportStore } from "@/lib/stores/ShallowViewport";
import { CanvasToolbarStore } from "@/lib/stores/CanvasToolbar";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { CANVAS_ID } from "../../canvas/hooks/useCanvasContext";
import { drawMarking } from "./marking.utils";

const MEASUREMENT_TOOL_TYPE_ID = "__measurement__";

const MEASUREMENT_TOOL_MARKING_TYPE: MarkingType = {
    id: MEASUREMENT_TOOL_TYPE_ID,
    name: "measurement-tool",
    displayName: "Measurement",
    markingClass: MARKING_CLASS.MEASUREMENT,
    backgroundColor: "#ffff00",
    textColor: "#ffff00",
    size: 2,
    category: "fingerprint" as MarkingType["category"],
};

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

        const calibration = MarkingsStore(canvasId).use(
            state => state.calibration
        );

        
            ShallowViewportStore(canvasId).use(state => ({
                viewportWidthRatio:
                    state.size.screenWorldWidth / state.size.worldWidth,
                viewportHeightRatio:
                    state.size.screenWorldHeight / state.size.worldHeight,
            }));

        const markingTypes = MarkingTypesStore.use(state => state.types);

        const selectedMarkingLabel = MarkingsStore(canvasId).use(
            state => state.selectedMarkingLabel
        );

        const drawMarkings = useCallback(
            (g: PixiGraphics) => {
                g.removeChildren();
                g.clear();

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
                    let markingType: MarkingType | undefined;
                    if (marking.typeId === MEASUREMENT_TOOL_TYPE_ID) {
                        markingType = MEASUREMENT_TOOL_MARKING_TYPE;
                    } else {
                        markingType = markingTypes.find(
                            t => t.id === marking.typeId
                        );
                    }
                    if (!markingType) return;
                    drawMarking(
                        g,
                        selectedMarkingLabel === marking.label,
                        marking,
                        markingType,
                        viewportWidthRatio,
                        viewportHeightRatio,
                        showMarkingLabels,
                        calibration,
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
                calibration,
            ]
        );

        return <Graphics draw={drawMarkings} />;
    }
);
