/* eslint-disable no-continue */
/* eslint-disable no-plusplus */
/* eslint-disable prefer-destructuring */
/* eslint-disable security/detect-object-injection */
import { ImageFFT } from "@/lib/fftProcessor";
import {
    AnyModifier,
    BrightnessModifier,
    ContrastModifier,
    DesaturateModifier,
    FftModifier,
    InvertModifier,
    LevelsModifier,
    CurvesModifier,
    LevelParam,
    CurvePoint,
} from "./types";

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

function forEachPixel(
    canvas: HTMLCanvasElement,
    process: (r: number, g: number, b: number) => [number, number, number]
) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const [nr, ng, nb] = process(data[i]!, data[i + 1]!, data[i + 2]!);
        data[i] = nr!;
        data[i + 1] = ng!;
        data[i + 2] = nb!;
    }
    ctx.putImageData(imageData, 0, 0);
}

function applyBrightnessToChannel(channel: number, value: number) {
    if (value === 50) return channel;
    if (value > 50) {
        const amount = (value - 50) / 50;
        return channel + (255 - channel) * amount;
    }

    // Retain tonal information while darkening so contrast can still amplify it.
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

function applyBrightnessModifier(
    canvas: HTMLCanvasElement,
    modifier: BrightnessModifier
) {
    const value = Math.max(0, Math.min(100, modifier.params.value));
    if (value === 50) return;
    forEachPixel(canvas, (r, g, b) => [
        applyBrightnessToChannel(r, value),
        applyBrightnessToChannel(g, value),
        applyBrightnessToChannel(b, value),
    ]);
}

function applyContrastModifier(
    canvas: HTMLCanvasElement,
    modifier: ContrastModifier
) {
    const value = Math.max(0, Math.min(100, modifier.params.value));
    if (value === 50) return;
    forEachPixel(canvas, (r, g, b) => [
        applyContrastToChannel(r, value),
        applyContrastToChannel(g, value),
        applyContrastToChannel(b, value),
    ]);
}

function applyBrightnessContrastStage(
    canvas: HTMLCanvasElement,
    modifiers: AnyModifier[]
) {
    const brightnessModifiers = modifiers.filter(
        (modifier): modifier is BrightnessModifier =>
            modifier.enabled && modifier.type === "brightness"
    );
    const contrastModifiers = modifiers.filter(
        (modifier): modifier is ContrastModifier =>
            modifier.enabled && modifier.type === "contrast"
    );

    if (brightnessModifiers.length <= 1 && contrastModifiers.length <= 1) {
        const brightness = brightnessModifiers[0]?.params.value ?? 50;
        const contrast = contrastModifiers[0]?.params.value ?? 50;
        if (brightness === 50 && contrast === 50) return;
        forEachPixel(canvas, (r, g, b) => {
            const applyPair = (channel: number) =>
                applyContrastToChannel(
                    applyBrightnessToChannel(channel, brightness),
                    contrast
                );
            return [applyPair(r), applyPair(g), applyPair(b)];
        });
        return;
    }

    modifiers.forEach(modifier => {
        if (modifier.enabled && modifier.type === "brightness") {
            applyBrightnessModifier(canvas, modifier);
        } else if (modifier.enabled && modifier.type === "contrast") {
            applyContrastModifier(canvas, modifier);
        }
    });
}

function applyInvertModifier(
    canvas: HTMLCanvasElement,
    modifier: InvertModifier
) {
    const amount = Math.max(0, Math.min(100, modifier.params.value)) / 100;
    if (amount === 0) return;
    forEachPixel(canvas, (r, g, b) => [
        r + (255 - 2 * r) * amount,
        g + (255 - 2 * g) * amount,
        b + (255 - 2 * b) * amount,
    ]);
}

function applyDesaturateModifier(
    canvas: HTMLCanvasElement,
    modifier: DesaturateModifier
) {
    const weights = [
        modifier.params.reds,
        modifier.params.yellows,
        modifier.params.greens,
        modifier.params.cyans,
        modifier.params.blues,
        modifier.params.magentas,
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
        const left = Math.floor(sector) % 6;
        const right = (left + 1) % 6;
        const blend = sector - Math.floor(sector);
        const colorWeight =
            ((((weights[left] ?? 100) * (1 - blend) +
                (weights[right] ?? 100) * blend) /
                100) *
                chroma) /
            255;
        const luminance = r * 0.299 + g * 0.587 + b * 0.114;
        const average = (r + g + b) / 3;
        const grey = luminance * (1 - colorWeight) + average * colorWeight;
        return [grey, grey, grey];
    });
}

function buildLevelsLut(param: LevelParam): Uint8Array {
    const lut = new Uint8Array(256);
    const { black, white, gamma } = param;
    for (let i = 0; i < 256; i++) {
        let val = (i - black) / (white - black || 1);
        val = Math.max(0, Math.min(1, val));
        val **= 1 / gamma;
        lut[i] = Math.round(val * 255);
    }
    return lut;
}

