/**
 * Drives a shoeprint comparison: extracts edge points from both canvases,
 * hands them to the bundled R runtime running CSAFE's shoeprintr, and returns
 * the parsed result.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { mkdir, writeTextFile, readFile } from "@tauri-apps/plugin-fs";
import { appLocalDataDir, join } from "@tauri-apps/api/path";
import * as PIXI from "pixi.js";
import i18n from "@/lib/locales/i18n";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { getCanvas } from "@/components/pixi/canvas/hooks/useCanvas";
import { toBlobBytes } from "@/lib/report/report-utils";
import {
    extractEdgePoints,
    pointsToCsv,
    regionsFitPrint,
    CANONICAL_UNITS_PER_MM,
    MIN_USABLE_POINTS,
    type EdgeExtractionResult,
    type Point,
} from "./edge-extraction";

/** Failure messages surfaced in the dialog, so they follow the UI language. */
type ShoeprintMessageKey =
    | "Shoeprint canvas not ready"
    | "Shoeprint load images first"
    | "Shoeprint image has no path"
    | "Shoeprint not enough edge points"
    | "Shoeprint regions too large for resolution"
    | "Shoeprint regions too large for print";

const tr = (
    key: ShoeprintMessageKey,
    params: Record<string, unknown> = {}
): string => i18n.t(key, { ns: "tooltip", ...params }) as string;

const WORK_DIRECTORY = "shoeprint-comparison";
const PROGRESS_EVENT = "shoeprint-comparison-progress";

/** Rough outsole length, used only to size regions on uncalibrated images. */
const TYPICAL_PRINT_LENGTH_MM = 300;

export type ShoeprintEngineStatus = {
    available: boolean;
    rscriptPath: string | null;
    libraryPath: string | null;
    scriptPath: string | null;
    detail: string;
};

export type ShoeprintRegion = {
    index: number;
    inputCenter: Point;
    inputRadius: number;
    referenceCenter: Point;
    referenceRadius: number;
    cliqueSize: number;
    rotationAngle: number;
    referenceOverlap: number;
    inputOverlap: number;
    medianSquaredDistance: number;
};

export type ShoeprintRegionPair = {
    pair: string;
    inputDistance: number;
    referenceDistance: number;
    absoluteDifference: number;
};

export type ShoeprintSummary = {
    meanCliqueSize: number;
    meanInputOverlap: number;
    meanReferenceOverlap: number;
    meanMedianSquaredDistance: number;
    sdRotationAngle: number;
    meanAbsoluteTriangleDifference: number;
};

export type ShoeprintComparisonResult = {
    schemaVersion: number;
    status: "ok";
    engine: {
        library: string;
        libraryVersion: string;
        rVersion: string;
        cores: number;
    };
    parameters: {
        maxRotationAngle: number;
        circleRadius: number;
        seed: number;
    };
    questioned: { points: number; width: number; height: number };
    known: { points: number; width: number; height: number };
    regions: ShoeprintRegion[];
    regionPairs: ShoeprintRegionPair[];
    summary: ShoeprintSummary;
    durationSeconds: number;
    plot?: string | null;
};

type ShoeprintErrorResult = {
    schemaVersion: number;
    status: "error";
    stage: string;
    message: string;
};

export type ShoeprintComparisonProgress = {
    stage: string;
    percent: number;
    message: string;
};

export type ShoeprintExtractionSettings = {
    dpi: number | null;
    threshold: number | null;
    invert: boolean | "auto";
    maxPoints?: number;
};

export type ShoeprintComparisonSettings = {
    left: ShoeprintExtractionSettings;
    right: ShoeprintExtractionSettings;
    /** Region radius in millimetres; converted to working units for R. */
    regionRadiusMm: number;
    maxRotationAngle: number;
    seed: number;
};

/** Translation key for the scale caveat shown with the results. */
export type ScaleWarningKey =
    | "Shoeprint comparison scale warning"
    | "Shoeprint comparison scale mismatch";

