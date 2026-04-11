import { Container } from "@pixi/react";
import { useEffect, useState } from "react";
import { FederatedPointerEvent } from "pixi.js";
import {
    DashboardToolbarStore,
    CURSOR_MODES,
} from "@/lib/stores/DashboardToolbar";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { MARKING_CLASS } from "@/lib/markings/MARKING_CLASS";
import { Grid } from "../app/debug/grid";
import { CanvasMetadata } from "../canvas/hooks/useCanvasContext";
import { useGlobalViewport } from "../viewport/hooks/useGlobalViewport";
import { useGlobalApp } from "../app/hooks/useGlobalApp";

export type CrosshairOverlayProps = {
    canvasMetadata: CanvasMetadata;
};

export function CrosshairOverlay({
    canvasMetadata: { id },
}: CrosshairOverlayProps) {
    const viewport = useGlobalViewport(id, { autoUpdate: true });
    const app = useGlobalApp(id);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [isVisible, setIsVisible] = useState(false);
    const cursorMode = DashboardToolbarStore.use(
        state => state.settings.cursor.mode
    );
    const selectedType = MarkingTypesStore.use(state =>
        state.types.find(type => type.id === state.selectedTypeId)
    );

    const ShowCrosshair =
        cursorMode === CURSOR_MODES.MARKING &&
        (selectedType?.markingClass === MARKING_CLASS.BOUNDING_BOX ||
            selectedType?.markingClass === MARKING_CLASS.POLYGON ||
            selectedType?.markingClass === MARKING_CLASS.RECTANGLE ||
            selectedType?.markingClass === MARKING_CLASS.TRIANGLE ||
            selectedType?.markingClass === MARKING_CLASS.POLYLINE) &&
        isVisible;

    useEffect(() => {
        if (!viewport) {
            return () => {};
        }

        const handlePointerMove = (event: FederatedPointerEvent) => {
            setMousePosition({ x: event.global.x, y: event.global.y });
            setIsVisible(true);
        };

        const handlePointerLeave = () => {
            setIsVisible(false);
        };

        viewport.on("pointermove", handlePointerMove);
        viewport.on("pointerleave", handlePointerLeave);

        return () => {
            viewport.off("pointermove", handlePointerMove);
            viewport.off("pointerleave", handlePointerLeave);
        };
    }, [viewport]);

    if (!viewport || !app || !ShowCrosshair) {
        return null;
    }

    return (
        <Container position={{ x: 0, y: 0 }}>
            <Container position={{ x: 0, y: mousePosition.y }}>
                <Grid
                    width={viewport.screenWidth}
                    height={1}
                    color="hsla(133, 86.30%, 48.60%, 0.70)"
                    gridLinesCount={1}
                    gridLinesWidth={1}
                />
            </Container>
            <Container position={{ x: mousePosition.x, y: 0 }}>
                <Grid
                    width={1}
                    height={viewport.screenHeight}
                    color="hsla(133, 86.30%, 48.60%, 0.70)"
                    gridLinesCount={1}
                    gridLinesWidth={1}
                />
            </Container>
        </Container>
    );
}
