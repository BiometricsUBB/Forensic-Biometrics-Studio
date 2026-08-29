import FFT from "fft.js";

/* eslint-disable */
export interface FFTResult {
    complexData: Float32Array;
    width: number;
    height: number;
    spectrum: Uint8Array;
}

const MAX_FFT_SIZE = 4096;

function nextPow2(n: number): number {
    if (!n || n <= 0) return 256;
    const power = 2 ** Math.ceil(Math.log2(n));
    if (power > MAX_FFT_SIZE) return MAX_FFT_SIZE;
    if (power < 256) return 256;
    return power;
}

export interface ImageLike {
    data: Uint8ClampedArray | Uint8Array;
    width: number;
    height: number;
}

/** Convert image pixels to grayscale complex array (real, imag=0). */
function imageToGrayscaleComplex(
    imageData: ImageLike,
    w: number,
    h: number
): Float32Array {
    const data = new Float32Array(w * h * 2);
    const pixels = imageData.data;
    const imgWidth = imageData.width;
    const imgHeight = imageData.height;

    // To prevent high-frequency artifacts (cuts/ringing) from nearest-neighbor stretching,
    // we simply embed the image and use edge replication for padding borders.
    for (let y = 0; y < h; y++) {
        const srcY = y < imgHeight ? y : imgHeight - 1;
        const yOffset = srcY * imgWidth;
        const outRow = y * w * 2;

        for (let x = 0; x < w; x++) {
            const srcX = x < imgWidth ? x : imgWidth - 1;
            const p = (yOffset + srcX) * 4;

            // Weighted grayscale algorithm
            const gray =
                (pixels[p] ?? 0) * 0.299 +
                (pixels[p + 1] ?? 0) * 0.587 +
                (pixels[p + 2] ?? 0) * 0.114;

            const idx = outRow + x * 2;
            data[idx] = gray;
            data[idx + 1] = 0;
        }
    }
    return data;
}

/** Run 1D FFT along rows in-place. */
function fftRows(
    data: Float32Array,
    w: number,
    h: number,
    fftInstance: InstanceType<typeof FFT>,
    inverse = false
): void {
    const input = new Float32Array(w * 2);
    const output = new Float32Array(w * 2);
    const w2 = w * 2;

    for (let y = 0; y < h; y++) {
        const off = y * w2;
        for (let k = 0; k < w2; k++) input[k] = data[off + k]!;

        if (inverse) {
            fftInstance.inverseTransform(output, input);
            for (let k = 0; k < w2; k++) data[off + k] = output[k]!;
        } else {
            fftInstance.transform(output, input);
            for (let k = 0; k < w2; k++) data[off + k] = output[k]!;
        }
    }
}

/** Run 1D FFT along columns in-place. */
function fftCols(
    data: Float32Array,
    w: number,
    h: number,
    fftInstance: InstanceType<typeof FFT>,
    inverse = false
): void {
    const colIn = new Float32Array(h * 2);
    const colOut = new Float32Array(h * 2);

    for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
            const i = 2 * (y * w + x);
            colIn[2 * y] = data[i]!;
            colIn[2 * y + 1] = data[i + 1]!;
        }

        if (inverse) {
            fftInstance.inverseTransform(colOut, colIn);
            for (let y = 0; y < h; y++) {
                const i = 2 * (y * w + x);
                data[i] = colOut[2 * y]!;
                data[i + 1] = colOut[2 * y + 1]!;
            }
        } else {
            fftInstance.transform(colOut, colIn);
            for (let y = 0; y < h; y++) {
                const i = 2 * (y * w + x);
                data[i] = colOut[2 * y]!;
                data[i + 1] = colOut[2 * y + 1]!;
            }
        }
    }
}

/** Compute log-magnitude spectrum with DC-center shift. */
function computeSpectrum(data: Float32Array, w: number, h: number): Uint8Array {
    const size = w * h;
    const spectrum = new Uint8Array(size * 4);
    const mags = new Float32Array(size);
    let minMag = Infinity;
    let maxMag = -Infinity;

    for (let i = 0; i < size; i++) {
        const re = data[2 * i]!;
        const im = data[2 * i + 1]!;
        const m = i === 0 ? 0 : Math.log(1 + Math.sqrt(re * re + im * im));
        mags[i] = m;
        if (i > 0) {
            if (m < minMag) minMag = m;
            if (m > maxMag) maxMag = m;
        }
    }

    if (maxMag <= minMag) maxMag = minMag + 1;
    const range = maxMag - minMag;

    // Ensure accurate integer offsets
    const halfW = (w / 2) | 0;
    const halfH = (h / 2) | 0;

    for (let y = 0; y < h; y++) {
        // Fast boolean branches to eliminate extreme CPU overhead of Modulo division
        const shiftY = y < halfH ? y + halfH : y - halfH;
        const yOffsetDst = shiftY * w;
        const yOffsetSrc = y * w;

        for (let x = 0; x < w; x++) {
            const shiftX = x < halfW ? x + halfW : x - halfW;
            const dstIdx = (yOffsetDst + shiftX) * 4;

            // Direct mapping without layered nested function calls
            const rawMag = mags[yOffsetSrc + x] ?? 0;
            let normalizedFloat = (rawMag - minMag) / range;

            normalizedFloat = Math.pow(normalizedFloat, 3);

            let val = normalizedFloat * 255;

            // Fast physical bounds checks without Math.min/Math.max nested tree allocation
            if (val < 0) val = 0;
            if (val > 255) val = 255;

            // Fast Int truncation
            const norm = val | 0;

            spectrum[dstIdx] = norm;
            spectrum[dstIdx + 1] = norm;
            spectrum[dstIdx + 2] = norm;
            spectrum[dstIdx + 3] = 255;
        }
    }

    return spectrum;
}