export type ShoeprintComparisonRun = {
    result: ShoeprintComparisonResult;
    /** Rendered comparison figure, as a data URL for display and reporting. */
    plotDataUrl: string | null;
    extraction: {
        left: EdgeExtractionResult;
        right: EdgeExtractionResult;
    };
    /** Translation key, set when the prints share no common physical scale. */
    scaleWarning: ScaleWarningKey | null;
    startedAt: string;
    durationMs: number;
};

export const DEFAULT_COMPARISON_SETTINGS: ShoeprintComparisonSettings = {
    // No resolution by default.
    left: { dpi: null, threshold: null, invert: "auto" },
    right: { dpi: null, threshold: null, invert: "auto" },
    // 50 working units at 2.4 u/mm, the radius shoeprintr's own defaults use.
    regionRadiusMm: 20.8,
    maxRotationAngle: 30,
    seed: 1,
};

/** Takes a couple of seconds: it starts R and loads the analysis packages. */
export const getEngineStatus = async (): Promise<ShoeprintEngineStatus> =>
    invoke<ShoeprintEngineStatus>("shoeprint_engine_status");

export const cancelComparison = async (): Promise<boolean> =>
    invoke<boolean>("cancel_shoeprint_comparison");

export const onComparisonProgress = (
    handler: (progress: ShoeprintComparisonProgress) => void
) =>
    listen<ShoeprintComparisonProgress>(PROGRESS_EVENT, event =>
        handler(event.payload)
    );

const getSpriteBitmap = async (canvasId: CANVAS_ID): Promise<ImageBitmap> => {
    const { viewport } = getCanvas(canvasId, true);
    if (!viewport) throw new Error(tr("Shoeprint canvas not ready"));

    const sprite = viewport.children.find(
        child => child instanceof PIXI.Sprite
    ) as PIXI.Sprite | undefined;
    if (!sprite) throw new Error(tr("Shoeprint load images first"));

    // @ts-expect-error the loader stores the source path on the sprite
    const path = (sprite.path as string | null) ?? null;
    if (!path) throw new Error(tr("Shoeprint image has no path"));

    const bytes = await readFile(path);
    return createImageBitmap(new Blob([toBlobBytes(bytes)]));
};

export const extractForCanvas = async (
    canvasId: CANVAS_ID,
    settings: ShoeprintExtractionSettings,
    seed: number
): Promise<EdgeExtractionResult> => {
    const bitmap = await getSpriteBitmap(canvasId);
    try {
        return extractEdgePoints(bitmap, {
            dpi: settings.dpi,
            threshold: settings.threshold,
            invert: settings.invert,
            maxPoints: settings.maxPoints,
            seed,
        });
    } finally {
        bitmap.close();
    }
};

const ensureWorkDirectory = async () => {
    const directory = await join(await appLocalDataDir(), WORK_DIRECTORY);
    await mkdir(directory, { recursive: true });
    return directory;
};

const toDataUrl = (bytes: Uint8Array, mimeType: string) => {
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(
            ...bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
        );
    }
    return `data:${mimeType};base64,${btoa(binary)}`;
};

/**
 * The triangle-side statistic compares distances measured in each print's own
 * units, so it is only meaningful when both prints share a physical scale.
 */
const describeScaleProblem = (
    left: EdgeExtractionResult,
    right: EdgeExtractionResult
): ScaleWarningKey | null => {
    if (!left.calibrated || !right.calibrated) {
        return "Shoeprint comparison scale warning";
    }
    if (left.unitsPerMm !== right.unitsPerMm) {
        return "Shoeprint comparison scale mismatch";
    }
    return null;
};

const assertEnoughDetail = (
    result: EdgeExtractionResult,
    label: string
): void => {
    if (result.points.length < MIN_USABLE_POINTS) {
        throw new Error(
            tr("Shoeprint not enough edge points", {
                count: result.points.length,
                label,
            })
        );
    }
};

/** An outsole is roughly this long; well outside it the resolution is wrong. */
const IMPLAUSIBLE_PRINT_LENGTH_MM = 150;