function applyLevelsModifier(canvas: HTMLCanvasElement, mod: LevelsModifier) {
    const lutM = buildLevelsLut(mod.params.master);
    const lutR = buildLevelsLut(mod.params.r);
    const lutG = buildLevelsLut(mod.params.g);
    const lutB = buildLevelsLut(mod.params.b);

    forEachPixel(canvas, (r, g, b) => [
        lutR[lutM[r]!]!,
        lutG[lutM[g]!]!,
        lutB[lutM[b]!]!,
    ]);
}

export function createMonotoneCubicSpline(
    points: CurvePoint[]
): (x: number) => number {
    const n = points.length;
    if (n < 2) return () => points[0]?.y ?? 0;

    const dx = new Float32Array(n - 1);
    const dy = new Float32Array(n - 1);
    const m = new Float32Array(n - 1);

    for (let i = 0; i < n - 1; i++) {
        dx[i] = points[i + 1]!.x - points[i]!.x;
        dy[i] = points[i + 1]!.y - points[i]!.y;
        m[i] = dx[i] === 0 ? 0 : dy[i]! / dx[i]!;
    }

    const c = new Float32Array(n);
    c[0] = m[0]!;
    for (let i = 1; i < n - 1; i++) {
        if (m[i - 1]! * m[i]! <= 0) {
            c[i] = 0;
        } else {
            c[i] = (m[i - 1]! + m[i]!) / 2;
        }
    }
    c[n - 1] = m[n - 2]!;

    for (let i = 0; i < n - 1; i++) {
        if (m[i] === 0) {
            c[i] = 0;
            c[i + 1] = 0;
        } else {
            const alpha = c[i]! / m[i]!;
            const beta = c[i + 1]! / m[i]!;
            const dist = alpha * alpha + beta * beta;
            if (dist > 9) {
                const tau = 3 / Math.sqrt(dist);
                c[i] = tau * alpha * m[i]!;
                c[i + 1] = tau * beta * m[i]!;
            }
        }
    }

    return (x: number) => {
        if (x <= points[0]!.x) return points[0]!.y;
        if (x >= points[n - 1]!.x) return points[n - 1]!.y;

        let i = 0;
        while (i < n - 2 && x >= points[i + 1]!.x) i++;

        const h = dx[i]!;
        if (h === 0) return points[i]!.y;

        const t = (x - points[i]!.x) / h;
        const t2 = t * t;
        const t3 = t2 * t;

        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;

        return (
            h00 * points[i]!.y +
            h10 * h * c[i]! +
            h01 * points[i + 1]!.y +
            h11 * h * c[i + 1]!
        );
    };
}

function buildCurvesLut(points: CurvePoint[]): Uint8Array {
    const lut = new Uint8Array(256);
    const sorted = [...points].sort((a, b) => a.x - b.x);
    const spline = createMonotoneCubicSpline(sorted);
    for (let i = 0; i < 256; i++) {
        lut[i] = Math.max(0, Math.min(255, Math.round(spline(i))));
    }
    return lut;
}

function applyCurvesModifier(canvas: HTMLCanvasElement, mod: CurvesModifier) {
    const lutM = buildCurvesLut(mod.params.master);
    const lutR = buildCurvesLut(mod.params.r);
    const lutG = buildCurvesLut(mod.params.g);
    const lutB = buildCurvesLut(mod.params.b);

    forEachPixel(canvas, (r, g, b) => [
        lutR[lutM[r]!]!,
        lutG[lutM[g]!]!,
        lutB[lutM[b]!]!,
    ]);
}

/**
 * Applies all enabled modifiers to `sourceImg` in sequence.
 * Returns a `Uint8Array` of PNG bytes suitable for writing to disk.
 *
 * Brightness and contrast use the editor's Photoshop-like paired semantics;
 * the remaining pixel modifiers are then applied in list order.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export async function applyPipelineToImage(
    sourceImg: HTMLImageElement,
    modifiers: AnyModifier[]
): Promise<Uint8Array> {
    const w = sourceImg.naturalWidth || sourceImg.width;
    const h = sourceImg.naturalHeight || sourceImg.height;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");

    ctx.drawImage(sourceImg, 0, 0, w, h);
    applyBrightnessContrastStage(canvas, modifiers);

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
                if (
                    mod.params.runtimeOutputUrl &&
                    sourceImg.src === mod.params.runtimeOutputUrl
                ) {
                    continue;
                }
                // eslint-disable-next-line no-await-in-loop
                await applyFftModifier(canvas, mod);
            } else if (mod.type === "levels") {
                applyLevelsModifier(canvas, mod);
            } else if (mod.type === "curves") {
                applyCurvesModifier(canvas, mod);
            }
        }
    }

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
