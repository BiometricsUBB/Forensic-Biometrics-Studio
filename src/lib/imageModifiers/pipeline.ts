import { ImageFFT } from "@/lib/fftProcessor";
import {
    AnyModifier,
    BrightnessModifier,
    ContrastModifier,
    DesaturateModifier,
    FftModifier,
    InvertModifier,
} from "./types";

function clampByte(value: number): number {
    return Math.max(0, Math.min(255, Math.round(value)));
}

function forEachPixel(
    canvas: HTMLCanvasElement,
    transform: (r: number, g: number, b: number) => [number, number, number]
) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = imageData;
    for (let i = 0; i < data.length; i += 4) {
        const [r, g, b] = transform(data[i]!, data[i + 1]!, data[i + 2]!);
        data[i] = clampByte(r);
        data[i + 1] = clampByte(g);
        data[i + 2] = clampByte(b);
    }
    ctx.putImageData(imageData, 0, 0);
}

function applyBrightnessToChannel(channel: number, value: number) {
    if (value === 50) return channel;
    if (value > 50) {
        const amount = (value - 50) / 50;
        return channel + (255 - channel) * amount;
    }

    // Darkening must not multiply the channel to zero, otherwise max contrast
    // has no remaining color information to amplify. This mirrors graphics
    // editors better for saturated forensic ruler images.
    const amount = (50 - value) / 50;
    return channel - 127 * amount;
}

function applyContrastToChannel(channel: number, value: number) {
    if (value === 50) return channel;

    if (value < 50) {
        const factor = value / 50;
        return 128 + (channel - 128) * factor;
    }

    const contrast = ((value - 50) / 50) * 254;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    return 128 + factor * (channel - 128);
}

function applyBrightnessContrastModifiers(
    canvas: HTMLCanvasElement,
    brightnessModifier: BrightnessModifier | undefined,
    contrastModifier: ContrastModifier | undefined
) {
    const brightnessValue = Math.max(
        0,
        Math.min(100, brightnessModifier?.params.value ?? 50)
    );
    const contrastValue = Math.max(
        0,
        Math.min(100, contrastModifier?.params.value ?? 50)
    );

    if (brightnessValue === 50 && contrastValue === 50) return;

    const applyPair = (channel: number) => {
        const brightened = applyBrightnessToChannel(channel, brightnessValue);
        return applyContrastToChannel(brightened, contrastValue);
    };

    forEachPixel(canvas, (r, g, b) => [
        applyPair(r),
        applyPair(g),
        applyPair(b),
    ]);
}

function applyBrightnessModifier(
    canvas: HTMLCanvasElement,
    mod: BrightnessModifier
) {
    const value = Math.max(0, Math.min(100, mod.params.value));
    if (value === 50) return;

    forEachPixel(canvas, (r, g, b) => [
        applyBrightnessToChannel(r, value),
        applyBrightnessToChannel(g, value),
        applyBrightnessToChannel(b, value),
    ]);
}

function applyContrastModifier(
    canvas: HTMLCanvasElement,
    mod: ContrastModifier
) {
    const value = Math.max(0, Math.min(100, mod.params.value));
    if (value === 50) return;

    forEachPixel(canvas, (r, g, b) => [
        applyContrastToChannel(r, value),
        applyContrastToChannel(g, value),
        applyContrastToChannel(b, value),
    ]);
}

function applyInvertModifier(canvas: HTMLCanvasElement, mod: InvertModifier) {
    const amount = Math.max(0, Math.min(100, mod.params.value)) / 100;
    if (amount === 0) return;
    forEachPixel(canvas, (r, g, b) => [
        r + (255 - 2 * r) * amount,
        g + (255 - 2 * g) * amount,
        b + (255 - 2 * b) * amount,
    ]);
}

