import { useApp } from "@pixi/react";
import { useEffect, useRef } from "react";
import { Viewport as PixiViewport } from "pixi-viewport";
import { CanvasMetadata } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { CanvasUpdater } from "@/lib/stores/CanvasUpdater";
import * as PIXI from "pixi.js";
import { Sprite } from "pixi.js";
import { CanvasToolbarStore } from "@/lib/stores/CanvasToolbar";
import { RotationStore } from "@/lib/stores/Rotation/Rotation";
import { Viewport } from "../viewport/viewport";
import { useThemeController } from "./hooks/useThemeController";
import { useGlobalRefs } from "./hooks/useGlobalRefs";
import { useViewportResizer } from "./hooks/useViewportResizer";

export type PixiAppProps = {
    width: number;
    height: number;
    canvasMetadata: CanvasMetadata;
};
export function PixiApp({ width, height, canvasMetadata }: PixiAppProps) {
    const spriteRef = useRef<Sprite>(null);
    const app = useApp();
    const viewportRef = useRef<PixiViewport>(null);
    const viewport = viewportRef.current;

    const updateCanvas = CanvasUpdater.useDry();

    useThemeController(app);
    useGlobalRefs(canvasMetadata.id, app, viewportRef.current);
    useViewportResizer(viewportRef.current, width, height);

    const scaleMode = CanvasToolbarStore(canvasMetadata.id).use(
        state => state.settings.texture.scaleMode
    );

    const rotation = RotationStore(canvasMetadata.id).use(
        state => state.rotation
    );

    useEffect(() => {
        const updateViewport = () =>
            updateCanvas(canvasMetadata.id, "viewport");
        const newScaleMode = {
            nearest: PIXI.SCALE_MODES.NEAREST,
            linear: PIXI.SCALE_MODES.LINEAR,
        }[scaleMode];
        PIXI.BaseTexture.defaultOptions.scaleMode = newScaleMode;
        if (spriteRef.current === null) return;
        spriteRef.current.texture.baseTexture.scaleMode = newScaleMode;
        updateViewport();
    }, [canvasMetadata.id, scaleMode, updateCanvas, viewport]);

    useEffect(() => {
        if (viewport) {
            const sprite = viewport.children.find(x => x instanceof Sprite) as
                | Sprite
                | undefined;
            if (sprite) {
                sprite.rotation = rotation;
                updateCanvas(canvasMetadata.id, "app");
            }
        }
    }, [viewport, rotation, updateCanvas, canvasMetadata.id]);

    useEffect(() => {
        if (viewport && viewport.plugins.get("wheel")) {
            viewport.plugins.get("wheel")!.options.center = viewport.center;
        }
    }, [viewport, viewport?.center]);

    return <Viewport canvasMetadata={canvasMetadata} ref={viewportRef} />;
}
