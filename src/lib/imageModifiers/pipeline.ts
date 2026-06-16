import { ImageFFT } from "@/lib/fftProcessor";
import { 
    AnyModifier, 
    FftModifier,
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
        const [nr, ng, nb] = process(data[i]!, data[i+1]!, data[i+2]!);
        data[i] = nr!;
        data[i+1] = ng!;
        data[i+2] = nb!;
    }
    ctx.putImageData(imageData, 0, 0);
}

function buildLevelsLut(param: LevelParam): Uint8Array {
    const lut = new Uint8Array(256);
    const { black, white, gamma } = param;
    for (let i = 0; i < 256; i++) {
        let val = (i - black) / (white - black || 1);
        val = Math.max(0, Math.min(1, val));
        val = Math.pow(val, 1 / gamma);
        lut[i] = Math.round(val * 255);
    }
    return lut;
}

function applyLevelsModifier(
    canvas: HTMLCanvasElement,
    mod: LevelsModifier
) {
    const lutM = buildLevelsLut(mod.params.master);
    const lutR = buildLevelsLut(mod.params.r);
    const lutG = buildLevelsLut(mod.params.g);
    const lutB = buildLevelsLut(mod.params.b);

    forEachPixel(canvas, (r, g, b) => [
        lutR[lutM[r]!]!, 
        lutG[lutM[g]!]!, 
        lutB[lutM[b]!]!
    ]);
}

export function createMonotoneCubicSpline(points: CurvePoint[]): (x: number) => number {
    const n = points.length;
    if (n < 2) return (_x: number) => points[0]?.y ?? 0;
    
    const dx = new Float32Array(n - 1);
    const dy = new Float32Array(n - 1);
    const m = new Float32Array(n - 1);
    
    for (let i = 0; i < n - 1; i++) {
        dx[i] = points[i+1]!.x - points[i]!.x;
        dy[i] = points[i+1]!.y - points[i]!.y;
        m[i] = dx[i] === 0 ? 0 : dy[i]! / dx[i]!;
    }
    
    const c = new Float32Array(n);
    c[0] = m[0]!;
    for (let i = 1; i < n - 1; i++) {
        if (m[i-1]! * m[i]! <= 0) {
            c[i] = 0;
        } else {
            c[i] = (m[i-1]! + m[i]!) / 2;
        }
    }
    c[n-1] = m[n-2]!;
    
    for (let i = 0; i < n - 1; i++) {
        if (m[i] === 0) {
            c[i] = 0;
            c[i+1] = 0;
        } else {
            const alpha = c[i]! / m[i]!;
            const beta = c[i+1]! / m[i]!;
            const dist = alpha * alpha + beta * beta;
            if (dist > 9) {
                const tau = 3 / Math.sqrt(dist);
                c[i] = tau * alpha * m[i]!;
                c[i+1] = tau * beta * m[i]!;
            }
        }
    }

    return (x: number) => {
        if (x <= points[0]!.x) return points[0]!.y;
        if (x >= points[n-1]!.x) return points[n-1]!.y;

        let i = 0;
        while (i < n - 2 && x >= points[i+1]!.x) i++;

        const h = dx[i]!;
        if (h === 0) return points[i]!.y;
        
        const t = (x - points[i]!.x) / h;
        const t2 = t * t;
        const t3 = t2 * t;

        const h00 = 2*t3 - 3*t2 + 1;
        const h10 = t3 - 2*t2 + t;
        const h01 = -2*t3 + 3*t2;
        const h11 = t3 - t2;

        return h00 * points[i]!.y + h10 * h * c[i]! + h01 * points[i+1]!.y + h11 * h * c[i+1]!;
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

function applyCurvesModifier(
    canvas: HTMLCanvasElement,
    mod: CurvesModifier
) {
    const lutM = buildCurvesLut(mod.params.master);
    const lutR = buildCurvesLut(mod.params.r);
    const lutG = buildCurvesLut(mod.params.g);
    const lutB = buildCurvesLut(mod.params.b);

    forEachPixel(canvas, (r, g, b) => [
        lutR[lutM[r]!]!,
        lutG[lutM[g]!]!,
        lutB[lutM[b]!]!
    ]);
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
        if (mod && mod.enabled) {
            if (mod.type === "fft") {
                // eslint-disable-next-line no-await-in-loop
                await applyFftModifier(canvas, mod as FftModifier);
            } else if (mod.type === "levels") {
                applyLevelsModifier(canvas, mod as LevelsModifier);
            } else if (mod.type === "curves") {
                applyCurvesModifier(canvas, mod as CurvesModifier);
            }
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