function applyDesaturateModifier(
    canvas: HTMLCanvasElement,
    mod: DesaturateModifier
) {
    const colorRangeWeights = [
        mod.params.reds,
        mod.params.yellows,
        mod.params.greens,
        mod.params.cyans,
        mod.params.blues,
        mod.params.magentas,
    ];

    forEachPixel(canvas, (r, g, b) => {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const chroma = max - min;
        let hue = 0;

        if (chroma !== 0) {
            if (max === r) hue = ((g - b) / chroma + (g < b ? 6 : 0)) * 60;
            else if (max === g) hue = ((b - r) / chroma + 2) * 60;
            else hue = ((r - g) / chroma + 4) * 60;
        }

        const sector = hue / 60;
        const leftIndex = Math.floor(sector) % 6;
        const rightIndex = (leftIndex + 1) % 6;
        const blend = sector - Math.floor(sector);
        const leftWeight = colorRangeWeights[leftIndex] ?? 100;
        const rightWeight = colorRangeWeights[rightIndex] ?? 100;
        const colorWeight =
            ((leftWeight * (1 - blend) + rightWeight * blend) / 100) *
            (chroma / 255);
        const luminance = r * 0.299 + g * 0.587 + b * 0.114;
        const average = (r + g + b) / 3;
        const grey = luminance * (1 - colorWeight) + average * colorWeight;

        return [grey, grey, grey];
    });
}

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

function drawSourceToCanvas(sourceImg: HTMLImageElement): HTMLCanvasElement {
    const w = sourceImg.naturalWidth || sourceImg.width;
    const h = sourceImg.naturalHeight || sourceImg.height;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");
    ctx.drawImage(sourceImg, 0, 0, w, h);
    return canvas;
}

function applyBrightnessContrastStage(
    canvas: HTMLCanvasElement,
    modifiers: AnyModifier[]
) {
    const brightnessModifiers = modifiers.filter(
        (mod): mod is BrightnessModifier =>
            mod.enabled && mod.type === "brightness"
    );
    const contrastModifiers = modifiers.filter(
        (mod): mod is ContrastModifier => mod.enabled && mod.type === "contrast"
    );

    if (brightnessModifiers.length <= 1 && contrastModifiers.length <= 1) {
        const [brightnessModifier] = brightnessModifiers;
        const [contrastModifier] = contrastModifiers;
        applyBrightnessContrastModifiers(
            canvas,
            brightnessModifier,
            contrastModifier
        );
        return;
    }

    modifiers.forEach(mod => {
        if (mod.enabled && mod.type === "brightness") {
            applyBrightnessModifier(canvas, mod);
        } else if (mod.enabled && mod.type === "contrast") {
            applyContrastModifier(canvas, mod);
        }
    });
}

async function applyNonBrightnessContrastStage(
    canvas: HTMLCanvasElement,
    modifiers: AnyModifier[]
) {
    for (let i = 0; i < modifiers.length; i += 1) {
        const mod = modifiers[i];
        if (
            mod &&
            mod.enabled &&
            mod.type !== "brightness" &&
            mod.type !== "contrast"
        ) {
            if (mod.type === "invert") {
                applyInvertModifier(canvas, mod);
            } else if (mod.type === "desaturate") {
                applyDesaturateModifier(canvas, mod);
            } else if (mod.type === "fft") {
                // eslint-disable-next-line no-await-in-loop
                await applyFftModifier(canvas, mod as FftModifier);
            }
        }
    }
}

async function encodeCanvasToPng(canvas: HTMLCanvasElement) {
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

/**
 * Applies all enabled modifiers to `sourceImg` in sequence.
 * Returns a `Uint8Array` of PNG bytes suitable for writing to disk.
 *
 * The pipeline works as follows:
 *  1. Draw the source image to an offscreen canvas.
 *  2. Apply Photoshop-like brightness/contrast as a pair.
 *  3. Apply the remaining enabled modifiers in list order.
 *  4. Encode the final canvas as a PNG blob and return it.
 */
export async function applyPipelineToImage(
    sourceImg: HTMLImageElement,
    modifiers: AnyModifier[]
): Promise<Uint8Array> {
    const canvas = drawSourceToCanvas(sourceImg);
    applyBrightnessContrastStage(canvas, modifiers);
    await applyNonBrightnessContrastStage(canvas, modifiers);
    return encodeCanvasToPng(canvas);
}
