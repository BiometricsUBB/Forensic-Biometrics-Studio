import React, { useEffect, useRef, useState, useCallback } from "react";
import { ImageFFT, type FFTResult } from "@/lib/fftProcessor";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

type Status = "loading" | "ready" | "processing" | "error";
type ViewMode = "edit" | "preview";

interface FftEditorProps {
    imageSrc: string;
    onClose: () => void;
    onSave: (newImageSrc: string) => void;
}

export function FftEditor({ imageSrc, onClose, onSave }: FftEditorProps) {
    const { t } = useTranslation();

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);

    const [fftData, setFftData] = useState<FFTResult | null>(null);
    const [processor, setProcessor] = useState<ImageFFT | null>(null);
    const [originalDims, setOriginalDims] = useState({ w: 0, h: 0 });

    const [isDrawing, setIsDrawing] = useState(false);
    const [status, setStatus] = useState<Status>("loading");
    const [errorMsg, setErrorMsg] = useState("");
    const [brushSize, setBrushSize] = useState(30);
    const [viewMode, setViewMode] = useState<ViewMode>("edit");
    const [savedMaskState, setSavedMaskState] = useState<ImageData | null>(
        null
    );
    const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });

    // --- Load image & compute FFT ---
    useEffect(() => {
        setStatus("loading");
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageSrc;
        img.addEventListener("load", () => {
            setOriginalDims({ w: img.width, h: img.height });
            setTimeout(() => {
                try {
                    const tempCanvas = document.createElement("canvas");
                    tempCanvas.width = img.width;
                    tempCanvas.height = img.height;
                    const ctx = tempCanvas.getContext("2d", {
                        willReadFrequently: true,
                    });
                    if (!ctx) throw new Error("Canvas context unavailable");
                    ctx.drawImage(img, 0, 0);
                    const imageData = ctx.getImageData(
                        0,
                        0,
                        img.width,
                        img.height
                    );
                    const proc = new ImageFFT(img.width, img.height);
                    const result = proc.forward(imageData);
                    setProcessor(proc);
                    setFftData(result);
                    setStatus("ready");

                    if (canvasRef.current) {
                        canvasRef.current.width = result.width;
                        canvasRef.current.height = result.height;
                        const displayCtx = canvasRef.current.getContext("2d", {
                            willReadFrequently: true,
                        });
                        if (displayCtx) {
                            displayCtx.fillStyle = "black";
                            displayCtx.fillRect(
                                0,
                                0,
                                result.width,
                                result.height
                            );
                            const spectrumImg = new ImageData(
                                new Uint8ClampedArray(result.spectrum.buffer),
                                result.width,
                                result.height
                            );
                            displayCtx.putImageData(spectrumImg, 0, 0);
                        }
                    }
                    if (overlayRef.current) {
                        overlayRef.current.width = result.width;
                        overlayRef.current.height = result.height;
                    }
                } catch (e) {
                    console.error(e);
                    setErrorMsg(
                        t("Memory error processing high-res image", {
                            ns: "dialog",
                        })
                    );
                    setStatus("error");
                }
            }, 100);
        });
    }, [imageSrc, t]);

    // --- Coordinate helpers ---
    const getCoords = useCallback((e: React.MouseEvent) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    }, []);

    // --- Drawing ---
    const handleMouseMove = useCallback(
        (e: React.MouseEvent) => {
            if (status !== "ready" || viewMode !== "edit") return;
            const { x, y } = getCoords(e);
            setCursorPos({ x, y });

            if (isDrawing && overlayRef.current) {
                const ctx = overlayRef.current.getContext("2d", {
                    willReadFrequently: true,
                });
                if (ctx) {
                    ctx.globalCompositeOperation = "source-over";
                    ctx.fillStyle = "#c00000";
                    ctx.beginPath();
                    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        },
        [status, viewMode, isDrawing, brushSize, getCoords]
    );

    // --- Cursor crosshair rendering ---
    useEffect(() => {
        if (!overlayRef.current || status !== "ready" || viewMode !== "edit")
            return;
        const ctx = overlayRef.current.getContext("2d");
        if (!ctx) return;

        if (!isDrawing) {
            if (savedMaskState) ctx.putImageData(savedMaskState, 0, 0);
            else
                ctx.clearRect(
                    0,
                    0,
                    overlayRef.current.width,
                    overlayRef.current.height
                );

            ctx.beginPath();
            ctx.strokeStyle = "#22c55e";
            ctx.lineWidth = 2;
            ctx.arc(cursorPos.x, cursorPos.y, brushSize, 0, Math.PI * 2);
            ctx.stroke();

            ctx.beginPath();
            ctx.strokeStyle = "rgba(34, 197, 94, 0.5)";
            ctx.lineWidth = 1;
            ctx.moveTo(cursorPos.x - 5, cursorPos.y);
            ctx.lineTo(cursorPos.x + 5, cursorPos.y);
            ctx.moveTo(cursorPos.x, cursorPos.y - 5);
            ctx.lineTo(cursorPos.x, cursorPos.y + 5);
            ctx.stroke();
        }
    }, [cursorPos, brushSize, status, viewMode, isDrawing, savedMaskState]);

    // --- Mouse up: persist mask ---
    const handleMouseUp = useCallback(() => {
        setIsDrawing(false);
        if (overlayRef.current && viewMode === "edit") {
            const ctx = overlayRef.current.getContext("2d");
            if (ctx) {
                setSavedMaskState(
                    ctx.getImageData(
                        0,
                        0,
                        overlayRef.current.width,
                        overlayRef.current.height
                    )
                );
            }
        }
    }, [viewMode]);

    // --- Toggle edit/preview ---
    const togglePreview = useCallback(() => {
        if (!canvasRef.current || !overlayRef.current || !processor || !fftData)
            return;
        const baseCtx = canvasRef.current.getContext("2d");
        const overlayCtx = overlayRef.current.getContext("2d");
        if (!baseCtx || !overlayCtx) return;

        if (viewMode === "edit") {
            const currentMask = overlayCtx.getImageData(
                0,
                0,
                fftData.width,
                fftData.height
            );
            setSavedMaskState(currentMask);
            overlayCtx.clearRect(
                0,
                0,
                overlayRef.current.width,
                overlayRef.current.height
            );

            setStatus("processing");
            setTimeout(() => {
                const filteredData = processor.applyMask(
                    fftData.complexData,
                    currentMask.data
                );
                const resultImage = processor.inverse(
                    filteredData,
                    fftData.width,
                    fftData.height
                );
                baseCtx.putImageData(resultImage, 0, 0);
                setViewMode("preview");
                setStatus("ready");
            }, 50);
        } else {
            const spectrumImg = new ImageData(
                new Uint8ClampedArray(fftData.spectrum.buffer),
                fftData.width,
                fftData.height
            );
            baseCtx.putImageData(spectrumImg, 0, 0);

            if (savedMaskState) {
                overlayCtx.putImageData(savedMaskState, 0, 0);
            }
            setViewMode("edit");
        }
    }, [processor, fftData, viewMode, savedMaskState]);

    // --- Save file ---
    const saveFile = useCallback(async () => {
        if (!processor || !fftData || !overlayRef.current) return;

        let maskData: Uint8ClampedArray | null = null;
        if (savedMaskState) {
            maskData = savedMaskState.data;
        } else if (overlayRef.current) {
            const ctx = overlayRef.current.getContext("2d");
            maskData =
                ctx?.getImageData(0, 0, fftData.width, fftData.height).data ??
                null;
        }
        if (!maskData) return;

        setStatus("processing");
        await new Promise<void>(resolve => {
            setTimeout(resolve, 50);
        });

        try {
            const filteredComplexData = processor.applyMask(
                fftData.complexData,
                maskData
            );
            const resultImage = processor.inverse(
                filteredComplexData,
                originalDims.w,
                originalDims.h
            );
            const outCanvas = document.createElement("canvas");
            outCanvas.width = originalDims.w;
            outCanvas.height = originalDims.h;
            outCanvas.getContext("2d")?.putImageData(resultImage, 0, 0);
            const dataUrl = outCanvas.toDataURL("image/png");

            const filePath = await save({
                filters: [{ name: "PNG Image", extensions: ["png"] }],
                defaultPath: "filtered_image.png",
                title: t("Save result as...", { ns: "dialog" }),
            });
            if (!filePath) {
                setStatus("ready");
                return;
            }

            const base64Data = dataUrl.split(",")[1] ?? "";
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i += 1)
                bytes[i] = binaryString.charCodeAt(i);
            await writeFile(filePath, bytes);
            onSave(dataUrl);
            onClose();
        } catch (e) {
            console.error(e);
            setStatus("ready");
        }
    }, [processor, fftData, savedMaskState, originalDims, onSave, onClose, t]);

    // --- Render ---
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-4">
            <h2 className="mb-2 text-2xl font-bold uppercase tracking-wider text-primary">
                {viewMode === "edit"
                    ? t("FFT Spectrum Editor", { ns: "keywords" })
                    : t("FFT Result Preview", { ns: "keywords" })}
            </h2>

            <div className="mb-2 h-6 text-center text-sm">
                {status === "loading" && (
                    <span className="animate-pulse font-bold text-blue-400">
                        {t("Loading...", { ns: "keywords" })}
                    </span>
                )}
                {status === "processing" && (
                    <span className="animate-pulse font-bold text-primary">
                        {t("Processing...", { ns: "keywords" })}
                    </span>
                )}
                {status === "error" && (
                    <span className="font-bold text-destructive">
                        {errorMsg}
                    </span>
                )}
                {status === "ready" && viewMode === "edit" && (
                    <span className="text-muted-foreground">
                        {t("Paint over bright spots to filter them out", {
                            ns: "tooltip",
                        })}
                    </span>
                )}
                {status === "ready" && viewMode === "preview" && (
                    <span className="text-primary">
                        {t("Preview ready. Return to edit or save.", {
                            ns: "tooltip",
                        })}
                    </span>
                )}
            </div>

            {viewMode === "edit" && status === "ready" && (
                <div className="mb-2 flex items-center gap-4 rounded-lg border border-border bg-muted/50 px-4 py-2">
                    <span className="text-sm font-bold text-foreground">
                        {t("Brush size", { ns: "keywords" })}:
                    </span>
                    <input
                        type="range"
                        min="5"
                        max="150"
                        value={brushSize}
                        onChange={e =>
                            setBrushSize(parseInt(e.target.value, 10))
                        }
                        className="h-2 w-48 cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
                    />
                    <div
                        className="rounded-full border border-foreground bg-foreground"
                        style={{
                            width: brushSize / 2,
                            height: brushSize / 2,
                        }}
                    />
                </div>
            )}

            <div
                className="relative flex items-center justify-center overflow-hidden border-2 border-primary/30 bg-black shadow-lg"
                style={{
                    maxHeight: "70vh",
                    maxWidth: "90vw",
                    aspectRatio: "1/1",
                }}
            >
                <canvas
                    ref={canvasRef}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        position: "relative",
                        zIndex: 1,
                    }}
                />
                <canvas
                    ref={overlayRef}
                    onMouseDown={() => setIsDrawing(true)}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onMouseMove={handleMouseMove}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        position: "absolute",
                        top: 0,
                        left: 0,
                        zIndex: 2,
                        cursor:
                            status === "ready" && viewMode === "edit"
                                ? "none"
                                : "default",
                    }}
                />
            </div>

            <div className="mt-6 flex gap-4">
                <Button
                    onClick={togglePreview}
                    disabled={status !== "ready"}
                    variant="default"
                    size="lg"
                    className="min-w-[200px]"
                >
                    {viewMode === "edit"
                        ? t("Preview", { ns: "keywords" })
                        : t("Edit", { ns: "keywords" })}
                </Button>
                <Button
                    onClick={saveFile}
                    disabled={status !== "ready"}
                    variant="default"
                    size="lg"
                >
                    {status === "processing"
                        ? t("Saving...", { ns: "keywords" })
                        : t("Save as", { ns: "keywords" })}
                </Button>
                <Button
                    onClick={onClose}
                    disabled={status === "processing"}
                    variant="destructive"
                    size="lg"
                >
                    {t("Cancel", { ns: "keywords" })}
                </Button>
            </div>
        </div>
    );
}
