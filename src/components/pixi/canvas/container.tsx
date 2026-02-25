import { HTMLAttributes, useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils/shadcn";
import { Toggle } from "@/components/ui/toggle";
import { ImageUp } from "lucide-react";
import { ICON } from "@/lib/utils/const";
import { loadImage, loadImageWithDialog } from "@/lib/utils/viewport/loadImage";
import { useTranslation } from "react-i18next";
import { CanvasToolbarStore } from "@/lib/stores/CanvasToolbar";
import { listen } from "@tauri-apps/api/event";
import { showErrorDialog } from "@/lib/errors/showErrorDialog";
import { Point } from "@/lib/markings/Point";
import { Sprite } from "pixi.js";
import { loadSprite } from "@/lib/utils/viewport/loadSprite";
import {
    emitFitEvents,
    fitWorld,
} from "@/components/pixi/canvas/utils/fit-viewport";
import { useCanvasContext } from "./hooks/useCanvasContext";
import { Canvas } from "./canvas";
import { useGlobalViewport } from "../viewport/hooks/useGlobalViewport";
import { CanvasInfo } from "./canvas-info";

export type CanvasContainerProps = HTMLAttributes<HTMLDivElement>;
export function CanvasContainer({ ...props }: CanvasContainerProps) {
    const { t } = useTranslation();
    const { id } = useCanvasContext();
    const viewport = useGlobalViewport(id, { autoUpdate: true });
    const [divSize, setDivSize] = useState({ width: 0, height: 0 });

    const divRef = useCallback((node: HTMLDivElement | null) => {
        if (!node) return;
        const resizeObserver = new ResizeObserver(() => {
            setDivSize({
                width: node.clientWidth,
                height: node.clientHeight,
            });
        });
        resizeObserver.observe(node);
    }, []);

    const isViewportHidden =
        viewport === null || viewport.children.length === 0;

    const showCanvasInformation = CanvasToolbarStore(id).use(
        state => state.settings.viewport.showInformation
    );

    useEffect(() => {
        const setupTauriFileDropListener = async () => {
            const unlisten = await listen(
                "tauri://drag-drop",
                async (event: {
                    payload: {
                        position: Point;
                        paths: string[];
                    };
                }) => {
                    const targetCanvasId = document
                        .elementsFromPoint(
                            event.payload.position.x,
                            event.payload.position.y
                        )
                        .find(el => el.id.includes("canvas-container-"))
                        ?.id.replace("canvas-container-", "");

                    if (viewport && targetCanvasId === id) {
                        if (event.payload.paths.length !== 1) {
                            showErrorDialog(
                                "Only one file can be dropped at a time."
                            );
                            return;
                        }
                        loadImage(event.payload.paths[0] as string, viewport);
                    }
                }
            );

            // Cleanup listener when component unmounts
            return () => {
                unlisten();
            };
        };

        setupTauriFileDropListener();
    }, [viewport, id]);

    useEffect(() => {
        if (!viewport) return undefined;

        let cancelled = false;
        const setupReloadListener = async () =>
            listen<{
                originalPath: string;
                newPath: string;
            }>("image-reload-requested", async event => {
                if (cancelled) return;

                const { originalPath, newPath } = event.payload;
                const sprite = viewport.children.find(
                    x => x instanceof Sprite
                ) as (Sprite & { path?: string }) | undefined;

                if (
                    !sprite?.path ||
                    sprite.path.replace(/[\\/]/g, "/") !==
                        originalPath.replace(/[\\/]/g, "/")
                ) {
                    return;
                }

                sprite.destroy({
                    children: true,
                    texture: true,
                    baseTexture: true,
                });

                const newSprite = await loadSprite(newPath);
                newSprite.anchor.set(0, 0);
                newSprite.pivot.set(newSprite.width / 2, newSprite.height / 2);
                newSprite.position.set(
                    newSprite.width / 2,
                    newSprite.height / 2
                );
                viewport.addChildAt(newSprite, 0);
                fitWorld(viewport);
                emitFitEvents(viewport, "fit-world");
            });

        let unlistenFn: (() => void) | null = null;
        setupReloadListener().then(fn => {
            if (cancelled) {
                fn();
            } else {
                unlistenFn = fn;
            }
        });

        return () => {
            cancelled = true;
            unlistenFn?.();
        };
    }, [viewport]);

    return (
        <div
            className="w-full h-full relative flex items-center justify-center"
            id={`canvas-container-${id}`}
            ref={divRef}
            {...props}
        >
            {isViewportHidden && viewport !== null && (
                <Toggle
                    size="default"
                    className="size-3/4 flex flex-col overflow-hidden"
                    variant="outline"
                    pressed={false}
                    onClick={() => {
                        loadImageWithDialog(viewport);
                    }}
                >
                    <ImageUp size={64} strokeWidth={ICON.STROKE_WIDTH} />
                    <div>
                        {t("Load forensic mark image", { ns: "tooltip" })}
                    </div>
                </Toggle>
            )}
            <div className={cn("size-full", { hidden: isViewportHidden })}>
                {showCanvasInformation && <CanvasInfo />}
                <Canvas
                    aria-label="canvas"
                    width={divSize.width}
                    height={divSize.height}
                />
            </div>
        </div>
    );
}
