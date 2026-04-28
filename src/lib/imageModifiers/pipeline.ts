import { ImageFFT } from "@/lib/fftProcessor";
import { AnyModifier, FftModifier } from "./types";

async function applyFftModifier(
    canvas: HTMLCanvasElement,
    mod: FftModifier
): Promise<void> {
    const { _maskCanvas, _processor, _fftResult } = mod.params;

    // Without a painted mask there is nothing to filter
    if (!_maskCanvas || !_processor || !_fftResult) return;

    const maskCtx = _maskCanvas.getContext("2d");
    if (!maskCtx) return;

    const maskImgData = maskCtx.getImageData(
        0,
        0,
        _maskCanvas.width,
        _maskCanvas.height
    );

    // Re-run forward FFT on the current canvas pixels so we respect upstream edits
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const processor = new ImageFFT(canvas.width, canvas.height);
    const result = processor.forward(imageData);
    const filtered = processor.applyMask(result.complexData, maskImgData.data);
    const output = processor.inverse(filtered, canvas.width, canvas.height);
    ctx.putImageData(output, 0, 0);
}

/**
 * Applies all enabled modifiers to `sourceImg` in sequence.
 * Returns a `Uint8Array` of PNG bytes suitable for writing to disk.
 *
 * The pipeline works as follows:
 *  1. Draw the source image to an offscreen canvas.
 *  2. For each enabled modifier (in order):
 *     - CSS-based modifiers (brightness, contrast): apply via ctx.filter before drawing.
 *     - Canvas-based modifiers (FFT): perform in-place pixel manipulation.
 *  3. Encode the final canvas as a PNG blob and return it.
 */
export async function applyPipelineToImage(
    sourceImg: HTMLImageElement,
    modifiers: AnyModifier[]
): Promise<Uint8Array> {
    const w = sourceImg.naturalWidth || sourceImg.width;
    const h = sourceImg.naturalHeight || sourceImg.height;

    // --- Stage: collect CSS-only modifiers into a single filter string ---
    const cssFilterParts: string[] = [];
    modifiers.forEach(mod => {
        if (mod.enabled) {
            if (mod.type === "brightness") {
                cssFilterParts.push(`brightness(${mod.params.value / 100})`);
            } else if (mod.type === "contrast") {
                cssFilterParts.push(`contrast(${mod.params.value / 100})`);
            }
        }
    });

    // --- Stage 1: draw source with CSS filters applied ---
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");

    if (cssFilterParts.length > 0) {
        ctx.filter = cssFilterParts.join(" ");
    }
    ctx.drawImage(sourceImg, 0, 0, w, h);
    ctx.filter = "none";

    // --- Stage 2: apply canvas-based modifiers in order ---
    for (let i = 0; i < modifiers.length; i += 1) {
        const mod = modifiers[i];
        if (mod && mod.enabled && mod.type === "fft") {
            // eslint-disable-next-line no-await-in-loop
            await applyFftModifier(canvas, mod as FftModifier);
        }
    }

    // --- Encode to PNG ---
    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            b => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
            "image/png",
            1.0
        );
    });
    const buf = await blob.arrayBuffer();
    return new Uint8Array(buf);
}

// (applyFftModifier moved up)
