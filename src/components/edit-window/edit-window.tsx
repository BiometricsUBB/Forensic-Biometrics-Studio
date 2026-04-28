import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { WindowControls } from "@/components/menu/window-controls";
import { Menubar } from "@/components/ui/menubar";
import { cn } from "@/lib/utils/shadcn";
import { ICON } from "@/lib/utils/const";
import { Edit } from "lucide-react";
import { useSettingsSync } from "@/lib/hooks/useSettingsSync";
import ImageDpiControls from "./dpi/image-dpi-controls";
import ImagePanes from "./fft/ImagePanes";
import { useFftWorkspace } from "./hooks/useFftWorkspace";

import { useImagePanZoom } from "./hooks/useImagePanZoom";
import { useImageIO } from "./hooks/useImageIO";
import { useSyncedElement } from "./hooks/useElementSync";

import { SidebarAdjustments } from "./components/SidebarAdjustments";
import { SidebarTools } from "./components/SidebarTools";
import { SidebarFFT } from "./components/SidebarFFT";

interface EditWindowContentProps {
    imageRef?: React.RefObject<HTMLImageElement>;
    spectrumCanvasRef?: React.RefObject<HTMLCanvasElement>;
    previewCanvasRef?: React.RefObject<HTMLCanvasElement>;
    onFftApply?: (dataUrl: string) => void;
}

