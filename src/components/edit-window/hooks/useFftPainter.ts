import React, { RefObject, useEffect, useRef } from "react";
import { FFTResult } from "@/lib/fftProcessor";
import { BrushShape, FftStatus, InteractionMode } from "../fft/fftTypes";
import { getCanvasCoords } from "../fft/fftCanvasUtils";

// this file contains mouse event lifecycle

export function useFftPainter({
    isActive,
    status,
    interactionMode,
    spectrumCanvasRef,
    fftResultRef,
    maskCanvasRef,
    brushSizeRef,
    brushShapeRef,
    onRedrawOverlay,
    onPreviewUpdate,
    onWheel,
    onMiddleDrag,
}: {
    isActive: boolean;
    status: FftStatus;
    interactionMode: InteractionMode;
    spectrumCanvasRef: RefObject<HTMLCanvasElement | null>;
    fftResultRef: RefObject<FFTResult | null>;
    maskCanvasRef: RefObject<HTMLCanvasElement | null>;
    brushSizeRef: React.MutableRefObject<number>;
    brushShapeRef: React.MutableRefObject<BrushShape>;
    onRedrawOverlay: () => void;
    onPreviewUpdate: () => void;
    onWheel?: (e: WheelEvent) => void;
    onMiddleDrag?: (dx: number, dy: number) => void;
}) {
    const isPanningRef = useRef(false);
    const isDrawingRef = useRef(false);
    const lastPanPosRef = useRef({ x: 0, y: 0 });
    const callbacksRef = useRef({ onWheel, onMiddleDrag });

    useEffect(() => {
        callbacksRef.current = { onWheel, onMiddleDrag };
    }, [onWheel, onMiddleDrag]);

    useEffect(() => {
        const canvas = spectrumCanvasRef.current;
        if (!canvas || !isActive || status !== "ready") return undefined;

        canvas.style.cursor =
            interactionMode === "draw" || interactionMode === "erase"
                ? "crosshair"
                : "grab";

        const paintAt = (cx: number, cy: number) => {
            const fftResult = fftResultRef.current;
            const maskCvs = maskCanvasRef.current;
            if (!fftResult || !maskCvs) return;

            const ctx = maskCvs.getContext("2d");
            if (!ctx) return;

            const scaleX = fftResult.width / canvas.width;
            const scaleY = fftResult.height / canvas.height;
            const brushRadius =
                (brushSizeRef.current / 2) * Math.max(scaleX, scaleY);

            ctx.globalCompositeOperation =
                interactionMode === "erase" ? "destination-out" : "source-over";
            ctx.fillStyle =
                interactionMode === "erase" ? "rgba(0,0,0,1)" : "#c00000";

            const paintEllipseAt = (x: number, y: number) => {
                ctx.beginPath();
                if (brushShapeRef.current === "oval") {
                    ctx.ellipse(
                        x,
                        y,
                        brushRadius,
                        brushRadius / 2,
                        0,
                        0,
                        Math.PI * 2
                    );
                } else {
                    ctx.arc(x, y, brushRadius, 0, Math.PI * 2);
                }
                ctx.fill();
            };

            paintEllipseAt(cx * scaleX, cy * scaleY);
            // mirror stroke symmetrically (FFT is centro-symmetric)
            paintEllipseAt(
                maskCvs.width - cx * scaleX,
                maskCvs.height - cy * scaleY
            );

            onRedrawOverlay();
        };

        let tickingMask = false;
        let lastMoveEvent: MouseEvent | null = null;
        let requiresPreviewUpdate = false;

        const onDown = (e: MouseEvent) => {
            if (interactionMode === "draw" || interactionMode === "erase") {
                if (e.button !== 0) return;
                isDrawingRef.current = true;
                const { cx, cy } = getCanvasCoords(e, canvas);
                paintAt(cx, cy);
                requiresPreviewUpdate = true;
            } else if (
                interactionMode === "pan" &&
                (e.button === 0 || e.button === 1)
            ) {
                e.preventDefault();
                isPanningRef.current = true;
                lastPanPosRef.current = { x: e.clientX, y: e.clientY };
                canvas.style.cursor = "grabbing";
            }
        };

        const onMove = (e: MouseEvent) => {
            lastMoveEvent = e;
            if (!tickingMask) {
                requestAnimationFrame(() => {
                    if (lastMoveEvent) {
                        const { cx, cy } = getCanvasCoords(
                            lastMoveEvent,
                            canvas
                        );
                        if (
                            isDrawingRef.current &&
                            (interactionMode === "draw" ||
                                interactionMode === "erase")
                        ) {
                            paintAt(cx, cy);
                            requiresPreviewUpdate = true;
                        } else if (isPanningRef.current) {
                            const dx =
                                lastMoveEvent.clientX - lastPanPosRef.current.x;
                            const dy =
                                lastMoveEvent.clientY - lastPanPosRef.current.y;
                            lastPanPosRef.current = {
                                x: lastMoveEvent.clientX,
                                y: lastMoveEvent.clientY,
                            };
                            callbacksRef.current.onMiddleDrag?.(dx, dy);
                        }
                    }
                    tickingMask = false;
                });
                tickingMask = true;
            }
        };

        const flushAndUp = (e: MouseEvent) => {
            if (
                lastMoveEvent &&
                tickingMask &&
                isDrawingRef.current &&
                (interactionMode === "draw" || interactionMode === "erase")
            ) {
                const { cx, cy } = getCanvasCoords(lastMoveEvent, canvas);
                paintAt(cx, cy);
                requiresPreviewUpdate = true;
                lastMoveEvent = null;
            }
            if (isDrawingRef.current && requiresPreviewUpdate) {
                e.preventDefault();
                onPreviewUpdate();
                requiresPreviewUpdate = false;
            }
            isDrawingRef.current = false;
            isPanningRef.current = false;
            if (interactionMode === "pan") canvas.style.cursor = "grab";
        };

        const onMiddleDown = (e: MouseEvent) => {
            if (e.button !== 1) return;
            e.preventDefault();
            isPanningRef.current = true;
            lastPanPosRef.current = { x: e.clientX, y: e.clientY };
            if (interactionMode === "draw" || interactionMode === "erase")
                canvas.style.cursor = "grabbing";
        };

        const onMiddleUp = (e: MouseEvent) => {
            if (e.button !== 1) return;
            isPanningRef.current = false;
            if (interactionMode === "draw" || interactionMode === "erase")
                canvas.style.cursor = "crosshair";
        };

        const onLeave = (e: MouseEvent) => {
            if (isDrawingRef.current && requiresPreviewUpdate) {
                onPreviewUpdate();
                requiresPreviewUpdate = false;
            }
            flushAndUp(e);
            onMiddleUp(e);
            onRedrawOverlay();
        };

        const onWheelForward = (e: WheelEvent) => {
            e.preventDefault();
            callbacksRef.current.onWheel?.(e);
        };

        canvas.addEventListener("mousedown", onDown);
        canvas.addEventListener("mousedown", onMiddleDown);
        canvas.addEventListener("mousemove", onMove);
        canvas.addEventListener("mouseup", flushAndUp);
        canvas.addEventListener("mouseup", onMiddleUp);
        canvas.addEventListener("mouseleave", onLeave);
        canvas.addEventListener("wheel", onWheelForward, { passive: false });

        return () => {
            canvas.removeEventListener("mousedown", onDown);
            canvas.removeEventListener("mousedown", onMiddleDown);
            canvas.removeEventListener("mousemove", onMove);
            canvas.removeEventListener("mouseup", flushAndUp);
            canvas.removeEventListener("mouseup", onMiddleUp);
            canvas.removeEventListener("mouseleave", onLeave);
            canvas.removeEventListener("wheel", onWheelForward);
        };
    }, [isActive, status, interactionMode, spectrumCanvasRef]);
}
