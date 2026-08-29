import {
    binarize,
    decimatePoints,
    extractOutlinePoints,
    otsuThreshold,
    pointsToCsv,
    regionsFitPrint,
    resolveScale,
    toGrayscale,
    CANONICAL_UNITS_PER_MM,
    FALLBACK_LONG_SIDE,
    type GrayImage,
} from "@/lib/shoeprint/edge-extraction";

const makeGray = (values: number[], width: number): GrayImage => ({
    data: Uint8ClampedArray.from(values),
    width,
    height: values.length / width,
});

/** Solid square of `1`s inset in a field of `0`s. */
const makeSquareMask = (size: number, from: number, to: number) => {
    const mask = new Uint8Array(size * size);
    for (let y = from; y <= to; y += 1) {
        for (let x = from; x <= to; x += 1) {
            mask[y * size + x] = 1;
        }
    }
    return mask;
};

describe("toGrayscale", () => {
    it("weights channels by luma", () => {
        const rgba = Uint8ClampedArray.from([255, 0, 0, 255, 0, 255, 0, 255]);
        const gray = toGrayscale(rgba, 2, 1);
        expect(gray.data[0]).toBe(Math.round(0.299 * 255));
        expect(gray.data[1]).toBe(Math.round(0.587 * 255));
    });

    it("composites transparent pixels over white so margins read as background", () => {
        const rgba = Uint8ClampedArray.from([0, 0, 0, 0]);
        const gray = toGrayscale(rgba, 1, 1);
        expect(gray.data[0]).toBe(255);
    });
});

describe("otsuThreshold", () => {
    const bimodal = makeGray(
        [...new Array<number>(50).fill(20), ...new Array<number>(50).fill(200)],
        10
    );

    it("separates two well-defined intensity clusters", () => {
        const threshold = otsuThreshold(bimodal);
        expect(threshold).toBeGreaterThan(20);
        expect(threshold).toBeLessThanOrEqual(200);
    });

    it("produces a threshold binarize can actually split on", () => {
        // Regression guard: Otsu splits at "<= t" but binarize compares "< t",
        // so an unshifted threshold classified the whole dark cluster as
        // background and produced an empty point cloud.
        const { foregroundRatio } = binarize(
            bimodal,
            otsuThreshold(bimodal),
            "auto"
        );
        expect(foregroundRatio).toBeCloseTo(0.5);
    });
});

describe("binarize", () => {
    const darkPrintOnLight = makeGray(
        [...new Array<number>(10).fill(10), ...new Array<number>(90).fill(240)],
        10
    );

    it("treats the dark minority as print by default", () => {
        const { inverted, foregroundRatio } = binarize(
            darkPrintOnLight,
            128,
            "auto"
        );
        expect(inverted).toBe(false);
        expect(foregroundRatio).toBeCloseTo(0.1);
    });

    it("auto-detects a light print on a dark background", () => {
        const lightPrintOnDark = makeGray(
            [
                ...new Array<number>(10).fill(240),
                ...new Array<number>(90).fill(10),
            ],
            10
        );
        const { inverted, foregroundRatio } = binarize(
            lightPrintOnDark,
            128,
            "auto"
        );
        expect(inverted).toBe(true);
        expect(foregroundRatio).toBeCloseTo(0.1);
    });

    it("honours an explicit override", () => {
        const { inverted, foregroundRatio } = binarize(
            darkPrintOnLight,
            128,
            true
        );
        expect(inverted).toBe(true);
        expect(foregroundRatio).toBeCloseTo(0.9);
    });
});

describe("extractOutlinePoints", () => {
    it("keeps the boundary of a filled shape and discards its interior", () => {
        const mask = makeSquareMask(9, 3, 5);
        const points = extractOutlinePoints(mask, 9, 9);
        // A 3x3 block has 8 boundary pixels; only the centre is interior.
        expect(points).toHaveLength(8);
        expect(points).not.toContainEqual({ x: 4, y: 9 - 1 - 4 });
    });

    it("emits a bottom-left origin so y grows towards the toe", () => {
        const mask = new Uint8Array(9);
        mask[0] = 1; // top-left in row-major order
        const points = extractOutlinePoints(mask, 3, 3);
        expect(points).toEqual([{ x: 0, y: 2 }]);
    });

    it("treats pixels on the image border as boundary", () => {
        // Every pixel of a fully filled 3x3 lies on the border except the
        // centre, which is enclosed on all four sides.
        const mask = new Uint8Array(9).fill(1);
        const points = extractOutlinePoints(mask, 3, 3);
        expect(points).toHaveLength(8);
        expect(points).not.toContainEqual({ x: 1, y: 1 });
    });
});

