import { ImageFFT, type FFTResult } from "@/lib/fftProcessor";
import {
    type FftWorkerRequest,
    type FftWorkerResponse,
} from "@/lib/fft.worker";
import { FftParams } from "@/lib/imageModifiers/types";
import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { redrawFftOverlay } from "../fft/fftCanvasUtils";
import { BrushShape, FftStatus, InteractionMode } from "../fft/fftTypes";
import { useFftInit, type FftRefs } from "./useFftInit";
import { useFftPainter } from "./useFftPainter";

export interface UseFftWorkspaceProps {
    imageRef: RefObject<HTMLImageElement | null>;
    spectrumCanvasRef: RefObject<HTMLCanvasElement | null>;
    previewCanvasRef: RefObject<HTMLCanvasElement | null>;
    isActive: boolean;
    initialParams?: Partial<FftParams> | null;
    onToggleActive: (active: boolean) => void;
    onApply: (dataUrl: string, params?: Partial<FftParams>) => void;
    onWheel?: (e: WheelEvent) => void;
    onMiddleDrag?: (dx: number, dy: number) => void;
}

export interface UseFftWorkspaceReturn {
    status: FftStatus;
    brushSize: number;
    setBrushSize: (size: number) => void;
    brushShape: BrushShape;
    setBrushShape: (shape: BrushShape) => void;
    interactionMode: InteractionMode;
    setInteractionMode: (mode: InteractionMode) => void;
    applyFilter: () => void;
    clearMask: () => void;
}

