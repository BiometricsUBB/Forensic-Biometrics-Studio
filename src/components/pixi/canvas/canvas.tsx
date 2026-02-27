import * as PIXI from "pixi.js";
import { Stage } from "@pixi/react";
import { useCanvasContext } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { IS_DEV_ENVIRONMENT } from "@/lib/utils/const";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/shadcn";
import { CenterMarkOverlay } from "@/components/pixi/overlays/center-mark-overlay";
import { CachedViewportStore } from "@/lib/stores/CachedViewport";
import { PixiApp } from "../app/app";
import { DebugOverlay } from "../overlays/debug-overlay";
import { MarkingOverlay } from "../overlays/marking-overlay";
import { CrosshairOverlay } from "../overlays/crosshair-overlay";
import { TracingOverlay } from "../overlays/tracing-overlay";

function range(min: number, max: number): number[] {
    const len = max - min + 1;
    const arr = new Array(len);
    for (let i = 0; i < len; i += 1) {
        // eslint-disable-next-line security/detect-object-injection
        arr[i] = min + i;
    }
    return arr;
}

export type CanvasProps = Omit<Stage["props"], "children">;
export function Canvas({ options, className, ...props }: CanvasProps) {
    const canvasMetadata = useCanvasContext();
    const backgroundColor = getComputedStyle(document.body).getPropertyValue(
        "--background"
    );
    const [isFontLoaded, setIsFontLoaded] = useState(false);
    const { isDragging } = CachedViewportStore(canvasMetadata.id).use();

    useEffect(() => {
        PIXI.BaseTexture.defaultOptions.scaleMode = 1;
        // załaduj bitmapowe czcionki, rozmiary 6-32 i 64
        const fontSizes = [...range(6, 32), 64];
        Promise.all(
            fontSizes.map(fontSize =>
                PIXI.Assets.load(`/fonts/Cousine/cousine${fontSize}.fnt`)
            )
        ).then(() => {
            setIsFontLoaded(true);
        });
    }, []);

    const defaultOptions: typeof options = {
        background: `hsl(${backgroundColor})`,
        antialias: true,
        autoDensity: true,
        autoStart: true,
        powerPreference: "high-performance",
        resolution: 1,
        ...options,
        ...props,
    };

    if (!isFontLoaded) return null;

    return (
        <Stage
            {...props}
            options={defaultOptions}
            className={cn(
                {
                    "!cursor-auto": !isDragging,
                    "!cursor-move": isDragging,
                },
                className
            )}
        >
            {IS_DEV_ENVIRONMENT && (
                <DebugOverlay canvasMetadata={canvasMetadata} />
            )}
            <PixiApp
                width={props.width ?? 0}
                height={props.height ?? 0}
                canvasMetadata={canvasMetadata}
            />
            <TracingOverlay canvasMetadata={canvasMetadata} />
            <MarkingOverlay canvasMetadata={canvasMetadata} />
            <CrosshairOverlay canvasMetadata={canvasMetadata} />
            {isDragging && (
                <CenterMarkOverlay canvasMetadata={canvasMetadata} />
            )}
        </Stage>
    );
}
