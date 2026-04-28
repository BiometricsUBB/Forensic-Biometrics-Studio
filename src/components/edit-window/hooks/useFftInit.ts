/* eslint-disable no-param-reassign */
/* eslint-disable no-console */
import React, { RefObject, useEffect } from "react";
import { ImageFFT, type FFTResult } from "@/lib/fftProcessor";
import { FftStatus } from "../fft/fftTypes";

// this file contains fft lifecycle
// init processor,build offscreen canvas

export interface FftRefs {
    processorRef: React.MutableRefObject<ImageFFT | null>;
    fftResultRef: React.MutableRefObject<FFTResult | null>;
    maskCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
    specCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
    originalDimsRef: React.MutableRefObject<{ w: number; h: number }>;
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

            refs.processorRef.current = null;
            refs.fftResultRef.current = null;
            refs.maskCanvasRef.current = null;
            refs.specCanvasRef.current = null;

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
                const w = img.naturalWidth;
                const h = img.naturalHeight;
                refs.originalDimsRef.current = { w, h };

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

                refs.processorRef.current = processor;
                refs.fftResultRef.current = result;

                const maskCvs = document.createElement("canvas");
                maskCvs.width = result.width;
                maskCvs.height = result.height;
                refs.maskCanvasRef.current = maskCvs;

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
                refs.specCanvasRef.current = specCvs;

                sc.width = w;
                sc.height = h;
                sc.style.pointerEvents = "auto";
                pc.width = w;
                pc.height = h;
                pc.style.pointerEvents = "none";

                onReady();
                onStatusChange("ready");
            } catch (err) {
                console.error("FFT init failed", err);
                onStatusChange("idle");
                onToggleActive(false);
            }
        }, 50);

        return () => clearTimeout(timer);
    }, [isActive, imageRef, spectrumCanvasRef, previewCanvasRef]);
}