export function useFftWorkspace({
    imageRef,
    spectrumCanvasRef,
    previewCanvasRef,
    isActive,
    initialParams,
    onToggleActive,
    onApply,
    onWheel,
    onMiddleDrag,
}: UseFftWorkspaceProps): UseFftWorkspaceReturn {
    const [brushSize, setBrushSize] = useState(initialParams?.brushSize ?? 7);
    const [brushShape, setBrushShape] = useState<BrushShape>(
        initialParams?.brushShape ?? "circle"
    );
    const [interactionMode, setInteractionMode] =
        useState<InteractionMode>("draw");
    const [status, setStatus] = useState<FftStatus>("idle");

    useEffect(() => {
        if (isActive && initialParams) {
            if (initialParams.brushSize !== undefined) {
                setBrushSize(initialParams.brushSize);
            }
            if (initialParams.brushShape !== undefined) {
                setBrushShape(initialParams.brushShape);
            }
        }
    }, [isActive, initialParams]);

    // Shared mutable refs — owned here, passed by reference to sub-hooks
    const processorRef = useRef<ImageFFT | null>(null);
    const fftResultRef = useRef<FFTResult | null>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const specCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const originalDimsRef = useRef({ w: 0, h: 0 });
    const fftDimsRef = useRef({ w: 0, h: 0 });
    const initialMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const readyRedrawFrameRef = useRef<number | null>(null);

    useEffect(() => {
        if (isActive) {
            // eslint-disable-next-line no-underscore-dangle
            initialMaskCanvasRef.current = initialParams?._maskCanvas ?? null;
        }
    }, [isActive, initialParams]);

    const workerRef = useRef<Worker | null>(null);
    const previewRequestIdRef = useRef<number>(0);

    const brushSizeRef = useRef(brushSize);
    const brushShapeRef = useRef(brushShape);
    brushSizeRef.current = brushSize;
    brushShapeRef.current = brushShape;

    const refs: FftRefs = {
        processorRef,
        fftResultRef,
        maskCanvasRef,
        specCanvasRef,
        originalDimsRef,
        fftDimsRef,
        initialMaskCanvasRef,
    };

    const updateLivePreviewRef = useRef<() => void>(() => {});

    const doRedrawOverlay = useCallback(() => {
        const sc = spectrumCanvasRef.current;
        const specCvs = specCanvasRef.current;
        if (sc && specCvs) redrawFftOverlay(sc, specCvs, maskCanvasRef.current);
    }, [spectrumCanvasRef]);

    const updateLivePreview = useCallback(() => {
        const processor = processorRef.current;
        const fftResult = fftResultRef.current;
        const maskCvs = maskCanvasRef.current;
        const outCvs = previewCanvasRef.current;
        if (!processor || !fftResult || !maskCvs || !outCvs) return;

        const maskCtx = maskCvs.getContext("2d");
        if (!maskCtx) return;

        const maskImgData = maskCtx.getImageData(
            0,
            0,
            fftResult.width,
            fftResult.height
        );
        const { w, h } = fftDimsRef.current;
        previewRequestIdRef.current += 1;
        const reqId = previewRequestIdRef.current;

        const worker = workerRef.current;
        if (worker) {
            // Asynchronously dispatch to Web Worker without blocking UI thread
            const maskBuffer = maskImgData.data.slice().buffer;
            worker.postMessage(
                {
                    id: reqId,
                    type: "INVERSE",
                    complexData: fftResult.complexData,
                    maskData: new Uint8ClampedArray(maskBuffer),
                    maskWidth: fftResult.width,
                    maskHeight: fftResult.height,
                    fftW: w,
                    fftH: h,
                    outputW: w,
                    outputH: h,
                } satisfies FftWorkerRequest,
                [maskBuffer]
            );
        } else {
            // Synchronous fallback
            const filteredData = processor.applyMask(
                fftResult.complexData,
                maskImgData.data,
                fftResult.width,
                fftResult.height
            );
            const raw = processor.inverseRaw(filteredData, w, h);
            const ctx = outCvs.getContext("2d");
            if (ctx) {
                if (outCvs.width !== w || outCvs.height !== h) {
                    outCvs.width = w;
                    outCvs.height = h;
                }
                const imgData = new ImageData(new Uint8ClampedArray(raw), w, h);
                ctx.putImageData(imgData, 0, 0);
            }
        }
    }, [previewCanvasRef]);

    updateLivePreviewRef.current = updateLivePreview;

    // Initialize Web Worker when workspace is active, terminate when deactivated
    useEffect(() => {
        if (!isActive || typeof Worker === "undefined") return undefined;

        try {
            const worker = new Worker(
                new URL("../../../lib/fft.worker.ts", import.meta.url),
                { type: "module" }
            );

            const handleSuccess = (
                msg: Extract<FftWorkerResponse, { type: "INVERSE_SUCCESS" }>
            ) => {
                if (msg.id !== previewRequestIdRef.current) return;
                const outCvs = previewCanvasRef.current;
                if (!outCvs) return;
                const ctx = outCvs.getContext("2d");
                if (!ctx) return;

                if (
                    outCvs.width !== msg.outputW ||
                    outCvs.height !== msg.outputH
                ) {
                    outCvs.width = msg.outputW;
                    outCvs.height = msg.outputH;
                }
                const imgData = new ImageData(
                    new Uint8ClampedArray(msg.pixelData),
                    msg.outputW,
                    msg.outputH
                );
                ctx.putImageData(imgData, 0, 0);
            };

            worker.onmessage = (e: MessageEvent<FftWorkerResponse>) => {
                const msg = e.data;
                if (msg.type === "INVERSE_SUCCESS") {
                    handleSuccess(msg);
                } else if (msg.type === "ERROR") {
                    // eslint-disable-next-line no-console
                    console.error("FFT worker error:", msg.error);
                    workerRef.current = null;
                    updateLivePreviewRef.current();
                }
            };

            worker.onerror = err => {
                // eslint-disable-next-line no-console
                console.error("FFT worker onerror:", err);
                workerRef.current = null;
                updateLivePreviewRef.current();
            };

            workerRef.current = worker;

            return () => {
                worker.terminate();
                workerRef.current = null;
            };
        } catch (err) {
            // eslint-disable-next-line no-console
            console.warn(
                "FFT worker initialization failed, using sync fallback",
                err
            );
            return undefined;
        }
    }, [isActive, previewCanvasRef]);

    const redrawAfterInit = useCallback(() => {
        doRedrawOverlay();
        updateLivePreview();

        if (readyRedrawFrameRef.current !== null) {
            cancelAnimationFrame(readyRedrawFrameRef.current);
        }

        readyRedrawFrameRef.current = requestAnimationFrame(() => {
            readyRedrawFrameRef.current = null;
            doRedrawOverlay();
            updateLivePreview();
        });
    }, [doRedrawOverlay, updateLivePreview]);

    useEffect(() => {
        return () => {
            if (readyRedrawFrameRef.current !== null) {
                cancelAnimationFrame(readyRedrawFrameRef.current);
            }
        };
    }, []);

    useFftInit({
        isActive,
        imageRef,
        spectrumCanvasRef,
        previewCanvasRef,
        refs,
        onToggleActive,
        onStatusChange: setStatus,
        onReady: redrawAfterInit,
    });

    useFftPainter({
        isActive,
        status,
        interactionMode,
        spectrumCanvasRef,
        fftResultRef,
        maskCanvasRef,
        brushSizeRef,
        brushShapeRef,
        onRedrawOverlay: doRedrawOverlay,
        onPreviewUpdate: updateLivePreview,
        onWheel,
        onMiddleDrag,
    });

    const applyFilter = useCallback(() => {
        const outCvs = previewCanvasRef.current;
        if (!outCvs) return;
        setStatus("processing");
        setTimeout(() => {
            const { w: origW, h: origH } = originalDimsRef.current;
            const { w: fftW, h: fftH } = fftDimsRef.current;
            let dataUrl: string;
            if (origW !== fftW || origH !== fftH) {
                const upscaleCvs = document.createElement("canvas");
                upscaleCvs.width = origW;
                upscaleCvs.height = origH;
                const upscaleCtx = upscaleCvs.getContext("2d");
                if (upscaleCtx) {
                    upscaleCtx.drawImage(outCvs, 0, 0, origW, origH);
                    dataUrl = upscaleCvs.toDataURL("image/png");
                } else {
                    dataUrl = outCvs.toDataURL("image/png");
                }
            } else {
                dataUrl = outCvs.toDataURL("image/png");
            }

            let clonedMaskCanvas: HTMLCanvasElement | null = null;
            if (maskCanvasRef.current) {
                clonedMaskCanvas = document.createElement("canvas");
                clonedMaskCanvas.width = maskCanvasRef.current.width;
                clonedMaskCanvas.height = maskCanvasRef.current.height;
                clonedMaskCanvas
                    .getContext("2d")
                    ?.drawImage(maskCanvasRef.current, 0, 0);
            }

            onApply(dataUrl, {
                _maskCanvas: clonedMaskCanvas,
                _processor: processorRef.current,
                _fftResult: fftResultRef.current,
                brushSize: brushSizeRef.current,
                brushShape: brushShapeRef.current,
            });
            onToggleActive(false);
        }, 50);
    }, [onApply, onToggleActive, previewCanvasRef]);

    const clearMask = useCallback(() => {
        const maskCvs = maskCanvasRef.current;
        if (maskCvs) {
            maskCvs
                .getContext("2d")
                ?.clearRect(0, 0, maskCvs.width, maskCvs.height);
        }
        doRedrawOverlay();
        updateLivePreview();
    }, [doRedrawOverlay, updateLivePreview]);

    return {
        status,
        brushSize,
        setBrushSize,
        brushShape,
        setBrushShape,
        interactionMode,
        setInteractionMode,
        applyFilter,
        clearMask,
    };
}
