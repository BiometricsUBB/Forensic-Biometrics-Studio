import { Container } from "@pixi/react";
import { MarkingsStore } from "@/lib/stores/Markings";
import { AutoRotateStore } from "@/lib/stores/AutoRotate/AutoRotate";
import { MeasurementStore } from "@/lib/stores/Measurement/Measurement";
import { RotationStore } from "@/lib/stores/Rotation/Rotation";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { ShallowViewportStore } from "@/lib/stores/ShallowViewport";
import * as PIXI from "pixi.js";
import { CanvasMetadata } from "../canvas/hooks/useCanvasContext";
import { useGlobalViewport } from "../viewport/hooks/useGlobalViewport";
import { useGlobalApp } from "../app/hooks/useGlobalApp";
import { getViewportPosition } from "./utils/get-viewport-local-position";
import { Markings } from "./markings/markings";

export type MarkingOverlayProps = {
    canvasMetadata: CanvasMetadata;
};

export function MarkingOverlay({ canvasMetadata }: MarkingOverlayProps) {
    const { id: canvasId } = canvasMetadata;
    const viewport = useGlobalViewport(canvasId, { autoUpdate: true });
    const app = useGlobalApp(canvasId);

    const { markings } = MarkingsStore(canvasId).use(
        state => ({
            markings: state.markings,
            hash: state.markingsHash,
        }),
        (oldState, newState) => {
            return oldState.hash === newState.hash;
        }
    );

    const hiddenTypes = MarkingTypesStore.use(state => state.hiddenTypes);

    const visibleMarkings = markings.filter(
        marking => !hiddenTypes.includes(marking.typeId)
    );

    const temporaryMarking = MarkingsStore(canvasId).use(
        state => state.temporaryMarking
    );

    const tempAutoRotateLine = AutoRotateStore.use(
        // eslint-disable-next-line security/detect-object-injection
        state => state.tempLines[canvasId]
    );

    const finishedAutoRotateLine = AutoRotateStore.use(
        // eslint-disable-next-line security/detect-object-injection
        state => state.finishedLines[canvasId]
    );

    const tempMeasurementLine = MeasurementStore.use(
        // eslint-disable-next-line security/detect-object-injection
        state => state.tempLines[canvasId]
    );

    const finishedMeasurementLine = MeasurementStore.use(
        // eslint-disable-next-line security/detect-object-injection
        state => state.finishedLines[canvasId]
    );

    const rotation = RotationStore(canvasId).use(state => state.rotation);

    const { viewportWidthRatio, viewportHeightRatio } = ShallowViewportStore(
        canvasId
    ).use(
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

    if (viewport === null || app == null) {
        return null;
    }

    const sprite = viewport.children.find(x => x instanceof PIXI.Sprite) as
        | PIXI.Sprite
        | undefined;

    const centerX = sprite ? (sprite.width / 2) * viewportWidthRatio : 0;
    const centerY = sprite ? (sprite.height / 2) * viewportHeightRatio : 0;

    return (
        <Container position={getViewportPosition(viewport)}>
            <Markings
                canvasId={canvasId}
                markings={visibleMarkings}
                rotation={rotation}
                centerX={centerX}
                centerY={centerY}
            />
            {/* If a marking is being created, display it on top of the other markings */}
            {temporaryMarking && (
                <Markings
                    canvasId={canvasId}
                    markings={[temporaryMarking]}
                    alpha={1}
                    rotation={rotation}
                    centerX={centerX}
                    centerY={centerY}
                />
            )}
            {/* If auto rotate line is being drawn, display it */}
            {tempAutoRotateLine && (
                <Markings
                    canvasId={canvasId}
                    markings={[tempAutoRotateLine]}
                    alpha={1}
                    rotation={rotation}
                    centerX={centerX}
                    centerY={centerY}
                />
            )}
            {/* If finished auto rotate line exists, display it */}
            {finishedAutoRotateLine && (
                <Markings
                    canvasId={canvasId}
                    markings={[finishedAutoRotateLine]}
                    alpha={1}
                    rotation={rotation}
                    centerX={centerX}
                    centerY={centerY}
                />
            )}
            {/* If measurement line is being drawn, display it */}
            {tempMeasurementLine && (
                <Markings
                    canvasId={canvasId}
                    markings={[tempMeasurementLine]}
                    alpha={1}
                    rotation={rotation}
                    centerX={centerX}
                    centerY={centerY}
                />
            )}
            {/* If finished measurement line exists, display it */}
            {finishedMeasurementLine && (
                <Markings
                    canvasId={canvasId}
                    markings={[finishedMeasurementLine]}
                    alpha={1}
                    rotation={rotation}
                    centerX={centerX}
                    centerY={centerY}
                />
            )}
        </Container>
    );
}
