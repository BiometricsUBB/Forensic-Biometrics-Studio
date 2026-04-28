import React, { useCallback, useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash2, Waves, Sun, Contrast, X, Play } from "lucide-react";
import { ICON } from "@/lib/utils/const";
import { ImageFFT } from "@/lib/fftProcessor";
import { useTranslation } from "react-i18next";
import {
    AnyModifier,
    BrightnessModifier,
    ContrastModifier,
    FftModifier,
} from "@/lib/imageModifiers/types";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogPortal,
    DialogClose,
} from "@/components/ui/dialog";

// ─── Shared Styles ────────────────────────────────────────────────────────────

const SLIDER_THUMB_CLASS =
    "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(0,0,0,0.5)] [&::-webkit-slider-thumb]:hover:scale-125 [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:ring-2 [&::-webkit-slider-thumb]:ring-background " +
    "[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:shadow-[0_0_10px_rgba(0,0,0,0.5)] [&::-moz-range-thumb]:hover:scale-125 [&::-moz-range-thumb]:transition-transform [&::-moz-range-thumb]:ring-2 [&::-moz-range-thumb]:ring-background [&::-moz-range-thumb]:border-none";

const SLIDER_TRACK_CLASS =
    "bg-secondary rounded-lg appearance-none cursor-pointer border border-border/40 shadow-inner";

// ─── Brightness ───────────────────────────────────────────────────────────────

