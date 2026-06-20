import React, { useCallback, useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
    Trash2,
    Waves,
    Sun,
    Contrast,
    Wand2,
    Brain,
    X,
    Play,
    RefreshCw,
    SlidersHorizontal,
    TrendingUp,
} from "lucide-react";
import { ICON } from "@/lib/utils/const";
import { ImageFFT } from "@/lib/fftProcessor";
import { useTranslation } from "react-i18next";
import {
    AnyModifier,
    BrightnessModifier,
    ContrastModifier,
    EnhancementModifier,
    FftModifier,
    LevelsModifier,
    CurvesModifier,
    isEnhancementModifier,
} from "@/lib/imageModifiers/types";
import { createMonotoneCubicSpline } from "@/lib/imageModifiers/pipeline";
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

// ─── Shared Histogram & Channel tools ──────────────────────────────────────────

export interface HistogramData {
    master: number[];
    r: number[];
    g: number[];
    b: number[];
}

function computeHistogram(img: HTMLImageElement): HistogramData | null {
    if (!img) return null;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const r = new Uint32Array(256);
    const g = new Uint32Array(256);
    const b = new Uint32Array(256);
    const master = new Uint32Array(256);

    for (let i = 0; i < data.length; i += 4) {
        const rr = data[i]!;
        const gg = data[i + 1]!;
        const bb = data[i + 2]!;
        r[rr] = r[rr]! + 1;
        g[gg] = g[gg]! + 1;
        b[bb] = b[bb]! + 1;
        const lum = Math.round((rr + gg + bb) / 3);
        master[lum] = master[lum]! + 1;
    }

    let maxMaster = 0;
    let maxR = 0;
    let maxG = 0;
    let maxB = 0;
    for (let i = 1; i < 255; i += 1) {
        if (master[i]! > maxMaster) maxMaster = master[i]!;
        if (r[i]! > maxR) maxR = r[i]!;
        if (g[i]! > maxG) maxG = g[i]!;
        if (b[i]! > maxB) maxB = b[i]!;
    }

    return {
        master: Array.from(master).map(v => Math.min(1, v / (maxMaster || 1))),
        r: Array.from(r).map(v => Math.min(1, v / (maxR || 1))),
        g: Array.from(g).map(v => Math.min(1, v / (maxG || 1))),
        b: Array.from(b).map(v => Math.min(1, v / (maxB || 1))),
    };
}

type ColorChannel = "master" | "r" | "g" | "b";

function ChannelSelector({
    value,
    onChange,
}: {
    value: ColorChannel;
    onChange: (v: ColorChannel) => void;
}) {
    const channels: { id: ColorChannel; label: string; color?: string }[] = [
        { id: "master", label: "RGB" },
        { id: "r", label: "Red", color: "text-red-500" },
        { id: "g", label: "Green", color: "text-green-500" },
        { id: "b", label: "Blue", color: "text-blue-500" },
    ];

    return (
        <div className="flex bg-secondary rounded-lg p-1 gap-1">
            {channels.map(c => (
                <button
                    type="button"
                    key={c.id}
                    className={`flex-1 text-xs font-semibold py-1 rounded-md transition-colors ${
                        value === c.id
                            ? `bg-background shadow-sm ${
                                  c.color || "text-foreground"
                              }`
                            : "text-muted-foreground hover:bg-background/50"
                    }`}
                    onClick={() => onChange(c.id as ColorChannel)}
                >
                    {c.label}
                </button>
            ))}
        </div>
    );
}

function HistogramBackground({
    data,
    channel,
    className,
}: {
    data: HistogramData | null;
    channel: ColorChannel;
    className?: string;
}) {
    if (!data) return null;
    const arr = data[channel];
    const points = arr
        .map((val, idx) => `${(idx / 255) * 100},${100 - val * 100}`)
        .join(" ");
    const path = `M 0,100 L ${points} L 100,100 Z`;

    let fill = "fill-foreground/20";
    if (channel === "r") fill = "fill-red-500/20";
    if (channel === "g") fill = "fill-green-500/20";
    if (channel === "b") fill = "fill-blue-500/20";

    return (
        <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
        >
            <path d={path} className={fill} />
        </svg>
    );
}