export class ImageFFT {
    private rowFFT: InstanceType<typeof FFT>;

    private colFFT: InstanceType<typeof FFT>;

    readonly width: number;

    readonly height: number;

    constructor(width: number, height: number) {
        this.width = nextPow2(width);
        this.height = nextPow2(height);
        try {
            this.rowFFT = new FFT(this.width);
            this.colFFT = new FFT(this.height);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error("FFT Init Error:", e);
            this.width = 1024;
            this.height = 1024;
            this.rowFFT = new FFT(1024);
            this.colFFT = new FFT(1024);
        }
    }

    /** Compute forward 2D FFT and return complex data + log-magnitude spectrum. */
    forward(imageData: ImageLike): FFTResult {
        if (!imageData || !imageData.data || imageData.data.length === 0) {
            return {
                complexData: new Float32Array(0),
                width: 0,
                height: 0,
                spectrum: new Uint8Array(0),
            };
        }

        const data = imageToGrayscaleComplex(
            imageData,
            this.width,
            this.height
        );
        fftRows(data, this.width, this.height, this.rowFFT);
        fftCols(data, this.width, this.height, this.colFFT);
        const spectrum = computeSpectrum(data, this.width, this.height);

        return {
            complexData: data,
            width: this.width,
            height: this.height,
            spectrum,
        };
    }

    applyMask(
        complexData: Float32Array,
        maskData: Uint8ClampedArray,
        maskWidth: number = this.width,
        maskHeight: number = this.height
    ): Float32Array {
        const filtered = new Float32Array(complexData);
        const halfW = (this.width / 2) | 0;
        const halfH = (this.height / 2) | 0;

        const scaleX = maskWidth / this.width;
        const scaleY = maskHeight / this.height;

        for (let y = 0; y < this.height; y++) {
            // y is the complexData un-shifted index (DC at 0)
            const shiftY = y < halfH ? y + halfH : y - halfH;

            let my = (shiftY * scaleY) | 0;
            if (my < 0) my = 0;
            if (my > maskHeight - 1) my = maskHeight - 1;
            const myBase = my * maskWidth;

            const rowOffset = y * this.width;

            for (let x = 0; x < this.width; x++) {
                const shiftX = x < halfW ? x + halfW : x - halfW;

                let mx = (shiftX * scaleX) | 0;
                if (mx < 0) mx = 0;
                if (mx > maskWidth - 1) mx = maskWidth - 1;

                const maskIdx = (myBase + mx) * 4;

                const R = maskData[maskIdx] ?? 0;
                const A = maskData[maskIdx + 3] ?? 0;

                if (A > 150 && R > 150) {
                    const G = maskData[maskIdx + 1] ?? 0;
                    const B = maskData[maskIdx + 2] ?? 0;

                    const isRedBrush = G < 50 && B < 50;

                    // Do not zero DC component
                    if (isRedBrush && !(x === 0 && y === 0)) {
                        const idx = 2 * (rowOffset + x);
                        filtered[idx] = 0;
                        filtered[idx + 1] = 0;

                        // Enforce conjugate symmetry immediately for zeroed frequencies
                        const conjY = (this.height - y) % this.height;
                        const conjX = (this.width - x) % this.width;
                        const conjIdx = 2 * (conjY * this.width + conjX);
                        filtered[conjIdx] = 0;
                        filtered[conjIdx + 1] = 0;
                    }
                }
            }
        }

        return filtered;
    }

    /** Compute inverse 2D FFT and return reconstructed raw RGBA pixels (Uint8ClampedArray). */
    inverseRaw(
        complexData: Float32Array,
        outputW: number,
        outputH: number
    ): Uint8ClampedArray {
        const data = new Float32Array(complexData);

        fftCols(data, this.width, this.height, this.colFFT, true);
        fftRows(data, this.width, this.height, this.rowFFT, true);

        return this.scaleToRaw(data, outputW, outputH);
    }

    /** Compute inverse 2D FFT and return the reconstructed ImageData. */
    inverse(
        complexData: Float32Array,
        outputW: number,
        outputH: number
    ): ImageData {
        const raw = this.inverseRaw(complexData, outputW, outputH);
        if (typeof ImageData !== "undefined") {
            return new ImageData(raw, outputW, outputH);
        }
        return {
            data: raw,
            width: outputW,
            height: outputH,
            colorSpace: "srgb",
        } as unknown as ImageData;
    }

    /** Scale complex result to output dimensions and normalize to 8-bit grayscale safely. */
    private scaleToRaw(
        data: Float32Array,
        outputW: number,
        outputH: number
    ): Uint8ClampedArray {
        const result = new Uint8ClampedArray(outputW * outputH * 4);
        const safeW = Math.min(outputW, this.width);
        const safeH = Math.min(outputH, this.height);

        for (let y = 0; y < safeH; y++) {
            // We placed the image without stretching, so read it back 1:1
            const yOffset = y * this.width;
            const outRow = y * outputW;

            for (let x = 0; x < safeW; x++) {
                const idx = 2 * (yOffset + x);

                // Directly map the real component.
                // Enforcing inverse mask symmetry ensures the imaginary component is safely ~0.
                const val = data[idx] ?? 0;

                let clamped = val;
                if (clamped < 0) clamped = 0;
                if (clamped > 255) clamped = 255;
                const normInt = clamped | 0;

                const pIdx = (outRow + x) * 4;
                result[pIdx] = normInt;
                result[pIdx + 1] = normInt;
                result[pIdx + 2] = normInt;
                result[pIdx + 3] = 255;
            }
        }

        return result;
    }
}
