/* eslint-disable no-param-reassign */
/* eslint-disable no-console */
/* eslint-disable security/detect-object-injection */
import { ImageFFT, type FFTResult } from "@/lib/fftProcessor";
import React, { RefObject, useEffect } from "react";
import { FftStatus } from "../fft/fftTypes";

// this file contains fft lifecycle
// init processor,build offscreen canvas

export interface FftRefs {
    processorRef: React.MutableRefObject<ImageFFT | null>;
    fftResultRef: React.MutableRefObject<FFTResult | null>;
    maskCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
    specCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
    originalDimsRef: React.MutableRefObject<{ w: number; h: number }>;
    fftDimsRef: React.MutableRefObject<{ w: number; h: number }>;
    initialMaskCanvasRef?: React.MutableRefObject<HTMLCanvasElement | null>;
}

export function useFftInit({
    isActive,
    imageRef,
    spectrumCanvasRef,
    previewCanvasRef,
    refs,
    onToggleActive,
    onReady,
    onStatusChange,
}: {
    isActive: boolean;
    imageRef: RefObject<HTMLImageElement | null>;
    spectrumCanvasRef: RefObject<HTMLCanvasElement | null>;
    previewCanvasRef: RefObject<HTMLCanvasElement | null>;
    refs: FftRefs;
    onToggleActive: (active: boolean) => void;
    onReady: () => void;
    onStatusChange: (status: FftStatus) => void;
}) {
    const {
        processorRef,
        fftResultRef,
        maskCanvasRef,
        specCanvasRef,
        originalDimsRef,
        fftDimsRef,
        initialMaskCanvasRef,
    } = refs;

    useEffect(() => {
        if (!isActive) {
            spectrumCanvasRef.current
                ?.getContext("2d")
                ?.clearRect(
                    0,
                    0,
                    spectrumCanvasRef.current.width,
                    spectrumCanvasRef.current.height
                );
            if (spectrumCanvasRef.current)
                spectrumCanvasRef.current.style.pointerEvents = "none";

            previewCanvasRef.current
                ?.getContext("2d")
                ?.clearRect(
                    0,
                    0,
                    previewCanvasRef.current.width,
                    previewCanvasRef.current.height
                );
            if (previewCanvasRef.current)
                previewCanvasRef.current.style.pointerEvents = "none";

            processorRef.current = null;
            fftResultRef.current = null;
            maskCanvasRef.current = null;
            specCanvasRef.current = null;
            originalDimsRef.current = { w: 0, h: 0 };
            fftDimsRef.current = { w: 0, h: 0 };

            onStatusChange("idle");
            return undefined;
        }

        const img = imageRef.current;
        const sc = spectrumCanvasRef.current;
        const pc = previewCanvasRef.current;
        if (!img || !sc || !pc) return undefined;

        onStatusChange("loading");

        const timer = setTimeout(() => {
            try {
                const origW = img.naturalWidth;
                const origH = img.naturalHeight;
                originalDimsRef.current = { w: origW, h: origH };

                // Downscale image if either dimension exceeds 4096px
                const maxDim = 4096;
                let fftW = origW;
                let fftH = origH;
                if (origW > maxDim || origH > maxDim) {
                    const scale = Math.min(maxDim / origW, maxDim / origH);
                    fftW = Math.round(origW * scale);
                    fftH = Math.round(origH * scale);
                }
                fftDimsRef.current = { w: fftW, h: fftH };

                const tmpCvs = document.createElement("canvas");
                tmpCvs.width = fftW;
                tmpCvs.height = fftH;
                const tmpCtx = tmpCvs.getContext("2d", {
                    willReadFrequently: true,
                });
                if (!tmpCtx) throw new Error("Canvas context unavailable");

                tmpCtx.drawImage(img, 0, 0, fftW, fftH);
                const imageData = tmpCtx.getImageData(0, 0, fftW, fftH);

                const processor = new ImageFFT(fftW, fftH);
                const result = processor.forward(imageData);

                processorRef.current = processor;
                fftResultRef.current = result;

                const maskCvs = document.createElement("canvas");
                maskCvs.width = result.width;
                maskCvs.height = result.height;
                if (initialMaskCanvasRef?.current) {
                    const maskCtx = maskCvs.getContext("2d");
                    if (maskCtx) {
                        maskCtx.drawImage(
                            initialMaskCanvasRef.current,
                            0,
                            0,
                            result.width,
                            result.height
                        );
                    }
                }
                maskCanvasRef.current = maskCvs;

                const specCvs = document.createElement("canvas");
                specCvs.width = result.width;
                specCvs.height = result.height;
                const specCtx = specCvs.getContext("2d");
                if (specCtx) {
                    specCtx.putImageData(
                        new ImageData(
                            new Uint8ClampedArray(result.spectrum),
                            result.width,
                            result.height
                        ),
                        0,
                        0
                    );
                }
                specCanvasRef.current = specCvs;

                sc.width = fftW;
                sc.height = fftH;
                sc.style.pointerEvents = "auto";
                pc.width = fftW;
                pc.height = fftH;
                pc.style.pointerEvents = "none";

                const pcCtx = pc.getContext("2d");
                if (pcCtx) {
                    const grayData = new ImageData(fftW, fftH);
                    const srcData = imageData.data;
                    const dstData = grayData.data;
                    for (let i = 0; i < srcData.length; i += 4) {
                        const gray = Math.round(
                            (srcData[i] ?? 0) * 0.299 +
                                (srcData[i + 1] ?? 0) * 0.587 +
                                (srcData[i + 2] ?? 0) * 0.114
                        );
                        dstData[i] = gray;
                        dstData[i + 1] = gray;
                        dstData[i + 2] = gray;
                        dstData[i + 3] = 255;
                    }
                    pcCtx.putImageData(grayData, 0, 0);
                }

                onReady();
                onStatusChange("ready");
            } catch (err) {
                console.error("FFT init failed", err);
                onStatusChange("idle");
                onToggleActive(false);
            }
        }, 50);

        return () => clearTimeout(timer);
    }, [
        isActive,
        imageRef,
        spectrumCanvasRef,
        previewCanvasRef,
        processorRef,
        fftResultRef,
        maskCanvasRef,
        specCanvasRef,
        originalDimsRef,
        fftDimsRef,
        initialMaskCanvasRef,
        onReady,
        onStatusChange,
        onToggleActive,
    ]);
}