// ─── Levels ───────────────────────────────────────────────────────────────────

function LevelsSettings({
    modifier,
    onChange,
    histogram,
}: {
    modifier: LevelsModifier;
    onChange: (params: LevelsModifier["params"]) => void;
    histogram: HistogramData | null;
}) {
    const { t } = useTranslation(["tooltip"]);
    const [channel, setChannel] = useState<ColorChannel>("master");
    const p = modifier.params[channel];

    return (
        <div className="flex flex-col gap-4">
            <ChannelSelector value={channel} onChange={setChannel} />

            <div className="w-full h-24 border border-border/40 rounded-md bg-background/50 relative overflow-hidden">
                <HistogramBackground data={histogram} channel={channel} />
                <div className="absolute inset-0 grid grid-cols-4 pointer-events-none">
                    {[0, 1, 2, 3].map(i => (
                        <div
                            key={i}
                            className="border-r border-border/20 last:border-0"
                        />
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-1">
                <Label
                    htmlFor="mod-levels-black"
                    className="text-sm font-medium"
                >
                    {t("Black Point", { ns: "tooltip" })}
                </Label>
                <div className="flex items-center gap-3">
                    <input
                        id="mod-levels-black"
                        type="range"
                        min="0"
                        max="254"
                        value={p.black}
                        onChange={e =>
                            onChange({
                                ...modifier.params,
                                [channel]: {
                                    ...p,
                                    black: Math.min(
                                        Number(e.target.value),
                                        p.white - 1
                                    ),
                                },
                            })
                        }
                        className={`flex-1 h-2.5 ${SLIDER_TRACK_CLASS} ${SLIDER_THUMB_CLASS}`}
                    />
                    <span className="text-sm text-muted-foreground min-w-[2.5rem] text-right tabular-nums">
                        {p.black}
                    </span>
                </div>
            </div>
            <div className="flex flex-col gap-1">
                <Label
                    htmlFor="mod-levels-gamma"
                    className="text-sm font-medium"
                >
                    {t("Gamma (Midtones)", { ns: "tooltip" })}
                </Label>
                <div className="flex items-center gap-3">
                    <input
                        id="mod-levels-gamma"
                        type="range"
                        min="0.1"
                        max="9.99"
                        step="0.01"
                        value={p.gamma}
                        onChange={e =>
                            onChange({
                                ...modifier.params,
                                [channel]: {
                                    ...p,
                                    gamma: Number(e.target.value),
                                },
                            })
                        }
                        className={`flex-1 h-2.5 ${SLIDER_TRACK_CLASS} ${SLIDER_THUMB_CLASS}`}
                    />
                    <span className="text-sm text-muted-foreground min-w-[2.5rem] text-right tabular-nums">
                        {p.gamma.toFixed(2)}
                    </span>
                </div>
            </div>
            <div className="flex flex-col gap-1">
                <Label
                    htmlFor="mod-levels-white"
                    className="text-sm font-medium"
                >
                    {t("White Point", { ns: "tooltip" })}
                </Label>
                <div className="flex items-center gap-3">
                    <input
                        id="mod-levels-white"
                        type="range"
                        min="1"
                        max="255"
                        value={p.white}
                        onChange={e =>
                            onChange({
                                ...modifier.params,
                                [channel]: {
                                    ...p,
                                    white: Math.max(
                                        Number(e.target.value),
                                        p.black + 1
                                    ),
                                },
                            })
                        }
                        className={`flex-1 h-2.5 ${SLIDER_TRACK_CLASS} ${SLIDER_THUMB_CLASS}`}
                    />
                    <span className="text-sm text-muted-foreground min-w-[2.5rem] text-right tabular-nums">
                        {p.white}
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─── Curves ───────────────────────────────────────────────────────────────────

function CurvesSettings({
    modifier,
    onChange,
    histogram,
}: {
    modifier: CurvesModifier;
    onChange: (params: CurvesModifier["params"]) => void;
    histogram: HistogramData | null;
}) {
    const { t } = useTranslation(["tooltip"]);
    const svgRef = useRef<SVGSVGElement>(null);
    const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
    const [channel, setChannel] = useState<ColorChannel>("master");
    const activePoints = modifier.params[channel];

    const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const rect = svgRef.current.getBoundingClientRect();
        const clientX = "touches" in e ? e.touches[0]!.clientX : e.clientX;
        const clientY = "touches" in e ? e.touches[0]!.clientY : e.clientY;
        const x = Math.max(
            0,
            Math.min(
                255,
                Math.round(((clientX - rect.left) / rect.width) * 255)
            )
        );
        const y = Math.max(
            0,
            Math.min(
                255,
                Math.round((1 - (clientY - rect.top) / rect.height) * 255)
            )
        );
        return { x, y };
    };

    const handlePointerDown = (
        e: React.MouseEvent | React.TouchEvent,
        idx: number
    ) => {
        e.stopPropagation();
        setDraggingIdx(idx);
    };

    const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (draggingIdx === null) return;
        const { x, y } = getMousePos(e);
        const newPoints = [...activePoints];

        const minX = draggingIdx > 0 ? newPoints[draggingIdx - 1]!.x + 1 : 0;
        const maxX =
            draggingIdx < newPoints.length - 1
                ? newPoints[draggingIdx + 1]!.x - 1
                : 255;

        newPoints[draggingIdx] = { x: Math.max(minX, Math.min(maxX, x)), y };
        onChange({ ...modifier.params, [channel]: newPoints });
    };

    const handlePointerUp = () => {
        setDraggingIdx(null);
    };

    const handleSvgClick = (e: React.MouseEvent) => {
        if (draggingIdx !== null) return;
        const { x, y } = getMousePos(e);
        const newPoints = [...activePoints, { x, y }].sort((a, b) => a.x - b.x);
        onChange({ ...modifier.params, [channel]: newPoints });
    };

    const handleRightClick = (e: React.MouseEvent, idx: number) => {
        e.preventDefault();
        e.stopPropagation();
        if (idx === 0 || idx === activePoints.length - 1) return;
        const newPoints = activePoints.filter((_, i) => i !== idx);
        onChange({ ...modifier.params, [channel]: newPoints });
    };

    const sorted = [...activePoints].sort((a, b) => a.x - b.x);
    const spline = createMonotoneCubicSpline(sorted);
    let curvePath = "";
    for (let i = 0; i <= 255; i += 2) {
        const x = (i / 255) * 100;
        const y = 100 - (Math.max(0, Math.min(255, spline(i))) / 255) * 100;
        curvePath += `${i === 0 ? "M" : "L"} ${x} ${y} `;
    }

    let lineStroke = "text-primary";
    if (channel === "r") lineStroke = "text-red-500";
    if (channel === "g") lineStroke = "text-green-500";
    if (channel === "b") lineStroke = "text-blue-500";

    return (
        <div className="flex flex-col gap-4">
            <ChannelSelector value={channel} onChange={setChannel} />

            <div className="flex flex-col gap-1">
                <Label className="text-sm font-medium">
                    {t("Curves (Click: Add, Right-click: Remove)", {
                        ns: "tooltip",
                    })}
                </Label>
                {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                <div
                    className="w-full aspect-square border border-border/40 bg-background/50 rounded-md relative cursor-crosshair touch-none select-none"
                    onMouseMove={handlePointerMove}
                    onMouseUp={handlePointerUp}
                    onMouseLeave={handlePointerUp}
                    onTouchMove={handlePointerMove}
                    onTouchEnd={handlePointerUp}
                    onTouchCancel={handlePointerUp}
                >
                    <HistogramBackground data={histogram} channel={channel} />
                    <svg
                        ref={svgRef}
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        className="w-full h-full absolute inset-0 overflow-visible"
                        onClick={handleSvgClick}
                    >
                        <g
                            className="stroke-muted-foreground/20"
                            strokeWidth="1"
                        >
                            {[25, 50, 75].map(v => (
                                <React.Fragment key={v}>
                                    <line x1={v} y1="0" x2={v} y2="100" />
                                    <line x1="0" y1={v} x2="100" y2={v} />
                                </React.Fragment>
                            ))}
                        </g>
                        <path
                            d={curvePath}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            className={lineStroke}
                        />
                        {activePoints.map((p, idx) => (
                            /* eslint-disable-next-line react/no-array-index-key */
                            <circle
                                key={idx}
                                cx={(p.x / 255) * 100}
                                cy={100 - (p.y / 255) * 100}
                                r="3"
                                className="fill-background stroke-primary cursor-pointer hover:stroke-foreground transition-colors"
                                strokeWidth="1.5"
                                onMouseDown={e => handlePointerDown(e, idx)}
                                onTouchStart={e => handlePointerDown(e, idx)}
                                onContextMenu={e => handleRightClick(e, idx)}
                            />
                        ))}
                    </svg>
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
        onChange({ _maskCanvas: maskCvs });
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
                            {t(
                                'Click "Compute" to analyse the frequency spectrum',
                                { ns: "tooltip" }
                            )}
                        </p>
                        <Button
                            size="sm"
                            onClick={computeFft}
                            id="fft-compute-button"
                        >
                            <Play size={ICON.SIZE} className="mr-1.5" />
                            {t("Compute", { ns: "keywords" })}
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

// ─── Enhancement (GBFEN / SNFEN) ─────────────────────────────────────────────

function EnhancementSettings({
    modifier,
    onChange,
    onRerun,
}: {
    modifier: EnhancementModifier;
    onChange: (params: Partial<EnhancementModifier["params"]>) => void;
    onRerun?: (id: string) => void;
}) {
    const { t } = useTranslation(["tooltip"]);
    const { dpi, status, outputPath, errorMessage, durationMs } =
        modifier.params;
    const isBusy = status === "processing" || status === "pending";

    const methodLabel =
        modifier.type === "gbfen"
            ? t("GBFEN — Gabor-based enhancement", { ns: "tooltip" })
            : t("SNFEN — Neural enhancement", { ns: "tooltip" });

    const descriptionKey: "gbfen_desc" | "snfen_desc" =
        modifier.type === "gbfen" ? "gbfen_desc" : "snfen_desc";

    const statusLabel =
        status === "pending"
            ? t("Enhancement: pending", { ns: "tooltip" })
            : status === "processing"
              ? t("Enhancement: processing", { ns: "tooltip" })
              : status === "ready"
                ? t("Enhancement: ready", { ns: "tooltip" })
                : t("Enhancement: failed", { ns: "tooltip" });

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    {t("Method", { ns: "tooltip" })}
                </span>
                <span className="font-medium text-sm">{methodLabel}</span>
                <p className="text-xs text-muted-foreground leading-snug">
                    {t(descriptionKey, { ns: "tooltip" })}
                </p>
            </div>

            <div className="flex flex-col gap-1">
                <Label htmlFor="enh-dpi" className="text-sm font-medium">
                    {t("Enhancement DPI", { ns: "tooltip" })}
                </Label>
                <input
                    id="enh-dpi"
                    type="number"
                    min={50}
                    max={2400}
                    step={50}
                    value={dpi}
                    disabled={isBusy}
                    onChange={e => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v) && v > 0) {
                            onChange({ dpi: v });
                        }
                    }}
                    className="h-9 px-2 rounded-md border border-border/40 bg-background text-sm"
                />
                <span className="text-xs text-muted-foreground">
                    {t("Enhancement DPI hint", { ns: "tooltip" })}
                </span>
            </div>

            <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    {t("Enhancement status", { ns: "tooltip" })}
                </span>
                <span
                    className={`text-sm font-medium ${
                        status === "ready"
                            ? "text-emerald-500"
                            : status === "failed"
                              ? "text-destructive"
                              : "text-primary"
                    }`}
                >
                    {statusLabel}
                </span>
                {durationMs !== null && status === "ready" && (
                    <span className="text-xs text-muted-foreground">
                        {t("Took {{seconds}} s", {
                            ns: "tooltip",
                            seconds: (durationMs / 1000).toFixed(1),
                        })}
                    </span>
                )}
                {errorMessage && status === "failed" && (
                    <p className="mt-1 text-xs text-destructive whitespace-pre-wrap break-words">
                        {errorMessage}
                    </p>
                )}
                {outputPath && status === "ready" && (
                    <p
                        className="mt-1 text-[11px] text-muted-foreground/70 break-all"
                        title={outputPath}
                    >
                        {outputPath}
                    </p>
                )}
            </div>

            {onRerun && (
                <Button
                    onClick={() => onRerun(modifier.id)}
                    disabled={isBusy}
                    variant="outline"
                    size="sm"
                    className="w-full"
                >
                    <RefreshCw size={ICON.SIZE} className="mr-1.5" />
                    {t("Re-run enhancement", { ns: "tooltip" })}
                </Button>
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
    if (type === "levels")
        return (
            <SlidersHorizontal
                size={ICON.SIZE}
                strokeWidth={ICON.STROKE_WIDTH}
                className={cls}
            />
        );
    if (type === "curves")
        return (
            <TrendingUp
                size={ICON.SIZE}
                strokeWidth={ICON.STROKE_WIDTH}
                className={cls}
            />
        );
    if (type === "gbfen")
        return (
            <Wand2
                size={ICON.SIZE}
                strokeWidth={ICON.STROKE_WIDTH}
                className={cls}
            />
        );
    if (type === "snfen")
        return (
            <Brain
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
    onRerunEnhancement?: (id: string) => void;
}

export function ModifierSettingsDialog({
    modifier,
    imageRef,
    open,
    onClose,
    onUpdate,
    onRerunEnhancement,
}: ModifierSettingsDialogProps) {
    const { t } = useTranslation(["tooltip", "keywords"]);
    const [histogram, setHistogram] = useState<HistogramData | null>(null);

    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    useEffect(() => {
        if (!open || !modifier) {
            setOffset({ x: 0, y: 0 });
            setIsDragging(false);
            return;
        }
        if ((modifier.type === "levels" || modifier.type === "curves") && imageRef.current) {
            setTimeout(() => {
                if (imageRef.current) {
                    setHistogram(computeHistogram(imageRef.current));
                }
            }, 10);
        }
    }, [open, modifier, imageRef]);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.button !== 0) return;
        if ((e.target as HTMLElement).closest("button")) return;

        setIsDragging(true);
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging) return;
        setOffset({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y,
        });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDragging(false);
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    };

    if (!modifier) return null;

    const handleChange = (params: Partial<AnyModifier["params"]>) => {
        onUpdate(modifier.id, params);
    };

    const title =
        modifier.type === "brightness"
            ? t("Brightness", { ns: "tooltip" })
            : modifier.type === "contrast"
              ? t("Contrast", { ns: "tooltip" })
              : modifier.type === "fft"
                ? t("FFT Filter", { ns: "tooltip" })
                : modifier.type === "gbfen"
                  ? t("GBFEN", { ns: "tooltip" })
                  : t("SNFEN", { ns: "tooltip" });

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
                    className="w-[440px] max-w-[95vw] max-h-[85vh] overflow-y-auto p-5 shadow-2xl border border-border/60 z-50 pointer-events-auto transition-none"
                    style={{
                        transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                    }}
                    id={`modifier-settings-dialog-${modifier.id}`}
                    onPointerDownOutside={e => e.preventDefault()}
                    onInteractOutside={e => e.preventDefault()}
                >
                    {/* Title row with explicit close button */}
                    <div
                        className="flex items-center justify-between mb-4 cursor-grab active:cursor-grabbing select-none -m-5 p-5 pb-4 bg-background/95 sticky top-[-1.25rem] z-10 border-b border-border/10"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                    >
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
                    {modifier.type === "levels" && (
                        <LevelsSettings
                            modifier={modifier as LevelsModifier}
                            onChange={p => handleChange(p)}
                            histogram={histogram}
                        />
                    )}
                    {modifier.type === "curves" && (
                        <CurvesSettings
                            modifier={modifier as CurvesModifier}
                            onChange={p => handleChange(p)}
                            histogram={histogram}
                        />
                    )}
                    {isEnhancementModifier(modifier) && (
                        <EnhancementSettings
                            modifier={modifier as EnhancementModifier}
                            onChange={p =>
                                handleChange(
                                    p as Partial<AnyModifier["params"]>
                                )
                            }
                            onRerun={onRerunEnhancement}
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
