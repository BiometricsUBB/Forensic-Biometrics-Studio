import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { ImageFFT, type FFTResult } from "@/lib/fftProcessor";
import { useFftInit, type FftRefs } from "./useFftInit";
import { useFftPainter } from "./useFftPainter";
import { redrawFftOverlay } from "../fft/fftCanvasUtils";
import { FftStatus, InteractionMode, BrushShape } from "../fft/fftTypes";

export interface UseFftWorkspaceProps {
    imageRef: RefObject<HTMLImageElement | null>;
    spectrumCanvasRef: RefObject<HTMLCanvasElement | null>;
    previewCanvasRef: RefObject<HTMLCanvasElement | null>;
    isActive: boolean;
    onToggleActive: (active: boolean) => void;
    onApply: (dataUrl: string) => void;
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
    onToggleActive,
    onApply,
    onWheel,
    onMiddleDrag,
}: UseFftWorkspaceProps): UseFftWorkspaceReturn {
    const [brushSize, setBrushSize] = useState(7);
    const [brushShape, setBrushShape] = useState<BrushShape>("circle");
    const [interactionMode, setInteractionMode] =
        useState<InteractionMode>("draw");
    const [status, setStatus] = useState<FftStatus>("idle");

    // Shared mutable refs — owned here, passed by reference to sub-hooks
    const processorRef = useRef<ImageFFT | null>(null);
    const fftResultRef = useRef<FFTResult | null>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const specCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const originalDimsRef = useRef({ w: 0, h: 0 });

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
    };

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
        const filteredData = processor.applyMask(
            fftResult.complexData,
            maskImgData.data,
            fftResult.width,
            fftResult.height
        );

        const { w, h } = originalDimsRef.current;
        const resultImage = processor.inverse(filteredData, w, h);

        const ctx = outCvs.getContext("2d");
        if (ctx) ctx.putImageData(resultImage, 0, 0);
    }, [previewCanvasRef]);

    useFftInit({
        isActive,
        imageRef,
        spectrumCanvasRef,
        previewCanvasRef,
        refs,
        onToggleActive,
        onStatusChange: setStatus,
        onReady: () => {
            doRedrawOverlay();
            updateLivePreview();
        },
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

    useEffect(() => {
        if (!isActive || status !== "ready") return undefined;
        let rafId = 0;
        let nestedRafId = 0;

        rafId = requestAnimationFrame(() => {
            doRedrawOverlay();
            updateLivePreview();

            nestedRafId = requestAnimationFrame(() => {
                doRedrawOverlay();
                updateLivePreview();
            });
        });

        return () => {
            cancelAnimationFrame(rafId);
            cancelAnimationFrame(nestedRafId);
        };
    }, [isActive, status, doRedrawOverlay, updateLivePreview]);

    const applyFilter = useCallback(() => {
        const outCvs = previewCanvasRef.current;
        if (!outCvs) return;
        setStatus("processing");
        setTimeout(() => {
            const dataUrl = outCvs.toDataURL("image/png");
            onApply(dataUrl);
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