describe("decimatePoints", () => {
    const points = Array.from({ length: 1000 }, (_, i) => ({ x: i, y: i }));

    it("returns the input untouched when it is already within budget", () => {
        const result = decimatePoints(points, 5000, 1);
        expect(result).toBe(points);
    });

    it("thins towards the budget", () => {
        const result = decimatePoints(points, 200, 1);
        expect(result.length).toBeGreaterThan(150);
        expect(result.length).toBeLessThan(260);
    });

    it("is deterministic for a given seed", () => {
        expect(decimatePoints(points, 200, 7)).toEqual(
            decimatePoints(points, 200, 7)
        );
    });
});

describe("resolveScale", () => {
    it("brings a known resolution down to the canonical working scale", () => {
        // 300 dpi is ~11.81 units/mm, so reaching 2.4 units/mm needs ~0.203.
        const { scale, calibrated, achievedUnitsPerMm } = resolveScale(
            1000,
            2000,
            300,
            CANONICAL_UNITS_PER_MM
        );
        expect(calibrated).toBe(true);
        expect(scale).toBeCloseTo(2.4 / (300 / 25.4), 5);
        expect(achievedUnitsPerMm).toBeCloseTo(CANONICAL_UNITS_PER_MM, 5);
    });

    it("never upscales a scan below the canonical resolution", () => {
        const { scale } = resolveScale(500, 500, 30, CANONICAL_UNITS_PER_MM);
        expect(scale).toBe(1);
    });

    it("reports the achieved scale when a scan is too coarse to reach the target", () => {
        // 30 dpi is ~1.18 units/mm, below the 2.4 target, so it stays as-is and
        // ends up on a different scale than a normally-resolved counterpart.
        const { achievedUnitsPerMm } = resolveScale(
            500,
            500,
            30,
            CANONICAL_UNITS_PER_MM
        );
        expect(achievedUnitsPerMm).toBeCloseTo(30 / 25.4, 5);
        expect(achievedUnitsPerMm).not.toBeCloseTo(CANONICAL_UNITS_PER_MM, 2);
    });

    it("falls back to a fixed long side and reports the scale as uncalibrated", () => {
        const { scale, calibrated, achievedUnitsPerMm } = resolveScale(
            2800,
            1400,
            null,
            CANONICAL_UNITS_PER_MM
        );
        expect(calibrated).toBe(false);
        expect(achievedUnitsPerMm).toBeNull();
        expect(scale).toBeCloseTo(FALLBACK_LONG_SIDE / 2800, 5);
    });
});

describe("pointsToCsv", () => {
    it("writes the header the R runner expects", () => {
        const csv = pointsToCsv([
            { x: 1, y: 2 },
            { x: 3, y: 4 },
        ]);
        expect(csv).toBe("x,y\n1,2\n3,4\n");
    });

    it("still emits a usable header for an empty cloud", () => {
        expect(pointsToCsv([])).toBe("x,y\n");
    });
});

describe("regionsFitPrint", () => {
    it("accepts the geometry the published work uses", () => {
        // ~50-unit regions on a print spanning a few hundred units.
        expect(regionsFitPrint(50, 477, 700)).toBe(true);
    });

    it("rejects regions that would span the whole print", () => {
        // A 613x900 web image read as a 500 dpi scan collapses to 75x110
        // working units, where 50-unit regions cover everything and the
        // clique search exhausts memory instead of returning.
        expect(regionsFitPrint(49.92, 75, 110)).toBe(false);
    });

    it("is bounded by the narrow side, not the long one", () => {
        expect(regionsFitPrint(50, 100, 4000)).toBe(false);
    });

    it("allows a region that exactly fills the search quadrant", () => {
        // radius + margin === smallest extent / 2
        expect(regionsFitPrint(35, 100, 200)).toBe(true);
        expect(regionsFitPrint(35.1, 100, 200)).toBe(false);
    });
});