function BrightnessSettings({
    modifier,
    onChange,
}: {
    modifier: BrightnessModifier;
    onChange: (params: BrightnessModifier["params"]) => void;
}) {
    const { t } = useTranslation(["tooltip"]);
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <Label htmlFor="mod-brightness" className="text-sm font-medium">
                    {t("Brightness", { ns: "tooltip" })}
                </Label>
                <div className="flex items-center gap-3">
                    <input
                        id="mod-brightness"
                        type="range"
                        min="0"
                        max="200"
                        value={modifier.params.value}
                        onChange={e =>
                            onChange({ value: Number(e.target.value) })
                        }
                        className={`flex-1 h-2.5 ${SLIDER_TRACK_CLASS} ${SLIDER_THUMB_CLASS}`}
                    />
                    <span className="text-sm text-muted-foreground min-w-[3.5rem] text-right tabular-nums">
                        {modifier.params.value}%
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─── Contrast ─────────────────────────────────────────────────────────────────

function ContrastSettings({
    modifier,
    onChange,
}: {
    modifier: ContrastModifier;
    onChange: (params: ContrastModifier["params"]) => void;
}) {
    const { t } = useTranslation(["tooltip"]);
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <Label htmlFor="mod-contrast" className="text-sm font-medium">
                    {t("Contrast", { ns: "tooltip" })}
                </Label>
                <div className="flex items-center gap-3">
                    <input
                        id="mod-contrast"
                        type="range"
                        min="0"
                        max="200"
                        value={modifier.params.value}
                        onChange={e =>
                            onChange({ value: Number(e.target.value) })
                        }
                        className={`flex-1 h-2.5 ${SLIDER_TRACK_CLASS} ${SLIDER_THUMB_CLASS}`}
                    />
                    <span className="text-sm text-muted-foreground min-w-[3.5rem] text-right tabular-nums">
                        {modifier.params.value}%
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─── FFT ──────────────────────────────────────────────────────────────────────

type FftViewMode = "edit" | "preview";
type FftStatus = "idle" | "loading" | "ready" | "processing";

function FftSettings({
    modifier,
    imageRef,
    onChange,
}: {
    modifier: FftModifier;
    imageRef: React.RefObject<HTMLImageElement | null>;
    onChange: (params: Partial<FftModifier["params"]>) => void;
}) {
    const { t } = useTranslation(["keywords", "tooltip"]);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [status, setStatus] = useState<FftStatus>(() =>
        // If already computed from a previous open, go straight to ready
        // eslint-disable-next-line no-underscore-dangle
        modifier.params._processor && modifier.params._fftResult
            ? "ready"
            : "idle"
    );
    const [viewMode, setViewMode] = useState<FftViewMode>("edit");

    const [brushSize, setBrushSize] = useState(modifier.params.brushSize);
    const [spectrumOpacity, setSpectrumOpacity] = useState(
        modifier.params.spectrumOpacity
    );

    const brushSizeRef = useRef(brushSize);
    const spectrumOpacityRef = useRef(spectrumOpacity);
    const isDrawingRef = useRef(false);

    // eslint-disable-next-line no-underscore-dangle
    const processorRef = useRef(modifier.params._processor ?? null);
    // eslint-disable-next-line no-underscore-dangle
    const fftResultRef = useRef(modifier.params._fftResult ?? null);
    // eslint-disable-next-line no-underscore-dangle
    const maskCanvasRef = useRef(modifier.params._maskCanvas ?? null);
    const specCanvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        brushSizeRef.current = brushSize;
    }, [brushSize]);
    useEffect(() => {
        spectrumOpacityRef.current = spectrumOpacity;
    }, [spectrumOpacity]);

    // ── Redraw overlay ────────────────────────────────────────────────────────
    const redrawOverlay = useCallback(() => {
        const canvas = canvasRef.current;
        const specCvs = specCanvasRef.current;
        if (!canvas || !specCvs) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = spectrumOpacityRef.current / 100;
        ctx.drawImage(specCvs, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
        const maskCvs = maskCanvasRef.current;
        if (maskCvs) ctx.drawImage(maskCvs, 0, 0, canvas.width, canvas.height);
    }, []);

    // ── Restore overlay if already computed ──────────────────────────────────
    useEffect(() => {
        if (
            processorRef.current &&
            fftResultRef.current &&
            specCanvasRef.current === null
        ) {
            // Rebuild specCanvasRef from the stored spectrum data
            const result = fftResultRef.current;
            const specCvs = document.createElement("canvas");
            specCvs.width = result.width;
            specCvs.height = result.height;
            const ctx = specCvs.getContext("2d");
            if (ctx) {
                ctx.putImageData(
                    new ImageData(
                        new Uint8ClampedArray(result.spectrum.buffer),
                        result.width,
                        result.height
                    ),
                    0,
                    0
                );
            }
            specCanvasRef.current = specCvs;

            // Size the overlay canvas and draw
            const canvas = canvasRef.current;
            if (canvas) {
                const img = imageRef.current;
                if (img) {
                    // eslint-disable-next-line no-param-reassign
                    canvas.width = img.naturalWidth;
                    // eslint-disable-next-line no-param-reassign
                    canvas.height = img.naturalHeight;
                }
                redrawOverlay();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Compute FFT (manual trigger) ─────────────────────────────────────────
    const computeFft = useCallback(() => {
        const img = imageRef.current;
        const canvas = canvasRef.current;
        if (!img || !canvas) return;

        setStatus("loading");

        // Defer so the "loading…" UI can paint before we block the thread
        setTimeout(() => {
            try {
                const imageW = img.naturalWidth;
                const imageH = img.naturalHeight;

                const tmp = document.createElement("canvas");
                tmp.width = imageW;
                tmp.height = imageH;
                const tmpCtx = tmp.getContext("2d", {
                    willReadFrequently: true,
                });
                if (!tmpCtx) throw new Error("no ctx");
                tmpCtx.drawImage(img, 0, 0);
                const imageData = tmpCtx.getImageData(0, 0, imageW, imageH);

                const processor = new ImageFFT(imageW, imageH);
                const result = processor.forward(imageData);

                processorRef.current = processor;
                fftResultRef.current = result;

                if (!maskCanvasRef.current) {
                    const maskCvs = document.createElement("canvas");
                    maskCvs.width = result.width;
                    maskCvs.height = result.height;
                    maskCanvasRef.current = maskCvs;
                }

                const specCvs = document.createElement("canvas");
                specCvs.width = result.width;
                specCvs.height = result.height;
                const specCtx = specCvs.getContext("2d");
                if (specCtx) {
                    specCtx.putImageData(
                        new ImageData(
                            new Uint8ClampedArray(result.spectrum.buffer),
                            result.width,
                            result.height
                        ),
                        0,
                        0
                    );
                }
                specCanvasRef.current = specCvs;

                // eslint-disable-next-line no-param-reassign
                canvas.width = imageW;
                // eslint-disable-next-line no-param-reassign
                canvas.height = imageH;

                redrawOverlay();
                setStatus("ready");

                onChange({
                    _processor: processor,
                    _fftResult: result,
                    _maskCanvas: maskCanvasRef.current,
                });
            } catch {
                setStatus("idle");
            }
        }, 50);
    }, [imageRef, redrawOverlay, onChange]);

    // ── Mouse paint ───────────────────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        const fftResult = fftResultRef.current;
        const maskCvs = maskCanvasRef.current;
        if (
            !canvas ||
            !fftResult ||
            !maskCvs ||
            status !== "ready" ||
            viewMode !== "edit"
        )
            return undefined;

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
            onChange({ _maskCanvas: maskCanvasRef.current });
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
    }, [status, viewMode, redrawOverlay, onChange]);

    // ── Toggle preview ────────────────────────────────────────────────────────
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
                setViewMode("preview");
                setStatus("ready");
            }, 50);
        } else {
            redrawOverlay();
            setViewMode("edit");
        }
    }, [viewMode, redrawOverlay]);

    const clearMask = useCallback(() => {
        const maskCvs = maskCanvasRef.current;
        if (!maskCvs) return;
        const ctx = maskCvs.getContext("2d");
        ctx?.clearRect(0, 0, maskCvs.width, maskCvs.height);
        onChange({ _maskCanvas: maskCvs, maskDataUrl: null });
        if (viewMode === "edit") redrawOverlay();
    }, [viewMode, redrawOverlay, onChange]);

    const canvasStyle: React.CSSProperties = {
        maxWidth: "100%",
        maxHeight: "340px",
        objectFit: "contain",
        cursor:
            viewMode === "edit" && status === "ready" ? "crosshair" : "default",
        border: "1px solid hsl(var(--border))",
        borderRadius: "0.375rem",
        display: "block",
    };

    return (
        <div className="flex flex-col gap-3">
            {/* Spectrum canvas (always present for sizing; blank when idle) */}
            <div className="relative flex items-center justify-center bg-muted/30 rounded-md p-2 min-h-[120px]">
                <canvas ref={canvasRef} style={canvasStyle} />
                {status === "idle" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                        <p className="text-xs text-muted-foreground text-center px-4">
                            Click &quot;Compute&quot; to analyse the frequency
                            spectrum
                        </p>
                        <Button
                            size="sm"
                            onClick={computeFft}
                            id="fft-compute-button"
                        >
                            <Play size={ICON.SIZE} className="mr-1.5" />
                            Compute
                        </Button>
                    </div>
                )}
            </div>

            {status === "loading" && (
                <span className="text-xs text-muted-foreground animate-pulse">
                    {t("Loading...", { ns: "keywords" })}
                </span>
            )}
            {status === "processing" && (
                <span className="text-xs text-primary animate-pulse">
                    {t("Processing...", { ns: "keywords" })}
                </span>
            )}

            {status === "ready" && viewMode === "edit" && (
                <>
                    <p className="text-xs text-muted-foreground">
                        {t("Paint over bright spots to filter them out", {
                            ns: "tooltip",
                        })}
                    </p>
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="fft-dlg-brush" className="text-xs">
                            {t("Brush size", { ns: "keywords" })}: {brushSize}
                        </Label>
                        <input
                            id="fft-dlg-brush"
                            type="range"
                            min="5"
                            max="150"
                            value={brushSize}
                            onChange={e => {
                                const v = Number(e.target.value);
                                setBrushSize(v);
                                brushSizeRef.current = v;
                                onChange({ brushSize: v });
                            }}
                            className={`h-2.5 w-full ${SLIDER_TRACK_CLASS} ${SLIDER_THUMB_CLASS}`}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="fft-dlg-opacity" className="text-xs">
                            {t("Opacity", { ns: "keywords" })}:{" "}
                            {spectrumOpacity}%
                        </Label>
                        <input
                            id="fft-dlg-opacity"
                            type="range"
                            min="10"
                            max="100"
                            value={spectrumOpacity}
                            onChange={e => {
                                const v = Number(e.target.value);
                                setSpectrumOpacity(v);
                                spectrumOpacityRef.current = v;
                                onChange({ spectrumOpacity: v });
                                redrawOverlay();
                            }}
                            className={`h-2.5 w-full ${SLIDER_TRACK_CLASS} ${SLIDER_THUMB_CLASS}`}
                        />
                    </div>
                </>
            )}

            {status === "ready" && (
                <div className="flex flex-col gap-2">
                    <Button
                        onClick={togglePreview}
                        variant="outline"
                        size="sm"
                        className="w-full"
                    >
                        {viewMode === "edit"
                            ? t("Preview", { ns: "keywords" })
                            : t("Edit", { ns: "keywords" })}
                    </Button>
                    {viewMode === "edit" && (
                        <Button
                            onClick={clearMask}
                            variant="ghost"
                            size="sm"
                            className="w-full text-muted-foreground"
                        >
                            <Trash2 size={ICON.SIZE} className="mr-1.5" />
                            {t("Clear", { ns: "keywords" })}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Dialog icon per type ─────────────────────────────────────────────────────

function TitleIcon({ type }: { type: AnyModifier["type"] }) {
    const cls = "text-primary shrink-0";
    if (type === "brightness")
        return (
            <Sun
                size={ICON.SIZE}
                strokeWidth={ICON.STROKE_WIDTH}
                className={cls}
            />
        );
    if (type === "contrast")
        return (
            <Contrast
                size={ICON.SIZE}
                strokeWidth={ICON.STROKE_WIDTH}
                className={cls}
            />
        );
    return (
        <Waves
            size={ICON.SIZE}
            strokeWidth={ICON.STROKE_WIDTH}
            className={cls}
        />
    );
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

interface ModifierSettingsDialogProps {
    modifier: AnyModifier | null;
    imageRef: React.RefObject<HTMLImageElement | null>;
    open: boolean;
    onClose: () => void;
    onUpdate: (id: string, params: Partial<AnyModifier["params"]>) => void;
}

export function ModifierSettingsDialog({
    modifier,
    imageRef,
    open,
    onClose,
    onUpdate,
}: ModifierSettingsDialogProps) {
    const { t } = useTranslation(["tooltip", "keywords"]);

    if (!modifier) return null;

    const handleChange = (params: Partial<AnyModifier["params"]>) => {
        onUpdate(modifier.id, params);
    };

    const title =
        modifier.type === "brightness"
            ? t("Brightness", { ns: "tooltip" })
            : modifier.type === "contrast"
              ? t("Contrast", { ns: "tooltip" })
              : t("FFT Filter", { ns: "tooltip" });

    return (
        /*
         * modal={false} — critical fix:
         *   The dialog does NOT trap focus and does NOT block pointer-events
         *   on the rest of the UI. This prevents the "frozen window" symptom
         *   where the overlay intercepted all clicks but the dialog content was
         *   not interactable or not visible.
         */
        <Dialog
            open={open}
            onOpenChange={v => {
                if (!v) onClose();
            }}
            modal={false}
        >
            <DialogPortal>
                {/* No DialogOverlay — non-modal dialogs don't need a backdrop */}
                <DialogContent
                    className="w-[440px] max-w-[95vw] max-h-[85vh] overflow-y-auto p-5 shadow-2xl border border-border/60 z-50 pointer-events-auto"
                    id={`modifier-settings-dialog-${modifier.id}`}
                    onPointerDownOutside={e => e.preventDefault()}
                    onInteractOutside={e => e.preventDefault()}
                >
                    {/* Title row with explicit close button */}
                    <div className="flex items-center justify-between mb-4">
                        <DialogTitle className="text-base font-semibold flex items-center gap-2 m-0">
                            <TitleIcon type={modifier.type} />
                            {title}
                        </DialogTitle>
                        <DialogClose asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                id={`modifier-dialog-close-${modifier.id}`}
                                onClick={onClose}
                            >
                                <X size={14} strokeWidth={2} />
                            </Button>
                        </DialogClose>
                    </div>

                    {modifier.type === "brightness" && (
                        <BrightnessSettings
                            modifier={modifier as BrightnessModifier}
                            onChange={p => handleChange(p)}
                        />
                    )}
                    {modifier.type === "contrast" && (
                        <ContrastSettings
                            modifier={modifier as ContrastModifier}
                            onChange={p => handleChange(p)}
                        />
                    )}
                    {modifier.type === "fft" && (
                        <FftSettings
                            modifier={modifier as FftModifier}
                            imageRef={imageRef}
                            onChange={p => handleChange(p)}
                        />
                    )}

                    {/* ── Zapisz (Save / Done) ───────────────────────── */}
                    <div className="mt-5 pt-4 border-t border-border/40 flex justify-end">
                        <Button
                            onClick={onClose}
                            id={`modifier-save-${modifier.id}`}
                        >
                            {t("Save", { ns: "keywords" })}
                        </Button>
                    </div>
                </DialogContent>
            </DialogPortal>
        </Dialog>
    );
}
