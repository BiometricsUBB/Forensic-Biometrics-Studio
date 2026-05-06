import FFT from "fft.js";

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

/** Convert image pixels to grayscale complex array (real, imag=0). */
function imageToGrayscaleComplex(
    imageData: ImageData,
    w: number,
    h: number
): Float32Array {
    const data = new Float32Array(w * h * 2);
    const pixels = imageData.data;
    const scaleX = imageData.width / w;
    const scaleY = imageData.height / h;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const p =
                (Math.floor(y * scaleY) * imageData.width +
                    Math.floor(x * scaleX)) *
                4;
            const gray =
                (pixels[p] ?? 0) * 0.299 +
                (pixels[p + 1] ?? 0) * 0.587 +
                (pixels[p + 2] ?? 0) * 0.114;
            const idx = 2 * (y * w + x);
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

    for (let y = 0; y < h; y++) {
        const off = y * w * 2;
        for (let k = 0; k < w * 2; k++) input[k] = data[off + k]!;

        if (inverse) {
            fftInstance.inverseTransform(output, input);
            for (let k = 0; k < w * 2; k++) data[off + k] = output[k]! / w;
        } else {
            fftInstance.transform(output, input);
            for (let k = 0; k < w * 2; k++) data[off + k] = output[k]!;
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
                data[i] = colOut[2 * y]! / h;
                data[i + 1] = colOut[2 * y + 1]! / h;
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
            minMag = Math.min(minMag, m);
            maxMag = Math.max(maxMag, m);
        }
    }

    if (maxMag <= minMag) maxMag = minMag + 1;
    const range = maxMag - minMag;
    const halfW = w / 2;
    const halfH = h / 2;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const dstIdx = (((y + halfH) % h) * w + ((x + halfW) % w)) * 4;
            const val = Math.max(
                0,
                Math.min(255, (((mags[y * w + x] ?? 0) - minMag) / range) * 255)
            );
            spectrum[dstIdx] = val;
            spectrum[dstIdx + 1] = val;
            spectrum[dstIdx + 2] = val;
            spectrum[dstIdx + 3] = 255;
        }
    }

    return spectrum;
}

/**
 * 2D FFT image processor.
 *
 * Converts an image to its frequency-domain representation,
 * allows masking frequency components, and reconstructs
 * the filtered image via inverse FFT.
 */
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
            console.error("FFT Init Error:", e);
            this.width = 1024;
            this.height = 1024;
            this.rowFFT = new FFT(1024);
            this.colFFT = new FFT(1024);
        }
    }

    /** Compute forward 2D FFT and return complex data + log-magnitude spectrum. */
    forward(imageData: ImageData): FFTResult {
        if (!imageData) {
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

    /** Zero-out frequency components where the mask overlay has red brush strokes. */
    applyMask(
        complexData: Float32Array,
        maskData: Uint8ClampedArray
    ): Float32Array {
        const filtered = new Float32Array(complexData);
        const halfW = this.width / 2;
        const halfH = this.height / 2;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const shiftX = (x + halfW) % this.width;
                const shiftY = (y + halfH) % this.height;
                const maskIdx = (y * this.width + x) * 4;

                const R = maskData[maskIdx] ?? 0;
                const G = maskData[maskIdx + 1] ?? 0;
                const B = maskData[maskIdx + 2] ?? 0;

                // Detect dark-red brush strokes (R > 150, G/B < 50)
                const isRedBrush = R > 150 && G < 50 && B < 50;

                if (isRedBrush && !(shiftX === 0 && shiftY === 0)) {
                    const idx = 2 * (shiftY * this.width + shiftX);
                    filtered[idx] = 0;
                    filtered[idx + 1] = 0;
                }
            }
        }
        return filtered;
    }

    /** Compute inverse 2D FFT and return the reconstructed image. */
    inverse(
        complexData: Float32Array,
        outputW: number,
        outputH: number
    ): ImageData {
        const data = new Float32Array(complexData);

        fftCols(data, this.width, this.height, this.colFFT, true);
        fftRows(data, this.width, this.height, this.rowFFT, true);

        return this.scaleToImage(data, outputW, outputH);
    }

    /** Scale complex result to output dimensions and normalize to 8-bit grayscale. */
    private scaleToImage(
        data: Float32Array,
        outputW: number,
        outputH: number
    ): ImageData {
        const result = new ImageData(outputW, outputH);
        const scaleX = this.width / outputW;
        const scaleY = this.height / outputH;
        let minVal = Infinity;
        let maxVal = -Infinity;
        const pixelValues = new Float32Array(outputW * outputH);

        for (let y = 0; y < outputH; y++) {
            for (let x = 0; x < outputW; x++) {
                const srcX = Math.min(Math.floor(x * scaleX), this.width - 1);
                const srcY = Math.min(Math.floor(y * scaleY), this.height - 1);
                const idx = 2 * (srcY * this.width + srcX);
                const re = data[idx]!;
                const im = data[idx + 1]!;
                const val = Math.sqrt(re * re + im * im);
                pixelValues[y * outputW + x] = val;
                minVal = Math.min(minVal, val);
                maxVal = Math.max(maxVal, val);
            }
        }

        if (maxVal <= minVal) maxVal = minVal + 0.0001;
        const resRange = maxVal - minVal;

        for (let i = 0; i < pixelValues.length; i++) {
            const normalized =
                (((pixelValues[i] ?? 0) - minVal) / resRange) * 255;
            const pIdx = i * 4;
            result.data[pIdx] = normalized;
            result.data[pIdx + 1] = normalized;
            result.data[pIdx + 2] = normalized;
            result.data[pIdx + 3] = 255;
        }

        return result;
    }
}
