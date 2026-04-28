/* eslint-disable sonarjs/cognitive-complexity */
import React, { RefObject } from "react";
import { cn } from "@/lib/utils/shadcn";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import type { FftStatus } from "./fftTypes";

interface ImagePanesProps {
    // shared
    imageUrl: string;
    imagePath: string | null;
    isFftActive: boolean;
    fftStatus: FftStatus;

    // left pane — original image
    containerRef: RefObject<HTMLDivElement>;
    imageRef: RefObject<HTMLImageElement>;
    spectrumCanvasRef: RefObject<HTMLCanvasElement>;
    brightness: number;
    contrast: number;
    zoom: number;
    pan: { x: number; y: number };
    isDragging: boolean;
    onWheel: (e: React.WheelEvent<HTMLButtonElement>) => void;
    onMouseDown: (e: React.MouseEvent<HTMLButtonElement>) => void;
    onMouseMove: (e: React.MouseEvent<HTMLButtonElement>) => void;
    onMouseUp: () => void;
    onDoubleClick: () => void;
    onResetZoom: () => void;

    // right pane — FFT preview
    fftContainerRef: RefObject<HTMLDivElement>;
    previewCanvasRef: RefObject<HTMLCanvasElement>;
    rightPanZoom: number;
    rightPan: { x: number; y: number };
    isRightDragging: boolean;
    onRightWheel: (e: React.WheelEvent<HTMLButtonElement>) => void;
    onRightMouseDown: (e: React.MouseEvent<HTMLButtonElement>) => void;
    onRightMouseMove: (e: React.MouseEvent<HTMLButtonElement>) => void;
    onRightMouseUp: () => void;
    onRightDoubleClick: () => void;
    onResetRightZoom: () => void;
}

const TRANSFORM_ORIGIN = "center center";