function EditWindowContent({
    imageRef: providedImageRef,
    spectrumCanvasRef: providedSpectrumCanvasRef,
    previewCanvasRef: providedPreviewCanvasRef,
    onFftApply,
}: EditWindowContentProps) {
    const { t } = useTranslation(["tooltip", "keywords"]);
    useSettingsSync();

    const [brightness, setBrightness] = useState<number>(100);
    const [contrast, setContrast] = useState<number>(100);
    const [isFftActive, setIsFftActive] = useState<boolean>(false);

    const internalImageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const internalSpectrumCanvasRef = useRef<HTMLCanvasElement>(null);
    const internalPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
    const fftContainerRef = useRef<HTMLDivElement>(null);
    const imageRef = providedImageRef ?? internalImageRef;
    const canvasRef = providedSpectrumCanvasRef ?? internalSpectrumCanvasRef;
    const fftCanvasRef = providedPreviewCanvasRef ?? internalPreviewCanvasRef;
    const left = useImagePanZoom(containerRef, imageRef, true);
    const right = useImagePanZoom(fftContainerRef, fftCanvasRef, isFftActive);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        left.reset();
        right.reset();
    }, [isFftActive]);

    const {
        imagePath,
        imageUrl,
        setImageUrl,
        imageName,
        imageSize,
        error,
        saveEditedImage,
    } = useImageIO(imageRef, t, () => {
        left.reset();
        right.reset();
    });

    const handleFftApply = useCallback(
        (dataUrl: string) => {
            setImageUrl(dataUrl);
            onFftApply?.(dataUrl);
            left.reset();
            right.reset();
        },
        [onFftApply, setImageUrl, left, right]
    );

    const fft = useFftWorkspace({
        imageRef,
        spectrumCanvasRef: canvasRef,
        previewCanvasRef: fftCanvasRef,
        isActive: isFftActive,
        onToggleActive: setIsFftActive,
        onApply: handleFftApply,
        onWheel: left.handleWheel,
        onMiddleDrag: left.handleMiddleDrag,
    });

    useSyncedElement(imageRef, imageRef, containerRef, [imageUrl]);
    useSyncedElement(imageRef, canvasRef, containerRef, [imageUrl]);
    useSyncedElement(
        imageRef,
        fftCanvasRef,
        fftContainerRef,
        [imageUrl, isFftActive],
        { zIndex: "11" }
    );

    return (
        <main
            data-testid="edit-window"
            className="flex w-full min-h-dvh h-full flex-col items-center justify-between bg-[hsl(var(--background))] relative overflow-hidden animate-in fade-in duration-700 ease-out"
        >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[75%] h-[85%] brightness-150 rounded-2xl bg-primary/20 blur-[150px] animate-in fade-in zoom-in-95 duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]" />
            </div>

            <Menubar
                className={cn(
                    "flex justify-between w-screen items-center min-h-[56px]"
                )}
                data-tauri-drag-region
            >
                <div className="flex grow-1 items-center">
                    <div className="flex items-center px-2">
                        <Edit
                            size={ICON.SIZE}
                            strokeWidth={ICON.STROKE_WIDTH}
                            className="text-foreground"
                        />
                    </div>
                    <span className="text-sm font-medium text-foreground">
                        {t("Edit Image", { ns: "keywords" })}
                    </span>
                </div>
                <WindowControls />
            </Menubar>

            <div className="flex flex-1 w-full overflow-hidden flex-row">
                <div className="flex flex-1 overflow-hidden p-4 flex-col">
                    {error ? (
                        <div className="text-center flex-1 flex items-center justify-center">
                            <div>
                                <p className="text-destructive text-lg font-medium mb-2">
                                    Error loading image
                                </p>
                                <p className="text-muted-foreground text-sm">
                                    {error}
                                </p>
                            </div>
                        </div>
                    ) : imageUrl ? (
                        <ImagePanes
                            isFftActive={isFftActive}
                            fftStatus={fft.status}
                            imageUrl={imageUrl}
                            imagePath={imagePath}
                            containerRef={containerRef}
                            imageRef={imageRef}
                            spectrumCanvasRef={canvasRef}
                            brightness={brightness}
                            contrast={contrast}
                            zoom={left.zoom}
                            pan={left.pan}
                            isDragging={left.isDragging}
                            onWheel={left.handleWheel}
                            onMouseDown={left.handleMouseDown}
                            onMouseMove={left.handleMouseMove}
                            onMouseUp={left.handleMouseUp}
                            onDoubleClick={left.reset}
                            onResetZoom={left.reset}
                            fftContainerRef={fftContainerRef}
                            previewCanvasRef={fftCanvasRef}
                            rightPanZoom={right.zoom}
                            rightPan={right.pan}
                            isRightDragging={right.isDragging}
                            onRightWheel={right.handleWheel}
                            onRightMouseDown={e =>
                                right.handleMouseDown(e, [0, 1])
                            }
                            onRightMouseMove={right.handleMouseMove}
                            onRightMouseUp={right.handleMouseUp}
                            onRightDoubleClick={right.reset}
                            onResetRightZoom={right.reset}
                        />
                    ) : (
                        <div className="text-center flex-1 flex items-center justify-center">
                            <div>
                                <p className="text-muted-foreground text-lg font-medium">
                                    No image
                                </p>
                                <p className="text-muted-foreground/70 text-sm mt-2">
                                    Load an image in the main window to edit it
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="w-64 border-l border-border/30 bg-background/50 backdrop-blur-md flex flex-col gap-4 p-4 pb-8 h-[calc(100vh-56px)] overflow-y-auto">
                    <SidebarTools
                        imageName={imageName}
                        imageSize={imageSize}
                        onSave={() => saveEditedImage(brightness, contrast)}
                        disabled={!imageUrl || !imagePath}
                    />

                    <div className="border-t border-border/30" />

                    <SidebarAdjustments
                        brightness={brightness}
                        setBrightness={setBrightness}
                        contrast={contrast}
                        setContrast={setContrast}
                        disabled={!imageUrl}
                    />

                    <div className="border-t border-border/30" />

                    <div className="flex flex-col gap-2">
                        <h3 className="text-sm font-semibold text-muted-foreground">
                            DPI
                        </h3>
                        <ImageDpiControls
                            imageRef={imageRef}
                            canvasRef={canvasRef}
                        />
                    </div>

                    <div className="border-t border-border/30" />

                    <SidebarFFT
                        isFftActive={isFftActive}
                        setIsFftActive={setIsFftActive}
                        fft={fft}
                    />
                </div>
            </div>
        </main>
    );
}

export function EditWindow() {
    return <EditWindowContent />;
}

export function EditWindowWithProps({
    imageRef,
    spectrumCanvasRef,
    previewCanvasRef,
    onApply,
}: {
    imageRef: React.RefObject<HTMLImageElement>;
    spectrumCanvasRef: React.RefObject<HTMLCanvasElement>;
    previewCanvasRef: React.RefObject<HTMLCanvasElement>;
    onApply: (dataUrl: string) => void;
}) {
    return (
        <EditWindowContent
            imageRef={imageRef}
            spectrumCanvasRef={spectrumCanvasRef}
            previewCanvasRef={previewCanvasRef}
            onFftApply={onApply}
        />
    );
}