/** Refuses geometry the clique search cannot survive (see `regionsFitPrint`). */
const assertRegionsFit = (
    radius: number,
    result: EdgeExtractionResult,
    label: string,
    dpi: number | null
): void => {
    if (regionsFitPrint(radius, result.width, result.height)) return;

    const lengthMm = result.unitsPerMm
        ? result.height / result.unitsPerMm
        : null;
    const resolutionIsWrong =
        dpi !== null &&
        lengthMm !== null &&
        lengthMm < IMPLAUSIBLE_PRINT_LENGTH_MM;

    throw new Error(
        resolutionIsWrong
            ? tr("Shoeprint regions too large for resolution", {
                  label,
                  dpi,
                  length: lengthMm!.toFixed(0),
              })
            : tr("Shoeprint regions too large for print", {
                  label,
                  radius: radius.toFixed(1),
                  width: result.width.toFixed(0),
                  height: result.height.toFixed(0),
              })
    );
};

export const runComparison = async (
    settings: ShoeprintComparisonSettings
): Promise<ShoeprintComparisonRun> => {
    const startedAt = new Date().toISOString();
    const started = performance.now();

    const left = await extractForCanvas(
        CANVAS_ID.LEFT,
        settings.left,
        settings.seed
    );
    assertEnoughDetail(left, "A");
    const right = await extractForCanvas(
        CANVAS_ID.RIGHT,
        settings.right,
        settings.seed
    );
    assertEnoughDetail(right, "B");

    const directory = await ensureWorkDirectory();
    const stamp = Date.now();
    const inputPath = await join(directory, `questioned-${stamp}.csv`);
    const referencePath = await join(directory, `known-${stamp}.csv`);
    const outputPath = await join(directory, `result-${stamp}.json`);
    const plotPath = await join(directory, `figure-${stamp}.png`);

    await writeTextFile(inputPath, pointsToCsv(left.points));
    await writeTextFile(referencePath, pointsToCsv(right.points));

    // The region radius is configured in millimetres, so it needs a units-per-mm
    const unitsPerMm =
        left.unitsPerMm ??
        (left.height > 0
            ? left.height / TYPICAL_PRINT_LENGTH_MM
            : CANONICAL_UNITS_PER_MM);

    const circleRadius = settings.regionRadiusMm * unitsPerMm;
    assertRegionsFit(circleRadius, left, "A", settings.left.dpi);
    assertRegionsFit(circleRadius, right, "B", settings.right.dpi);

    const outcome = await invoke<{
        json: string;
        plotPath: string | null;
        durationMs: number;
    }>("run_shoeprint_comparison", {
        request: {
            inputPath,
            referencePath,
            outputPath,
            plotPath,
            maxRotationAngle: settings.maxRotationAngle,
            circleRadius,
            seed: settings.seed,
        },
    });

    const parsed = JSON.parse(outcome.json) as
        | ShoeprintComparisonResult
        | ShoeprintErrorResult;

    if (parsed.status === "error") {
        throw new Error(parsed.message);
    }

    let plotDataUrl: string | null = null;
    if (outcome.plotPath) {
        try {
            const bytes = await readFile(outcome.plotPath);
            plotDataUrl = toDataUrl(bytes, "image/png");
        } catch {
            plotDataUrl = null;
        }
    }

    return {
        result: parsed,
        plotDataUrl,
        extraction: { left, right },
        scaleWarning: describeScaleProblem(left, right),
        startedAt,
        durationMs: performance.now() - started,
    };
};

export const STRONG_AGREEMENT = { overlap: 0.8, rotationSpread: 5 };
export const MODERATE_AGREEMENT = { overlap: 0.6, rotationSpread: 15 };

export const describeAgreement = (
    summary: ShoeprintSummary
): "strong" | "moderate" | "weak" => {
    const overlap = summary.meanInputOverlap;
    const spread = summary.sdRotationAngle;

    if (
        overlap >= STRONG_AGREEMENT.overlap &&
        spread <= STRONG_AGREEMENT.rotationSpread
    ) {
        return "strong";
    }
    if (
        overlap >= MODERATE_AGREEMENT.overlap &&
        spread <= MODERATE_AGREEMENT.rotationSpread
    ) {
        return "moderate";
    }
    return "weak";
};
