/**
 * Turns a loaded shoeprint image into the edge point cloud that the shoeprintr
 * comparison consumes.
 */

/** Output resolution, in units per millimetre */
export const CANONICAL_UNITS_PER_MM = 2.4;

/** Used when the image has no DPI: scale the longer side to this many units. */
export const FALLBACK_LONG_SIDE = 700;

export const DEFAULT_MAX_POINTS = 15000;

/** Below this the comparison is very unlikely to find usable correspondences. */
export const MIN_USABLE_POINTS = 1500;

/**
 * Extra radius shoeprintr adds when it searches the known print: it cuts the
 * print into quadrants and slides a circle of (region radius + 15) inside one.
 */
export const REFERENCE_SEARCH_MARGIN = 15;

/** Whether three regions of `radius` leave the search anything to slide over. */
export const regionsFitPrint = (
    radius: number,
    width: number,
    height: number
): boolean => radius + REFERENCE_SEARCH_MARGIN <= Math.min(width, height) / 2;

export type Point = { x: number; y: number };

export type EdgeExtractionOptions = {
    /** Image resolution in dots per inch. Omit or null when unknown. */
    dpi?: number | null;
    /** Grey level 0-255 separating print from background; null runs Otsu. */
    threshold?: number | null;
    /** Whether the print is lighter than its background; "auto" decides. */
    invert?: boolean | "auto";
    maxPoints?: number;
    seed?: number;
    unitsPerMm?: number;
};

export type EdgeExtractionResult = {
    points: Point[];
    /** Points before the budget was applied. */
    rawPointCount: number;
    /** Extent of the point cloud in output units. */
    width: number;
    height: number;
    /** Null when the image had no DPI, meaning the scale is not physical. */
    unitsPerMm: number | null;
    calibrated: boolean;
    threshold: number;
    inverted: boolean;
    /** Fraction of the image classified as print, useful for sanity checks. */
    foregroundRatio: number;
};

export type GrayImage = {
    data: Uint8ClampedArray;
    width: number;
    height: number;
};

/** Deterministic RNG (mulberry32) so a given image always yields the same sample */
/* eslint-disable no-bitwise */
const createRandom = (seed: number) => {
    let state = seed >>> 0 || 1;
    return () => {
        state += 0x6d2b79f5;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};
/* eslint-enable no-bitwise */

export const toGrayscale = (
    rgba: Uint8ClampedArray,
    width: number,
    height: number
): GrayImage => {
    const data = new Uint8ClampedArray(width * height);
    for (let i = 0; i < data.length; i += 1) {
        const offset = i * 4;
        const alpha = rgba[offset + 3]! / 255;
        const luma =
            0.299 * rgba[offset]! +
            0.587 * rgba[offset + 1]! +
            0.114 * rgba[offset + 2]!;
        // Composite over white so transparent margins read as background.
        data[i] = luma * alpha + 255 * (1 - alpha);
    }
    return { data, width, height };
};

/** One [1 2 1] / 4 pass along a single axis, clamping at the edges. */
const blurAxis = (
    source: Uint8ClampedArray,
    width: number,
    height: number,
    horizontal: boolean
): Uint8ClampedArray => {
    const output = new Uint8ClampedArray(source.length);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const index = y * width + x;
            const previous = horizontal
                ? y * width + Math.max(0, x - 1)
                : Math.max(0, y - 1) * width + x;
            const next = horizontal
                ? y * width + Math.min(width - 1, x + 1)
                : Math.min(height - 1, y + 1) * width + x;
            output[index] =
                (source[previous]! + 2 * source[index]! + source[next]!) / 4;
        }
    }
    return output;
};

/** 3x3 Gaussian, so that sensor noise does not become spurious outline. */
export const blur3x3 = (image: GrayImage): GrayImage => {
    const { data, width, height } = image;
    const horizontal = blurAxis(data, width, height, true);
    return { data: blurAxis(horizontal, width, height, false), width, height };
};

/** Otsu's method: the threshold maximising between-class variance. */
export const otsuThreshold = (image: GrayImage): number => {
    const histogram = new Array<number>(256).fill(0);
    for (let i = 0; i < image.data.length; i += 1) {
        const level = image.data[i]!;
        histogram[level] = histogram[level]! + 1;
    }

    const total = image.data.length;
    let sum = 0;
    for (let level = 0; level < 256; level += 1) {
        sum += level * histogram[level]!;
    }

    let sumBackground = 0;
    let weightBackground = 0;
    let best = 0;
    let bestVariance = -1;

    for (let level = 0; level < 256; level += 1) {
        weightBackground += histogram[level]!;
        const weightForeground = total - weightBackground;
        if (weightForeground === 0) break;

        if (weightBackground > 0) {
            sumBackground += level * histogram[level]!;
            const meanBackground = sumBackground / weightBackground;
            const meanForeground = (sum - sumBackground) / weightForeground;
            const variance =
                weightBackground *
                weightForeground *
                (meanBackground - meanForeground) ** 2;

            if (variance > bestVariance) {
                bestVariance = variance;
                best = level;
            }
        }
    }
    return Math.min(255, best + 1);
};

/**
 * Marks print pixels. `invert` flips which side of the threshold is the print;
 * "auto" assumes the print covers less of the image than its background, which
 * holds for both dark prints on white paper and light prints on a dark surface.
 */