function ImagePanes({
    imageUrl,
    imagePath,
    isFftActive,
    fftStatus,
    containerRef,
    imageRef,
    spectrumCanvasRef,
    brightness,
    contrast,
    zoom,
    pan,
    isDragging,
    onWheel,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onDoubleClick,
    onResetZoom,
    fftContainerRef,
    previewCanvasRef,
    rightPanZoom,
    rightPan,
    isRightDragging,
    onRightWheel,
    onRightMouseDown,
    onRightMouseMove,
    onRightMouseUp,
    onRightDoubleClick,
    onResetRightZoom,
}: ImagePanesProps) {
    const { t } = useTranslation(["tooltip", "keywords"]);
    const isFftReady = isFftActive && fftStatus === "ready";
    const isFftLoading =
        isFftActive && (fftStatus === "loading" || fftStatus === "processing");

    return (
        <div
            className={cn(
                "flex-1 w-full flex flex-row overflow-hidden mb-4 relative rounded-xl transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
                isFftActive ? "gap-4" : "gap-0"
            )}
        >
            {/* ── Left pane: original image ── */}
            <div
                ref={containerRef}
                className={cn(
                    "flex items-center justify-center overflow-hidden relative bg-black/10 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    isFftActive
                        ? "w-[calc(50%-0.5rem)] rounded-xl"
                        : "w-full rounded-xl"
                )}
            >
                <div
                    className={cn(
                        "absolute inset-0 pointer-events-none transition-all duration-500 ease-out",
                        isFftLoading
                            ? "opacity-100 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),rgba(255,255,255,0)_60%)]"
                            : "opacity-0"
                    )}
                />
                <button
                    type="button"
                    className="absolute inset-0 z-20 cursor-grab active:cursor-grabbing bg-transparent border-0 p-0"
                    aria-label="Image viewer with zoom and pan controls"
                    onWheel={onWheel}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseUp}
                    onDoubleClick={onDoubleClick}
                    onKeyDown={e => {
                        if (e.key === "Escape") onResetZoom();
                    }}
                />
                <img
                    ref={imageRef}
                    src={imageUrl}
                    alt={imagePath || "Loaded image"}
                    className="max-w-full max-h-full object-contain select-none pointer-events-none"
                    style={{
                        opacity: isFftActive ? (isFftReady ? 0.08 : 0) : 1,
                        filter: `brightness(${brightness / 100}) contrast(${contrast / 100})`,
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: TRANSFORM_ORIGIN,
                        transition: isDragging
                            ? "none"
                            : "transform 0.1s ease-out, opacity 0.35s ease-out, filter 0.35s ease-out",
                    }}
                    draggable={false}
                />
                {/* Spectrum canvas — overlays the image, same transform */}
                <canvas
                    ref={spectrumCanvasRef}
                    className="absolute pointer-events-none z-30"
                    style={{
                        opacity: isFftReady ? 1 : 0,
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: TRANSFORM_ORIGIN,
                        transition: isDragging
                            ? "none"
                            : "transform 0.1s ease-out, opacity 0.35s ease-out",
                    }}
                />
                <div
                    className={cn(
                        "absolute inset-0 z-10 pointer-events-none flex items-center justify-center transition-all duration-300",
                        isFftLoading ? "opacity-100" : "opacity-0"
                    )}
                >
                    <div className="rounded-full border border-border/40 bg-background/70 px-4 py-2 backdrop-blur-md shadow-lg">
                        <div className="flex items-center gap-2 text-xs text-foreground/90">
                            <span className="flex gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.2s]" />
                                <span className="h-1.5 w-1.5 rounded-full bg-primary/80 animate-bounce [animation-delay:-0.1s]" />
                                <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" />
                            </span>
                            <span>{t("Loading...", { ns: "keywords" })}</span>
                        </div>
                    </div>
                </div>
                {zoom !== 1 && (
                    <div className="absolute top-2 right-2 z-30">
                        <Button
                            onClick={onResetZoom}
                            variant="outline"
                            size="sm"
                            className="bg-background/80 backdrop-blur-sm"
                        >
                            {t("Reset Zoom", { ns: "tooltip" })}
                        </Button>
                    </div>
                )}
            </div>

            {/* ── Right pane: FFT preview ── */}
            <div
                ref={fftContainerRef}
                className={cn(
                    "flex items-center justify-center overflow-hidden relative bg-black/50 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    isFftActive
                        ? "w-[calc(50%-0.5rem)] opacity-100 border border-primary/20 rounded-xl"
                        : "w-0 opacity-0 border-0"
                )}
            >
                {isFftActive && (
                    <>
                        <button
                            type="button"
                            className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing bg-transparent border-0 p-0"
                            aria-label="FFT preview with zoom and pan controls"
                            onWheel={onRightWheel}
                            onMouseDown={onRightMouseDown}
                            onMouseMove={onRightMouseMove}
                            onMouseUp={onRightMouseUp}
                            onMouseLeave={onRightMouseUp}
                            onDoubleClick={onRightDoubleClick}
                        />
                        <canvas
                            ref={previewCanvasRef}
                            className="max-w-full max-h-full z-10"
                            style={{
                                opacity: isFftReady ? 1 : 0.35,
                                transform: `translate(${rightPan.x}px, ${rightPan.y}px) scale(${rightPanZoom})`,
                                transformOrigin: TRANSFORM_ORIGIN,
                                transition: isRightDragging
                                    ? "none"
                                    : "transform 0.1s ease-out, opacity 0.35s ease-out",
                            }}
                        />
                        <div
                            className={cn(
                                "absolute inset-0 z-20 pointer-events-none bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),rgba(255,255,255,0)_55%)] transition-opacity duration-500",
                                isFftReady ? "opacity-100" : "opacity-0"
                            )}
                        />
                        {rightPanZoom !== 1 && (
                            <div className="absolute top-2 right-2 z-30">
                                <Button
                                    onClick={onResetRightZoom}
                                    variant="outline"
                                    size="sm"
                                    className="bg-background/80 backdrop-blur-sm"
                                >
                                    {t("Reset Zoom", { ns: "tooltip" })}
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
export default ImagePanes;
