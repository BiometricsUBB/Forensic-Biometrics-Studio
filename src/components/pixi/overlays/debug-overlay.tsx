import { Container } from "@pixi/react";
import { ShallowViewportStore } from "@/lib/stores/ShallowViewport";
import * as PIXI from "pixi.js";
import { Grid } from "../app/debug/grid";
import { CanvasMetadata } from "../canvas/hooks/useCanvasContext";
import { useGlobalViewport } from "../viewport/hooks/useGlobalViewport";
import { useGlobalApp } from "../app/hooks/useGlobalApp";
import { getViewportGlobalPosition } from "./utils/get-viewport-local-position";

export type DebugOverlayProps = {
    canvasMetadata: CanvasMetadata;
};
export function DebugOverlay({ canvasMetadata: { id } }: DebugOverlayProps) {
    const viewport = useGlobalViewport(id, { autoUpdate: true });
    const app = useGlobalApp(id);

    // Needed to update the overlay in some cases (e.g. when locked) — the hook
    // below re-renders on viewport size changes; without it the overlay would
    // miss certain viewport-resize events.
    ShallowViewportStore(id).use(({ size }) => ({
        size,
    }));

    if (viewport === null || app == null) {
        return null;
    }

    const sprite = viewport.children.find(x => x instanceof PIXI.Sprite) as
        | PIXI.Sprite
        | undefined;
    if (!sprite) return null;

    const imageWidth = sprite.width;
    const imageHeight = sprite.height;
    const imageX = sprite.x - sprite.pivot.x;
    const imageY = sprite.y - sprite.pivot.y;

    return (
        <>
            <Container position={getViewportGlobalPosition(viewport)}>
                <Container position={{ x: imageX, y: imageY }}>
                    <Grid
                        width={viewport.width}
                        height={viewport.height}
                        color="hsla(0, 50%, 50%, 0.5)"
                        gridLinesCount={3}
                    />
                </Container>
            </Container>
            <Container position={getViewportGlobalPosition(viewport)}>
                <Container position={{ x: imageX, y: imageY }}>
                    <Grid
                        width={imageWidth}
                        height={imageHeight}
                        color="hsla(90, 50%, 50%, 0.5)"
                        gridLinesCount={3}
                    />
                </Container>
            </Container>
        </>
    );
}