export const binarize = (
    image: GrayImage,
    threshold: number,
    invert: boolean | "auto"
): { mask: Uint8Array; inverted: boolean; foregroundRatio: number } => {
    const { data } = image;
    let below = 0;
    for (let i = 0; i < data.length; i += 1) {
        if (data[i]! < threshold) below += 1;
    }

    const inverted =
        invert === "auto" ? below > data.length - below : Boolean(invert);

    const mask = new Uint8Array(data.length);
    let foreground = 0;
    for (let i = 0; i < data.length; i += 1) {
        const isDark = data[i]! < threshold;
        const isPrint = inverted ? !isDark : isDark;
        if (isPrint) {
            mask[i] = 1;
            foreground += 1;
        }
    }

    return {
        mask,
        inverted,
        foregroundRatio: foreground / data.length,
    };
};

/**
 * Boundary of the binary pattern: a print pixel touching the background.

 * Coordinates use a bottom-left origin (y grows towards the toe), which is what
 * shoeprintr's toe/heel search regions assume.
 */
export const extractOutlinePoints = (
    mask: Uint8Array,
    width: number,
    height: number
): Point[] => {
    const points: Point[] = [];
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            if (mask[y * width + x] === 1) {
                const atEdge =
                    x === 0 ||
                    y === 0 ||
                    x === width - 1 ||
                    y === height - 1 ||
                    mask[y * width + (x - 1)] === 0 ||
                    mask[y * width + (x + 1)] === 0 ||
                    mask[(y - 1) * width + x] === 0 ||
                    mask[(y + 1) * width + x] === 0;

                if (atEdge) {
                    points.push({ x, y: height - 1 - y });
                }
            }
        }
    }
    return points;
};

/** Uniform random thinning, which preserves the relative density of detail. */
export const decimatePoints = (
    points: Point[],
    maxPoints: number,
    seed: number
): Point[] => {
    if (points.length <= maxPoints) return points;
    const random = createRandom(seed);
    const keepProbability = maxPoints / points.length;
    const kept: Point[] = [];
    for (let i = 0; i < points.length; i += 1) {
        if (random() < keepProbability) kept.push(points[i]!);
    }
    return kept;
};

const extentOf = (points: Point[]) => {
    if (points.length === 0) return { width: 0, height: 0 };
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < points.length; i += 1) {
        const point = points[i]!;
        if (point.x < minX) minX = point.x;
        if (point.x > maxX) maxX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.y > maxY) maxY = point.y;
    }
    return { width: maxX - minX, height: maxY - minY };
};

/** Scale factor bringing the image to the canonical working resolution. */
export const resolveScale = (
    width: number,
    height: number,
    dpi: number | null | undefined,
    unitsPerMm: number
): {
    scale: number;
    calibrated: boolean;
    achievedUnitsPerMm: number | null;
} => {
    if (dpi && dpi > 0) {
        const sourceUnitsPerMm = dpi / 25.4;
        const scale = Math.min(1, unitsPerMm / sourceUnitsPerMm);
        return {
            scale,
            calibrated: true,
            achievedUnitsPerMm: sourceUnitsPerMm * scale,
        };
    }
    const longSide = Math.max(width, height);
    return {
        scale: longSide > 0 ? Math.min(1, FALLBACK_LONG_SIDE / longSide) : 1,
        calibrated: false,
        achievedUnitsPerMm: null,
    };
};

const drawScaled = (
    source: ImageBitmap | HTMLCanvasElement,
    width: number,
    height: number
): ImageData => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Failed to create canvas context.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, width, height);
    return context.getImageData(0, 0, width, height);
};

export const extractEdgePoints = (
    source: ImageBitmap | HTMLCanvasElement,
    options: EdgeExtractionOptions = {}
): EdgeExtractionResult => {
    const unitsPerMm = options.unitsPerMm ?? CANONICAL_UNITS_PER_MM;
    const maxPoints = options.maxPoints ?? DEFAULT_MAX_POINTS;
    const seed = options.seed ?? 1;

    const { scale, calibrated, achievedUnitsPerMm } = resolveScale(
        source.width,
        source.height,
        options.dpi,
        unitsPerMm
    );

    const targetWidth = Math.max(1, Math.round(source.width * scale));
    const targetHeight = Math.max(1, Math.round(source.height * scale));

    const imageData = drawScaled(source, targetWidth, targetHeight);
    const gray = blur3x3(
        toGrayscale(imageData.data, targetWidth, targetHeight)
    );

    const threshold = options.threshold ?? otsuThreshold(gray);
    const { mask, inverted, foregroundRatio } = binarize(
        gray,
        threshold,
        options.invert ?? "auto"
    );

    const outline = extractOutlinePoints(mask, targetWidth, targetHeight);
    const points = decimatePoints(outline, maxPoints, seed);
    const extent = extentOf(points);

    return {
        points,
        rawPointCount: outline.length,
        width: extent.width,
        height: extent.height,
        unitsPerMm: calibrated ? achievedUnitsPerMm : null,
        calibrated,
        threshold,
        inverted,
        foregroundRatio,
    };
};

/** CSV in the shape `shoeprint_compare.R` expects. */
export const pointsToCsv = (points: Point[]): string => {
    const rows = new Array<string>(points.length + 1);
    rows[0] = "x,y";
    for (let i = 0; i < points.length; i += 1) {
        const point = points[i]!;
        rows[i + 1] = `${point.x},${point.y}`;
    }
    return `${rows.join("\n")}\n`;
};
