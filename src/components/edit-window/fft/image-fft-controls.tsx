import React, {
    RefObject,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { Waves, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ICON } from "@/lib/utils/const";
import { ImageFFT, type FFTResult } from "@/lib/fftProcessor";
import { useTranslation } from "react-i18next";

type FftStatus = "idle" | "loading" | "ready" | "processing";
type FftViewMode = "edit" | "preview";

interface ImageFftControlsProps {
    imageRef: RefObject<HTMLImageElement | null>;
    canvasRef: RefObject<HTMLCanvasElement | null>;
    onApply: (dataUrl: string) => void;
}

export default function ImageFftControls({
    imageRef,
    canvasRef,
    onApply,
}: ImageFftControlsProps) {
    const { t } = useTranslation(["keywords", "tooltip"]);

    const [active, setActive] = useState(false);
    const [brushSize, setBrushSize] = useState(30);
    const [viewMode, setViewMode] = useState<FftViewMode>("edit");
    const [status, setStatus] = useState<FftStatus>("idle");

    const processorRef = useRef<ImageFFT | null>(null);
    const fftResultRef = useRef<FFTResult | null>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const specCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const isDrawingRef = useRef(false);
    const brushSizeRef = useRef(brushSize);
    const originalDimsRef = useRef({ w: 0, h: 0 });

    useEffect(() => {
        brushSizeRef.current = brushSize;
    }, [brushSize]);

    /** Redraw the overlay canvas: spectrum + mask */
    const redrawOverlay = useCallback(() => {
        const canvas = canvasRef.current;
        const specCvs = specCanvasRef.current;
        if (!canvas || !specCvs) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 0.75;
        ctx.drawImage(specCvs, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;

        const maskCvs = maskCanvasRef.current;
        if (maskCvs) {
            ctx.drawImage(maskCvs, 0, 0, canvas.width, canvas.height);
        }
    }, [canvasRef]);

    /** Compute FFT when activating; clean up when deactivating */
    useEffect(() => {
        if (!active) {
            const canvas = canvasRef.current;
            if (canvas) {
                canvas.style.pointerEvents = "none";
                const ctx = canvas.getContext("2d");
                ctx?.clearRect(0, 0, canvas.width, canvas.height);
            }
            processorRef.current = null;
            fftResultRef.current = null;
            maskCanvasRef.current = null;
            specCanvasRef.current = null;
            setStatus("idle");
            setViewMode("edit");
            return undefined;
        }

        const img = imageRef.current;
        const canvas = canvasRef.current;
        if (!img || !canvas) return undefined;

        setStatus("loading");
        setViewMode("edit");

        const timer = setTimeout(() => {
            try {
                const w = img.naturalWidth;
                const h = img.naturalHeight;
                originalDimsRef.current = { w, h };

                const tmpCvs = document.createElement("canvas");
                tmpCvs.width = w;
                tmpCvs.height = h;
                const tmpCtx = tmpCvs.getContext("2d", {
                    willReadFrequently: true,
                });
                if (!tmpCtx) throw new Error("Canvas context unavailable");
                tmpCtx.drawImage(img, 0, 0);
                const imageData = tmpCtx.getImageData(0, 0, w, h);

                const processor = new ImageFFT(w, h);
                const result = processor.forward(imageData);

                processorRef.current = processor;
                fftResultRef.current = result;

                // Offscreen mask at FFT dimensions
                const maskCvs = document.createElement("canvas");
                maskCvs.width = result.width;
                maskCvs.height = result.height;
                maskCanvasRef.current = maskCvs;

                // Offscreen spectrum at FFT dimensions
                const specCvs = document.createElement("canvas");
                specCvs.width = result.width;
                specCvs.height = result.height;
                const specCtx = specCvs.getContext("2d");
                if (specCtx) {
                    const specImg = new ImageData(
                        new Uint8ClampedArray(result.spectrum.buffer),
                        result.width,
                        result.height
                    );
                    specCtx.putImageData(specImg, 0, 0);
                }
                specCanvasRef.current = specCvs;

                // Set overlay canvas internal size to image dimensions
                /* eslint-disable no-param-reassign */
                canvas.width = w;
                canvas.height = h;
                /* eslint-enable no-param-reassign */

                redrawOverlay();
                // eslint-disable-next-line no-param-reassign
                canvas.style.pointerEvents = "auto";
                setStatus("ready");
            } catch {
                setStatus("idle");
                setActive(false);
            }
        }, 100);

        return () => clearTimeout(timer);
    }, [active, imageRef, canvasRef, redrawOverlay]);

    /** Attach mouse event handlers for painting on the overlay */
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !active || status !== "ready" || viewMode !== "edit")
            return undefined;

        const fftResult = fftResultRef.current;
        const maskCvs = maskCanvasRef.current;
        if (!fftResult || !maskCvs) return undefined;

        const getCoords = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            return {
                cx: (e.clientX - rect.left) * (canvas.width / rect.width),
                cy: (e.clientY - rect.top) * (canvas.height / rect.height),
            };
        };

        const paintAt = (cx: number, cy: number) => {
            const maskCtx = maskCvs.getContext("2d");
            if (!maskCtx) return;
            const scaleX = fftResult.width / canvas.width;
            const scaleY = fftResult.height / canvas.height;
            maskCtx.globalCompositeOperation = "source-over";
            maskCtx.fillStyle = "#c00000";
            maskCtx.beginPath();
            maskCtx.arc(
                cx * scaleX,
                cy * scaleY,
                brushSizeRef.current * Math.max(scaleX, scaleY),
                0,
                Math.PI * 2
            );
            maskCtx.fill();
            redrawOverlay();
        };

        const onDown = (e: MouseEvent) => {
            if (e.button !== 0) return;
            isDrawingRef.current = true;
            const { cx, cy } = getCoords(e);
            paintAt(cx, cy);
        };

        const onMove = (e: MouseEvent) => {
            if (!isDrawingRef.current) return;
            const { cx, cy } = getCoords(e);
            paintAt(cx, cy);
        };

        const onUp = () => {
            isDrawingRef.current = false;
        };

        canvas.addEventListener("mousedown", onDown);
        canvas.addEventListener("mousemove", onMove);
        canvas.addEventListener("mouseup", onUp);
        canvas.addEventListener("mouseleave", onUp);

        return () => {
            canvas.removeEventListener("mousedown", onDown);
            canvas.removeEventListener("mousemove", onMove);
            canvas.removeEventListener("mouseup", onUp);
            canvas.removeEventListener("mouseleave", onUp);
        };
    }, [active, status, viewMode, canvasRef, redrawOverlay]);

    /** Toggle between spectrum editor and filtered preview */
    const togglePreview = useCallback(() => {
        const canvas = canvasRef.current;
        const processor = processorRef.current;
        const fftResult = fftResultRef.current;
        const maskCvs = maskCanvasRef.current;
        if (!canvas || !processor || !fftResult || !maskCvs) return;

        if (viewMode === "edit") {
            setStatus("processing");
            setTimeout(() => {
                const maskCtx = maskCvs.getContext("2d");
                if (!maskCtx) return;
                const maskImgData = maskCtx.getImageData(
                    0,
                    0,
                    fftResult.width,
                    fftResult.height
                );
                const filteredData = processor.applyMask(
                    fftResult.complexData,
                    maskImgData.data
                );
                const resultImage = processor.inverse(
                    filteredData,
                    canvas.width,
                    canvas.height
                );

                const ctx = canvas.getContext("2d");
                if (ctx) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.putImageData(resultImage, 0, 0);
                }
                // eslint-disable-next-line no-param-reassign
                canvas.style.pointerEvents = "none";
                setViewMode("preview");
                setStatus("ready");
            }, 50);
        } else {
            redrawOverlay();
            // eslint-disable-next-line no-param-reassign
            canvas.style.pointerEvents = "auto";
            setViewMode("edit");
        }
    }, [viewMode, canvasRef, redrawOverlay]);

    /** Apply the FFT filter permanently to the image */
    const applyFilter = useCallback(() => {
        const processor = processorRef.current;
        const fftResult = fftResultRef.current;
        const maskCvs = maskCanvasRef.current;
        if (!processor || !fftResult || !maskCvs) return;

        setStatus("processing");
        setTimeout(() => {
            const maskCtx = maskCvs.getContext("2d");
            if (!maskCtx) return;
            const maskImgData = maskCtx.getImageData(
                0,
                0,
                fftResult.width,
                fftResult.height
            );
            const filteredData = processor.applyMask(
                fftResult.complexData,
                maskImgData.data
            );
            const { w, h } = originalDimsRef.current;
            const resultImage = processor.inverse(filteredData, w, h);

            const outCvs = document.createElement("canvas");
            outCvs.width = w;
            outCvs.height = h;
            outCvs.getContext("2d")?.putImageData(resultImage, 0, 0);
            const dataUrl = outCvs.toDataURL("image/png");

            onApply(dataUrl);
            setActive(false);
        }, 50);
    }, [onApply]);

    /** Clear the painting mask */
    const clearMask = useCallback(() => {
        const maskCvs = maskCanvasRef.current;
        if (maskCvs) {
            const ctx = maskCvs.getContext("2d");
            ctx?.clearRect(0, 0, maskCvs.width, maskCvs.height);
        }
        if (viewMode === "edit") {
            redrawOverlay();
        }
    }, [viewMode, redrawOverlay]);

    return (
        <div className="space-y-3 w-full">
            <Button
                onClick={() => setActive(prev => !prev)}
                variant={active ? "destructive" : "default"}
                className="flex items-center justify-center gap-2"
                disabled={status === "loading" || status === "processing"}
            >
                <Waves size={ICON.SIZE} />
                {t("FFT Filter", { ns: "tooltip" })}
            </Button>

            {active && status === "loading" && (
                <span className="text-xs animate-pulse text-blue-400">
                    {t("Loading...", { ns: "keywords" })}
                </span>
            )}

            {active && status === "processing" && (
                <span className="text-xs animate-pulse text-primary">
                    {t("Processing...", { ns: "keywords" })}
                </span>
            )}

            {active && status === "ready" && (
                <>
                    {viewMode === "edit" && (
                        <>
                            <p className="text-xs text-muted-foreground">
                                {t(
                                    "Paint over bright spots to filter them out",
                                    { ns: "tooltip" }
                                )}
                            </p>
                            <div className="flex flex-col gap-1">
                                <Label
                                    htmlFor="fft-brush-size"
                                    className="text-sm"
                                >
                                    {t("Brush size", { ns: "keywords" })}
                                </Label>
                                <input
                                    id="fft-brush-size"
                                    type="range"
                                    min="5"
                                    max="150"
                                    value={brushSize}
                                    onChange={e =>
                                        setBrushSize(
                                            parseInt(e.target.value, 10)
                                        )
                                    }
                                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-secondary accent-primary"
                                />
                            </div>
                        </>
                    )}

                    <div className="flex flex-col gap-2">
                        <Button
                            onClick={togglePreview}
                            variant="outline"
                            className="w-full"
                        >
                            {viewMode === "edit"
                                ? t("Preview", { ns: "keywords" })
                                : t("Edit", { ns: "keywords" })}
                        </Button>
                        <Button
                            onClick={applyFilter}
                            variant="default"
                            className="w-full"
                        >
                            {t("Apply", { ns: "keywords" })}
                        </Button>
                        {viewMode === "edit" && (
                            <Button
                                onClick={clearMask}
                                variant="outline"
                                className="w-full"
                            >
                                <Trash2 size={ICON.SIZE} className="mr-2" />
                                {t("Clear", { ns: "keywords" })}
                            </Button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
