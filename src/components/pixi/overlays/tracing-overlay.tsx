import { Container, Graphics } from "@pixi/react";
import * as PIXI from "pixi.js";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { TracingPath, TracingStore } from "@/lib/stores/Tracing/Tracing.store";
import { DashboardToolbarStore } from "@/lib/stores/DashboardToolbar";
import { CanvasMetadata } from "../canvas/hooks/useCanvasContext";
import { useGlobalViewport } from "../viewport/hooks/useGlobalViewport";
import { getViewportPosition } from "./utils/get-viewport-local-position";

// Simple ID generator to avoid crypto issues
const generateId = () =>
    Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

const PathGraphics = memo(({ path }: { path: TracingPath }) => {
    const alphaFilter = new PIXI.AlphaFilter(path.opacity ?? 1);

    const draw = useCallback(
        (g: PIXI.Graphics) => {
            g.clear();
            g.lineStyle({
                width: path.brushSize,
                color: Number(path.color.replace("#", "0x")),
                alpha: 1,
                join: PIXI.LINE_JOIN.ROUND,
                cap: PIXI.LINE_CAP.ROUND,
            });

            if (!path.points || path.points.length === 0) return;

            const [p0, ...rest] = path.points;
            if (p0) g.moveTo(p0.x, p0.y);

            // Avoid for..of / loops (project eslint rules)
            rest.forEach(p => {
                if (p) g.lineTo(p.x, p.y);
            });
        },
        [path.points, path.color, path.brushSize]
    );

    return <Graphics draw={draw} filters={[alphaFilter]} />;
});
PathGraphics.displayName = "PathGraphics";

export type TracingOverlayProps = {
    canvasMetadata: CanvasMetadata;
};

export function TracingOverlay({ canvasMetadata }: TracingOverlayProps) {
    const { id: canvasId } = canvasMetadata;
    const viewport = useGlobalViewport(canvasId, { autoUpdate: true });

    const { isEnabled, color, opacity, brushSize, mode } =
        DashboardToolbarStore.use(
            state =>
                state.settings.tracing ?? {
                    isEnabled: false,
                    color: "#ff0000",
                    opacity: 1,
                    brushSize: 2,
                    mode: "free",
                }
        );

    const tracingStore = TracingStore(canvasId);

    const { paths } = tracingStore(state => ({ paths: state.paths }));
    const { addPath, undo, redo, snapshot } = tracingStore(state => ({
        addPath: state.addPath,
        undo: state.undo,
        redo: state.redo,
        snapshot: state.snapshot,
    }));

    useEffect(() => {
        const handleUndo = () => undo();
        const handleRedo = () => redo();

        if (isEnabled) {
            window.addEventListener("tracing:undo", handleUndo);
            window.addEventListener("tracing:redo", handleRedo);
        }

        // Always return a cleanup function (consistent-return)
        return () => {
            window.removeEventListener("tracing:undo", handleUndo);
            window.removeEventListener("tracing:redo", handleRedo);
        };
    }, [isEnabled, undo, redo]);

    const [currentPathId, setCurrentPathId] = useState<string | null>(null);
    const lastActivePathIdRef = useRef<string | null>(null);

    const onPointerDown = useCallback(
        (e: PIXI.FederatedPointerEvent): void => {
            if (!isEnabled || !viewport) return;

            // Right click to finish line sequence
            if (e.button === 2) {
                lastActivePathIdRef.current = null;
                return;
            }

            // Prevent viewport dragging when drawing
            viewport.plugins.pause("drag");

            const point = viewport.toLocal(e.global);
            let startPoint = { x: point.x, y: point.y };

            // For Line mode, check if we can continue from the last path
            if (mode === "line") {
                const { paths: existingPaths } = tracingStore.getState();
                const lastPath = existingPaths[existingPaths.length - 1];

                if (
                    lastPath &&
                    lastPath.id === lastActivePathIdRef.current &&
                    lastPath.color === color &&
                    lastPath.opacity === opacity &&
                    lastPath.brushSize === brushSize
                ) {
                    const lastPoint =
                        lastPath.points[lastPath.points.length - 1];
                    if (lastPoint)
                        startPoint = { x: lastPoint.x, y: lastPoint.y };
                }
            }

            const newPathId = generateId();
            setCurrentPathId(newPathId);
            lastActivePathIdRef.current = newPathId;

            snapshot();

            addPath({
                id: newPathId,
                points:
                    mode === "line"
                        ? [startPoint, { x: point.x, y: point.y }]
                        : [{ x: point.x, y: point.y }],
                color,
                opacity,
                brushSize,
            });
        },
        [
            isEnabled,
            viewport,
            mode,
            tracingStore,
            color,
            opacity,
            brushSize,
            snapshot,
            addPath,
        ]
    );

    const onPointerMove = useCallback(
        (e: PIXI.FederatedPointerEvent): void => {
            if (!isEnabled || !currentPathId || !viewport) return;

            const point = viewport.toLocal(e.global);

            tracingStore.getState().set(state => {
                const path = state.paths.find(p => p.id === currentPathId);

                if (path) {
                    if (mode === "line") {
                        if (path.points.length > 1) {
                            path.points[path.points.length - 1] = {
                                x: point.x,
                                y: point.y,
                            };
                        }
                    } else {
                        path.points.push({ x: point.x, y: point.y });
                    }
                }
            });
        },
        [isEnabled, currentPathId, viewport, mode, tracingStore]
    );

    const onPointerUp = useCallback((): void => {
        if (!isEnabled || !viewport) return;
        viewport.plugins.resume("drag");
        setCurrentPathId(null);
    }, [isEnabled, viewport]);

    if (!viewport) return null;

    return (
        <Container
            position={getViewportPosition(viewport)}
            scale={viewport.scale}
            rotation={viewport.rotation}
            pivot={viewport.pivot}
            eventMode={isEnabled ? "static" : "none"}
            onpointerdown={onPointerDown}
            onpointermove={onPointerMove}
            onpointerup={onPointerUp}
            onpointerupoutside={onPointerUp}
        >
            <Graphics
                draw={g => {
                    g.clear();
                    g.beginFill(0x000000, 0.0001);
                    g.drawRect(-50000, -50000, 100000, 100000);
                    g.endFill();
                }}
            />

            {paths.map(path => (
                <PathGraphics key={path.id} path={path} />
            ))}
        </Container>
    );
}
