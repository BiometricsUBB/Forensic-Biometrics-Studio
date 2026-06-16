import html2canvas from "html2canvas";
import { PDFDocument } from "pdf-lib";
import { save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import i18n from "@/lib/locales/i18n";
import type { TFunction } from "i18next";
import * as PIXI from "pixi.js";
import SparkMD5 from "spark-md5";
import { drawMarking } from "@/components/pixi/overlays/markings/marking.utils";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { getCanvas } from "@/components/pixi/canvas/hooks/useCanvas";
import { MarkingsStore } from "@/lib/stores/Markings";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { GlobalSettingsStore } from "@/lib/stores/GlobalSettings";
import { WorkingModeStore } from "@/lib/stores/WorkingMode";
import { WORKING_MODE } from "@/views/selectMode";
import { MarkingClass } from "@/lib/markings/MarkingClass";
import { MarkingType } from "@/lib/markings/MarkingType";
import { MARKING_CLASS } from "@/lib/markings/MARKING_CLASS";
import {
    clamp,
    formatReportDateTime,
    formatBytes,
    getMatchedFeatures,
    getPairedByLabel,
} from "./report-utils";

type ReportGenerationOptions = {
    includeMatchedOnly: boolean;
    reportDateTime: string;
    reportLanguage?: string;
    performedBy: string;
    department: string;
    addressLines: string[];
};

export type ImageMeta = {
    name: string;
    width: number;
    height: number;
    sizeBytes: number;
    checksum: string;
    bytes: Uint8Array;
};

type RenderedImages = {
    originalDataUrl: string;
    allMarkingsCanvas: HTMLCanvasElement;
    selectedMarkingsCanvas: HTMLCanvasElement;
};

const PAGE = {
    width: 794,
    height: 1123,
    margin: 95,
};
const LANDSCAPE = {
    width: PAGE.height,
    height: PAGE.width,
    margin: 70,
};

const IMAGE_CELL_SIZE = 200;
const ROWS_PER_PAGE = 4;
const FEATURES_PER_CHUNK = 12;
const FULL_CIRCLE = Math.PI * 2;
const RAY_LINE_LENGTH_MULTIPLIER = 4;
const CANVAS_CONTEXT_ERROR = "Failed to create canvas context.";

const normalizeAngleRad = (value: number) => {
    let angle = value;
    while (angle <= -Math.PI) angle += FULL_CIRCLE;
    while (angle > Math.PI) angle -= FULL_CIRCLE;
    return angle;
};

const getMimeTypeFromName = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".gif")) return "image/gif";
    if (lower.endsWith(".bmp")) return "image/bmp";
    return "application/octet-stream";
};

const toBlobBytes = (bytes: Uint8Array) => new Uint8Array(bytes);

export const toDataUrl = (bytes: Uint8Array, name: string) =>
    new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(
            new Blob([toBlobBytes(bytes)], { type: getMimeTypeFromName(name) })
        );
    });

const md5Bytes = (bytes: Uint8Array) => {
    const buffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
    );
    return SparkMD5.ArrayBuffer.hash(buffer);
};

export const md5String = (value: string) => SparkMD5.hash(value);

const toCssColor = (value: unknown, fallback: string) => {
    if (typeof value === "number" && Number.isFinite(value)) {
        // eslint-disable-next-line no-bitwise
        return `#${(value >>> 0).toString(16).padStart(6, "0").slice(-6)}`;
    }
    if (typeof value === "string" && value.trim().length > 0) {
        return value;
    }
    return fallback;
};

export const getSystemId = async () => {
    try {
        const id = await invoke<string>("get_machine_id");
        return id || "unknown";
    } catch {
        return "unknown";
    }
};

const getSpritePath = async (sprite: PIXI.Sprite) => {
    // @ts-expect-error custom property
    const path = sprite.path as string | null;
    if (!path) return null;
    return path;
};

export const getImageMeta = async (sprite: PIXI.Sprite) => {
    const fullPath = await getSpritePath(sprite);
    if (!fullPath) {
        throw new Error("Missing image path for report generation.");
    }
    const bytes = await readFile(fullPath);
    const bitmap = await createImageBitmap(new Blob([toBlobBytes(bytes)]));
    const checksum = md5Bytes(bytes);

    return {
        name: sprite.name ?? "image",
        width: bitmap.width,
        height: bitmap.height,
        sizeBytes: bytes.byteLength,
        checksum,
        bytes,
    } satisfies ImageMeta;
};

export const renderImageWithMarkings = async (
    imageBytes: Uint8Array,
    markings: MarkingClass[],
    markingTypes: MarkingType[],
    sizeScale: number,
    options?: {
        showMarkingLabels?: boolean;
        markingsAlpha?: number;
    }
) => {
    const bitmap = await createImageBitmap(new Blob([toBlobBytes(imageBytes)]));
    const { width, height } = bitmap;
    const showMarkingLabels = options?.showMarkingLabels ?? true;
    const markingsAlpha = options?.markingsAlpha ?? 1;

    const app = new PIXI.Application({
        width,
        height,
        backgroundAlpha: 0,
        antialias: true,
        preserveDrawingBuffer: true,
    });

    const sprite = new PIXI.Sprite(PIXI.Texture.from(bitmap));
    sprite.position.set(0, 0);
    app.stage.addChild(sprite);

    const g = new PIXI.Graphics();
    g.alpha = markingsAlpha;
    app.stage.addChild(g);

    const scaledTypes = markingTypes.map(type => ({
        ...type,
        size: Math.max(2, type.size * sizeScale),
    }));

    markings.forEach(marking => {
        const type = scaledTypes.find(t => t.id === marking.typeId);
        if (!type) return;
        drawMarking(
            g,
            false,
            marking,
            type,
            1,
            1,
            showMarkingLabels,
            undefined,
            0,
            width / 2,
            height / 2
        );
    });

    const canvas = app.renderer.extract.canvas(app.stage);
    app.destroy(true, { children: true, texture: true, baseTexture: true });
    return canvas as HTMLCanvasElement;
};

const getMarkingDirectionRad = (marking: MarkingClass) => {
    const withAngle = marking as MarkingClass & { angleRad?: unknown };
    if (
        typeof withAngle.angleRad === "number" &&
        Number.isFinite(withAngle.angleRad)
    ) {
        return withAngle.angleRad;
    }

    const withEndpoint = marking as MarkingClass & {
        endpoint?: { x: number; y: number };
    };
    if (
        withEndpoint.endpoint &&
        Number.isFinite(withEndpoint.endpoint.x) &&
        Number.isFinite(withEndpoint.endpoint.y)
    ) {
        const dx = withEndpoint.endpoint.x - marking.origin.x;
        const dy = withEndpoint.endpoint.y - marking.origin.y;
        if (dx === 0 && dy === 0) return null;
        return Math.atan2(dy, dx);
    }

    return null;
};

const getAlignmentRotationRad = (left: MarkingClass, right: MarkingClass) => {
    const leftDirection = getMarkingDirectionRad(left);
    const rightDirection = getMarkingDirectionRad(right);
    if (leftDirection === null || rightDirection === null) {
        return 0;
    }

    return normalizeAngleRad(leftDirection - rightDirection);
};

const getFeatureCropCenter = (
    marking: MarkingClass,
    markingType: MarkingType | undefined,
    sizeScale: number
) => {
    const withEndpoint = marking as MarkingClass & {
        endpoint?: { x: number; y: number };
    };

    if (
        withEndpoint.endpoint &&
        Number.isFinite(withEndpoint.endpoint.x) &&
        Number.isFinite(withEndpoint.endpoint.y)
    ) {
        return {
            x: (marking.origin.x + withEndpoint.endpoint.x) / 2,
            y: (marking.origin.y + withEndpoint.endpoint.y) / 2,
        };
    }

    if (marking.markingClass === MARKING_CLASS.RAY) {
        const direction = getMarkingDirectionRad(marking);
        if (direction !== null) {
            const scaledSize = Math.max(
                2,
                (markingType?.size ?? 10) * sizeScale
            );
            const rayLength = RAY_LINE_LENGTH_MULTIPLIER * scaledSize;
            return {
                x: marking.origin.x + (-Math.sin(direction) * rayLength) / 2,
                y: marking.origin.y + (Math.cos(direction) * rayLength) / 2,
            };
        }
    }

    return {
        x: marking.origin.x,
        y: marking.origin.y,
    };
};

const getExpandedCropSizeForRotation = (
    targetSize: number,
    rotateRad: number
) => {
    const absSin = Math.abs(Math.sin(rotateRad));
    const absCos = Math.abs(Math.cos(rotateRad));
    return Math.ceil(targetSize * (absSin + absCos));
};

const cropCanvas = (
    source: HTMLCanvasElement,
    centerX: number,
    centerY: number,
    size: number
) => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(CANVAS_CONTEXT_ERROR);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    const half = size / 2;
    const sx = Math.round(centerX - half);
    const sy = Math.round(centerY - half);

    const srcX = clamp(sx, 0, source.width);
    const srcY = clamp(sy, 0, source.height);
    const dstX = Math.max(0, -sx);
    const dstY = Math.max(0, -sy);
    const srcWidth = Math.max(0, Math.min(source.width - srcX, size - dstX));
    const srcHeight = Math.max(0, Math.min(source.height - srcY, size - dstY));

    if (srcWidth > 0 && srcHeight > 0) {
        ctx.drawImage(
            source,
            srcX,
            srcY,
            srcWidth,
            srcHeight,
            dstX,
            dstY,
            srcWidth,
            srcHeight
        );
    }

    return canvas;
};

const rotateCanvas = (
    source: HTMLCanvasElement,
    rotateRad: number,
    targetSize: number
) => {
    const safeSize = source.width;
    const rotated = document.createElement("canvas");
    rotated.width = safeSize;
    rotated.height = safeSize;
    const rotatedCtx = rotated.getContext("2d");
    if (!rotatedCtx) throw new Error(CANVAS_CONTEXT_ERROR);
    rotatedCtx.translate(safeSize / 2, safeSize / 2);
    rotatedCtx.rotate(rotateRad);
    rotatedCtx.drawImage(source, -safeSize / 2, -safeSize / 2);
    rotatedCtx.setTransform(1, 0, 0, 1, 0, 0);

    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = targetSize;
    finalCanvas.height = targetSize;
    const finalCtx = finalCanvas.getContext("2d");
    if (!finalCtx) throw new Error(CANVAS_CONTEXT_ERROR);
    const cutOffset = Math.max(0, (safeSize - targetSize) / 2);
    finalCtx.drawImage(
        rotated,
        cutOffset,
        cutOffset,
        targetSize,
        targetSize,
        0,
        0,
        targetSize,
        targetSize
    );

    return finalCanvas;
};

type Side = "top" | "bottom" | "left" | "right";

interface Placement {
    feature: MarkingClass;
    x: number;
    y: number;
    side: Side;
}

interface Bounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

const getFeatureBounds = (
    features: MarkingClass[],
    width: number,
    height: number
): Bounds =>
    features.reduce(
        (acc, f) => ({
            minX: Math.min(acc.minX, f.origin.x),
            maxX: Math.max(acc.maxX, f.origin.x),
            minY: Math.min(acc.minY, f.origin.y),
            maxY: Math.max(acc.maxY, f.origin.y),
        }),
        { minX: width, maxX: 0, minY: height, maxY: 0 }
    );

const determineInitialSide = (angle: number, diagAngle: number): Side => {
    const bias = 0.2;
    if (angle >= -diagAngle + bias && angle < diagAngle - bias) {
        return "right";
    }
    if (angle >= diagAngle - bias && angle < Math.PI - diagAngle + bias) {
        return "bottom";
    }
    if (angle >= -Math.PI + diagAngle - bias && angle < -diagAngle + bias) {
        return "top";
    }
    return "left";
};

const getInitialPlacement = (
    feature: MarkingClass,
    fBounds: Bounds,
    cropX: number,
    cropY: number,
    margin: number,
    imgLeft: number,
    imgTop: number,
    imgRight: number,
    imgBottom: number,
    cropWidth: number,
    cropHeight: number,
    edgeOffset: number
): Placement => {
    const fx = feature.origin.x - cropX + margin;
    const fy = feature.origin.y - cropY + margin;

    const dataCx = margin + (fBounds.minX - cropX + (fBounds.maxX - cropX)) / 2;
    const dataCy = margin + (fBounds.minY - cropY + (fBounds.maxY - cropY)) / 2;

    const centerX = ((imgLeft + imgRight) / 2) * 0.4 + dataCx * 0.6;
    const centerY = ((imgTop + imgBottom) / 2) * 0.4 + dataCy * 0.6;

    const dx = fx - centerX;
    const dy = fy - centerY;
    const angle = Math.atan2(dy, dx);

    const distLeft = fx - imgLeft;
    const distRight = imgRight - fx;
    const distTop = fy - imgTop;
    const distBottom = imgBottom - fy;

    const diagAngle = Math.atan2(cropHeight, cropWidth);
    let side = determineInitialSide(angle, diagAngle);

    const minDist = Math.min(distTop, distBottom, distLeft, distRight);
    const threshold = Math.min(cropWidth, cropHeight) * 0.1;
    if (minDist < threshold) {
        if (minDist === distTop) side = "top";
        else if (minDist === distBottom) side = "bottom";
        else if (minDist === distLeft) side = "left";
        else if (minDist === distRight) side = "right";
    }

    if (side === "top") return { feature, x: fx, y: imgTop - edgeOffset, side };
    if (side === "bottom")
        return { feature, x: fx, y: imgBottom + edgeOffset, side };
    if (side === "left")
        return { feature, x: imgLeft - edgeOffset, y: fy, side };
    return { feature, x: imgRight + edgeOffset, y: fy, side };
};

const applyClustering = (
    placements: Placement[],
    cropWidth: number,
    cropHeight: number,
    cropX: number,
    cropY: number,
    margin: number,
    imgTop: number,
    imgBottom: number,
    imgLeft: number,
    imgRight: number,
    edgeOffset: number
) => {
    const clusterThreshold = Math.min(cropWidth, cropHeight) * 0.05;
    const visited = new Set<MarkingClass>();

    placements.forEach(p => {
        if (visited.has(p.feature)) return;
        const cluster = [p];
        visited.add(p.feature);
        placements.forEach(other => {
            if (visited.has(other.feature)) return;
            const d = Math.hypot(
                p.feature.origin.x - other.feature.origin.x,
                p.feature.origin.y - other.feature.origin.y
            );
            if (d < clusterThreshold) {
                cluster.push(other);
                visited.add(other.feature);
            }
        });

        if (cluster.length > 1) {
            const sideCounts: Record<Side, number> = {
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
            };
            cluster.forEach(item => {
                const cp = item;
                sideCounts[cp.side] += 1;
            });
            let bestSide: Side = cluster[0]?.side || "top";
            let maxCount = 0;
            (Object.entries(sideCounts) as [Side, number][]).forEach(
                ([s, count]) => {
                    if (count > maxCount) {
                        maxCount = count;
                        bestSide = s;
                    }
                }
            );

            cluster.forEach(item => {
                const cp = item;
                if (cp.side !== bestSide) {
                    cp.side = bestSide;
                    const fx = cp.feature.origin.x - cropX + margin;
                    const fy = cp.feature.origin.y - cropY + margin;
                    if (bestSide === "top") {
                        cp.x = fx;
                        cp.y = imgTop - edgeOffset;
                    } else if (bestSide === "bottom") {
                        cp.x = fx;
                        cp.y = imgBottom + edgeOffset;
                    } else if (bestSide === "left") {
                        cp.x = imgLeft - edgeOffset;
                        cp.y = fy;
                    } else {
                        cp.x = imgRight + edgeOffset;
                        cp.y = fy;
                    }
                }
            });
        }
    });
};

const updatePlacementAfterSideChange = (
    p: Placement,
    targetSide: Side,
    fy: number,
    fx: number,
    imgTop: number,
    imgBottom: number,
    imgLeft: number,
    imgRight: number,
    edgeOffset: number
) => {
    const cp = p;
    cp.side = targetSide;
    if (targetSide === "left") {
        cp.x = imgLeft - edgeOffset;
        cp.y = fy;
    } else if (targetSide === "right") {
        cp.x = imgRight + edgeOffset;
        cp.y = fy;
    } else if (targetSide === "top") {
        cp.y = imgTop - edgeOffset;
        cp.x = fx;
    } else {
        cp.y = imgBottom + edgeOffset;
        cp.x = fx;
    }
};

const tryMovePlacementToBetterSide = (
    p: Placement,
    placements: Placement[],
    cropX: number,
    cropY: number,
    margin: number,
    imgTop: number,
    imgBottom: number,
    imgLeft: number,
    imgRight: number,
    edgeOffset: number
): boolean => {
    const fx = p.feature.origin.x - cropX + margin;
    const fy = p.feature.origin.y - cropY + margin;
    let targetSide: Side = p.side;

    if (p.side === "top" || p.side === "bottom") {
        targetSide = fx - imgLeft < imgRight - fx ? "left" : "right";
    } else {
        targetSide = fy - imgTop < imgBottom - fy ? "top" : "bottom";
    }

    const currentSideCount = placements.filter(p2 => p2.side === p.side).length;
    const targetCount = placements.filter(p2 => p2.side === targetSide).length;

    if (targetCount < currentSideCount - 1) {
        updatePlacementAfterSideChange(
            p,
            targetSide,
            fy,
            fx,
            imgTop,
            imgBottom,
            imgLeft,
            imgRight,
            edgeOffset
        );
        return true;
    }
    return false;
};

const balanceSides = (
    placements: Placement[],
    cropX: number,
    cropY: number,
    margin: number,
    imgTop: number,
    imgBottom: number,
    imgLeft: number,
    imgRight: number,
    edgeOffset: number
) => {
    const sides: Side[] = ["top", "bottom", "left", "right"];
    for (let pass = 0; pass < 3; pass += 1) {
        const totalPoints = placements.length;
        const idealPointsPerSide = totalPoints / 4;
        const slack = 1.5 - pass * 0.2;
        const maxPointsPerSide = Math.max(
            3,
            Math.ceil(idealPointsPerSide * slack)
        );

        sides.forEach(side => {
            const sidePlacements = placements.filter(p => p.side === side);
            if (sidePlacements.length <= maxPointsPerSide) return;

            sidePlacements.sort((a, b) => {
                if (side === "top" || side === "bottom") {
                    return a.feature.origin.x - b.feature.origin.x;
                }
                return a.feature.origin.y - b.feature.origin.y;
            });

            const moveCount = Math.min(
                sidePlacements.length - maxPointsPerSide,
                Math.ceil(sidePlacements.length / 3)
            );

            for (let i = 0; i < moveCount; i += 1) {
                const p =
                    i % 2 === 0
                        ? sidePlacements[0]
                        : sidePlacements[sidePlacements.length - 1];
                if (p) {
                    const moved = tryMovePlacementToBetterSide(
                        p,
                        placements,
                        cropX,
                        cropY,
                        margin,
                        imgTop,
                        imgBottom,
                        imgLeft,
                        imgRight,
                        edgeOffset
                    );
                    if (moved) {
                        sidePlacements.splice(sidePlacements.indexOf(p), 1);
                    }
                }
            }
        });
    }
};

const expandPlacements = (
    sidePlacements: Placement[],
    side: Side,
    availableSize: number,
    expansionFactorLimit: number
) => {
    if (sidePlacements.length === 0) return;

    let firstPos = 0;
    let lastPos = 0;

    const firstItem = sidePlacements[0];
    const lastItem = sidePlacements[sidePlacements.length - 1];

    if (!firstItem || !lastItem) return;

    if (side === "top" || side === "bottom") {
        firstPos = firstItem.x;
        lastPos = lastItem.x;
    } else {
        firstPos = firstItem.y;
        lastPos = lastItem.y;
    }

    const totalDim = lastPos - firstPos;
    if (totalDim < availableSize) {
        const expansionFactor = Math.min(
            expansionFactorLimit,
            availableSize / totalDim
        );
        const center = (firstPos + lastPos) / 2;
        sidePlacements.forEach(p => {
            const cp = p;
            if (side === "top" || side === "bottom") {
                cp.x = center + (cp.x - center) * expansionFactor;
            } else {
                cp.y = center + (cp.y - center) * expansionFactor;
            }
        });
    }
};

const centerAndClampPlacements = (
    sidePlacements: Placement[],
    side: Side,
    cropX: number,
    cropY: number,
    margin: number,
    numberCircleRadius: number,
    canvasWidth: number,
    canvasHeight: number
) => {
    if (sidePlacements.length === 0) return;

    let firstPos = 0;
    let lastPos = 0;

    const firstItem = sidePlacements[0];
    const lastItem = sidePlacements[sidePlacements.length - 1];

    if (!firstItem || !lastItem) return;

    if (side === "top" || side === "bottom") {
        firstPos = firstItem.x;
        lastPos = lastItem.x;
    } else {
        firstPos = firstItem.y;
        lastPos = lastItem.y;
    }

    const currentCenter = (firstPos + lastPos) / 2;
    const idealCenter =
        sidePlacements.reduce((sum, p) => {
            if (side === "top" || side === "bottom") {
                return sum + (p.feature.origin.x - cropX + margin);
            }
            return sum + (p.feature.origin.y - cropY + margin);
        }, 0) / sidePlacements.length;

    const offset = idealCenter - currentCenter;
    sidePlacements.forEach(p => {
        const cp = p;
        if (side === "top" || side === "bottom") {
            cp.x = clamp(
                cp.x + offset,
                numberCircleRadius + 2,
                canvasWidth - numberCircleRadius - 2
            );
        } else {
            cp.y = clamp(
                cp.y + offset,
                numberCircleRadius + 2,
                canvasHeight - numberCircleRadius - 2
            );
        }
    });
};

const resolveInitialGaps = (
    sidePlacements: Placement[],
    side: Side,
    minGap: number
) => {
    sidePlacements.forEach((p, i) => {
        if (i === 0) return;
        const prev = sidePlacements[i - 1];
        const curr = p;
        if (prev && curr) {
            if (side === "top" || side === "bottom") {
                if (curr.x - prev.x < minGap) {
                    curr.x = prev.x + minGap;
                }
            } else if (curr.y - prev.y < minGap) {
                curr.y = prev.y + minGap;
            }
        }
    });
};

const enforceMinimumGaps = (
    sidePlacements: Placement[],
    side: Side,
    minGap: number
) => {
    sidePlacements.forEach((p, i) => {
        if (i === 0) return;
        const p1 = sidePlacements[i - 1];
        const p2 = p;
        if (p1 && p2) {
            if (side === "top" || side === "bottom") {
                if (p2.x < p1.x + minGap * 0.5) {
                    p2.x = p1.x + minGap * 0.5;
                }
            } else if (p2.y < p1.y + minGap * 0.5) {
                p2.y = p1.y + minGap * 0.5;
            }
        }
    });
};

const resolveOverlaps = (
    placements: Placement[],
    side: Side,
    numberCircleRadius: number,
    cropWidth: number,
    cropHeight: number,
    cropX: number,
    cropY: number,
    margin: number,
    canvasWidth: number,
    canvasHeight: number
) => {
    const sidePlacements = placements
        .filter(p => p.side === side)
        .sort((a, b) => {
            if (side === "top" || side === "bottom") {
                return a.feature.origin.x - b.feature.origin.x;
            }
            return a.feature.origin.y - b.feature.origin.y;
        });

    if (sidePlacements.length === 0) return;

    const minGap = numberCircleRadius * 3.0;

    resolveInitialGaps(sidePlacements, side, minGap);

    if (side === "top" || side === "bottom") {
        expandPlacements(sidePlacements, side, cropWidth * 0.95, 1.5);
    } else {
        expandPlacements(sidePlacements, side, cropHeight * 0.95, 1.5);
    }

    centerAndClampPlacements(
        sidePlacements,
        side,
        cropX,
        cropY,
        margin,
        numberCircleRadius,
        canvasWidth,
        canvasHeight
    );

    sidePlacements.sort((a, b) => {
        if (side === "top" || side === "bottom") {
            return a.feature.origin.x - b.feature.origin.x;
        }
        return a.feature.origin.y - b.feature.origin.y;
    });

    enforceMinimumGaps(sidePlacements, side, minGap);
};

const createOverviewCalloutImage = async (
    imageBytes: Uint8Array,
    features: MarkingClass[]
) => {
    const bitmap = await createImageBitmap(new Blob([toBlobBytes(imageBytes)]));
    const { width, height } = bitmap;
    const featureBounds = getFeatureBounds(features, width, height);

    const padding = Math.min(width, height) * 0.15;
    const cropX = Math.max(0, featureBounds.minX - padding);
    const cropY = Math.max(0, featureBounds.minY - padding);
    const cropWidth = Math.min(width, featureBounds.maxX + padding) - cropX;
    const cropHeight = Math.min(height, featureBounds.maxY + padding) - cropY;

    const numberCircleRadius = Math.max(
        16,
        Math.round(Math.min(cropWidth, cropHeight) * 0.025)
    );
    const margin = Math.max(
        84,
        Math.round(Math.min(cropWidth, cropHeight) * 0.22)
    );

    const canvas = document.createElement("canvas");
    canvas.width = cropWidth + margin * 2;
    canvas.height = cropHeight + margin * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(CANVAS_CONTEXT_ERROR);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
        bitmap,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        margin,
        margin,
        cropWidth,
        cropHeight
    );
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(margin, margin, cropWidth, cropHeight);

    if (features.length === 0) return canvas.toDataURL("image/png");

    const fontSize = Math.max(14, Math.round(numberCircleRadius * 1.1));
    ctx.lineWidth = 2.2;
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const imgLeft = margin;
    const imgTop = margin;
    const imgRight = margin + cropWidth;
    const imgBottom = margin + cropHeight;
    const edgeOffset = numberCircleRadius + 8;

    const placements: Placement[] = features.map(f =>
        getInitialPlacement(
            f,
            featureBounds,
            cropX,
            cropY,
            margin,
            imgLeft,
            imgTop,
            imgRight,
            imgBottom,
            cropWidth,
            cropHeight,
            edgeOffset
        )
    );

    applyClustering(
        placements,
        cropWidth,
        cropHeight,
        cropX,
        cropY,
        margin,
        imgTop,
        imgBottom,
        imgLeft,
        imgRight,
        edgeOffset
    );

    balanceSides(
        placements,
        cropX,
        cropY,
        margin,
        imgTop,
        imgBottom,
        imgLeft,
        imgRight,
        edgeOffset
    );

    (["top", "bottom", "left", "right"] as Side[]).forEach(side =>
        resolveOverlaps(
            placements,
            side,
            numberCircleRadius,
            cropWidth,
            cropHeight,
            cropX,
            cropY,
            margin,
            canvas.width,
            canvas.height
        )
    );

    const slotForFeature = new Map<MarkingClass, { x: number; y: number }>();
    placements.forEach(p => {
        slotForFeature.set(p.feature, {
            x: clamp(
                p.x,
                numberCircleRadius + 2,
                canvas.width - numberCircleRadius - 2
            ),
            y: clamp(
                p.y,
                numberCircleRadius + 2,
                canvas.height - numberCircleRadius - 2
            ),
        });
    });

    features.forEach(feature => {
        const slot = slotForFeature.get(feature);
        if (!slot) return;
        const fx = feature.origin.x - cropX + margin;
        const fy = feature.origin.y - cropY + margin;
        const dx = slot.x - fx;
        const dy = slot.y - fy;
        const length = Math.max(1, Math.hypot(dx, dy));
        const lineEndX = slot.x - (dx / length) * numberCircleRadius;
        const lineEndY = slot.y - (dy / length) * numberCircleRadius;
        ctx.strokeStyle = "#cc0000";
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(lineEndX, lineEndY);
        ctx.stroke();
    });

    features.forEach(feature => {
        const slot = slotForFeature.get(feature);
        if (!slot) return;
        ctx.beginPath();
        ctx.fillStyle = "#ffffff";
        ctx.arc(slot.x, slot.y, numberCircleRadius, 0, FULL_CIRCLE);
        ctx.fill();
        ctx.strokeStyle = "#cc0000";
        ctx.stroke();
        ctx.fillStyle = "#cc0000";
        ctx.fillText(String(feature.label), slot.x, slot.y + 0.5);
    });

    return canvas.toDataURL("image/png");
};

const ensureImagesLoaded = async (container: HTMLElement) => {
    const images = Array.from(container.querySelectorAll("img"));
    await Promise.all(
        images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise<void>(resolve => {
                img.addEventListener("load", () => resolve(), { once: true });
                img.addEventListener("error", () => resolve(), { once: true });
            });
        })
    );
};

export const createPage = () => {
    const page = document.createElement("div");
    page.className = "report-page";
    return page;
};

const createLandscapePage = () => {
    const page = document.createElement("div");
    page.className = "report-page landscape";
    return page;
};

export const createReportRoot = () => {
    const root = document.createElement("div");
    root.className = "report-root";
    return root;
};

export const createStyles = () => {
    const style = document.createElement("style");
    style.textContent = `
        .report-root { position: fixed; left: -10000px; top: 0; width: ${PAGE.width}px; }
        .report-page { width: ${PAGE.width}px; height: ${PAGE.height}px; background: #fff; color: #111; font-family: "Arial", sans-serif; padding: ${PAGE.margin}px; box-sizing: border-box; display: flex; flex-direction: column; gap: 10px; }
        .report-page.landscape { width: ${LANDSCAPE.width}px; height: ${LANDSCAPE.height}px; padding: ${LANDSCAPE.margin}px; }
        .report-title { font-size: 18px; font-weight: 700; text-align: center; margin-bottom: 6px; }
        .section-title { font-size: 12px; font-weight: 700; margin-top: 4px; }
        .meta-grid { display: grid; grid-template-columns: 1fr; gap: 6px; font-size: 11px; }
        .meta-block { display: grid; gap: 2px; }
        .software-grid, .input-grid { display: grid; gap: 4px; font-size: 11px; }
        .counts { display: grid; gap: 2px; font-size: 11px; }
        .fig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px; }
        .fig { display: grid; gap: 4px; font-size: 10px; text-align: center; }
        .fig img { width: 100%; height: auto; border: 1px solid #ddd; }
        .overview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .overview-grid.landscape { grid-template-columns: 1fr 1fr; align-items: center; }
        .overview-grid img { width: 100%; height: auto; border: 1px solid #ddd; }
        .zoom img { width: 100%; height: auto; border: 1px solid #ddd; }
        .note { font-size: 11px; border-top: 1px solid #ddd; padding-top: 6px; }
        .table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .table th, .table td { border: 1px solid #ccc; padding: 4px; vertical-align: middle; }
        .feature-cell { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
        .feature-index {
            width: 22px;
            height: 22px;
            border-radius: 999px;
            background: #ffffff;
            color: var(--marker-text, #7a0000);
            border: 2px solid var(--marker-ring, #cc0000);
            box-shadow: 0 0 0 1px var(--marker-outline, #7a0000);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            line-height: 1;
            font-weight: 700;
            font-family: Arial, sans-serif;
            transform: translateY(2px);
        }
        .feature-index-value {
            display: inline-block;
            line-height: 1;
            transform: translateY(-7px);
        }
        .feature-type { font-size: 9px; }
        .feature-image { width: ${IMAGE_CELL_SIZE}px; height: ${IMAGE_CELL_SIZE}px; object-fit: cover; border: 1px solid #ddd; }
        .footer { margin-top: auto; font-size: 10px; display: flex; justify-content: space-between; }
    `;
    return style;
};

export type ReportT = TFunction<"report">;

const resolveFeatureTypeName = (
    featureTypeDefinition: MarkingType | undefined,
    tReport: ReportT
) => {
    if (!featureTypeDefinition) return "-";

    const baseName =
        featureTypeDefinition.displayName?.trim() ||
        featureTypeDefinition.name?.trim() ||
        "-";

    return tReport(baseName as never, { defaultValue: baseName });
};

export const createFooter = (
    pageNumber: number,
    reportId: string,
    tReport: ReportT
) => `
    <div class="footer">
        <div>${tReport("Page")} ${pageNumber}</div>
        <div>${tReport("Report ID label")} ${reportId}</div>
    </div>
`;

export const createFigurePage = (
    title: string,
    image: string,
    imageLabel: string,
    pageNumber: number,
    reportId: string,
    tReport: ReportT
) => {
    const page = createPage();
    page.innerHTML = `
        <div class="meta-block">${imageLabel}</div>
        <div class="fig">
            <img src="${image}" alt="${imageLabel}" />
        </div>
        <div class="section-title">${title}</div>
        ${createFooter(pageNumber, reportId, tReport)}
    `;
    return page;
};

const decodeUnicodeEscapes = (value: string) =>
    value.replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) =>
        String.fromCharCode(parseInt(hex, 16))
    );

export type ReportMetadataOptions = {
    reportDateTime?: string;
    performedBy?: string;
    department?: string;
    addressLines?: string[];
};

export type ReportIdentity = {
    reportId: string;
    reportDateTime: string;
    performedBy: string;
    department: string;
    address: string[];
    appVersion: string;
};

/** Builds the shared report metadata (id, date, author, department, address). */
export const buildReportIdentity = async (
    options: ReportMetadataOptions,
    leftMeta: ImageMeta,
    rightMeta: ImageMeta
): Promise<ReportIdentity> => {
    const reportSettings = GlobalSettingsStore.state.settings.report;
    const reportDateTime =
        options.reportDateTime?.trim() || formatReportDateTime(new Date());
    const systemId = await getSystemId();
    const reportId = md5String(
        [
            reportDateTime,
            leftMeta.sizeBytes,
            leftMeta.checksum,
            rightMeta.sizeBytes,
            rightMeta.checksum,
            systemId,
        ].join("|")
    );

    const performedBy = decodeUnicodeEscapes(
        options.performedBy?.trim() || reportSettings?.performedBy || "-"
    );
    const department = decodeUnicodeEscapes(
        options.department?.trim() || reportSettings?.department || "-"
    );
    const addressFallback = [
        reportSettings?.addressLine1,
        reportSettings?.addressLine2,
        reportSettings?.addressLine3,
        reportSettings?.addressLine4,
    ]
        .map(line => line?.trim())
        .filter(Boolean) as string[];
    const addressLines =
        options.addressLines?.map(line => line.trim()).filter(Boolean) ?? [];
    const address = (
        addressLines.length > 0 ? addressLines : addressFallback
    ).map(line => decodeUnicodeEscapes(line));

    const appVersion = await getVersion();

    return {
        reportId,
        reportDateTime,
        performedBy,
        department,
        address,
        appVersion,
    };
};

/** Appends pages to the DOM, rasterizes them and saves the result as a PDF. */
export const renderPagesToPdf = async (
    root: HTMLElement,
    pages: HTMLElement[],
    saveTitle: string,
    defaultFileName: string
) => {
    pages.forEach(page => root.appendChild(page));
    document.body.appendChild(root);
    try {
        await ensureImagesLoaded(root);
        const pdf = await PDFDocument.create();
        const renderedPages = await Promise.all(
            pages.map(page =>
                html2canvas(page, { scale: 2, backgroundColor: "#ffffff" })
            )
        );

        await renderedPages.reduce(
            async (chainPromise, canvas) => {
                const chain = await chainPromise;
                const pngBytes = canvas.toDataURL("image/png");
                const image = await pdf.embedPng(pngBytes);
                const page = pdf.addPage([canvas.width, canvas.height]);
                page.drawImage(image, {
                    x: 0,
                    y: 0,
                    width: canvas.width,
                    height: canvas.height,
                });
                chain.push(page);
                return chain;
            },
            Promise.resolve([] as ReturnType<typeof pdf.addPage>[])
        );

        const pdfBytes = await pdf.save();

        const filePath = await save({
            title: saveTitle,
            filters: [{ name: "PDF", extensions: ["pdf"] }],
            canCreateDirectories: true,
            defaultPath: defaultFileName,
        });

        if (!filePath) return;

        await writeFile(filePath, pdfBytes);
    } finally {
        root.remove();
    }
};

/* eslint-disable sonarjs/cognitive-complexity */
export const generateReportPdfWithDialog = async (
    options: ReportGenerationOptions
) => {
    let stage = "init";
    const previousLanguage = i18n.language;
    let languageChanged = false;
    try {
        stage = "check-working-mode";
        const { workingMode } = WorkingModeStore.state;
        if (workingMode !== WORKING_MODE.FINGERPRINT) {
            throw new Error(
                "Report generation is available only for fingerprints."
            );
        }

        stage = "get-viewports";
        const reportLanguage =
            options.reportLanguage ||
            GlobalSettingsStore.state.settings.language ||
            i18n.language ||
            "pl";
        if (reportLanguage !== previousLanguage) {
            await i18n.changeLanguage(reportLanguage);
            languageChanged = true;
        }
        await i18n.loadNamespaces(["report", "keywords"]);
        const tReport = i18n.getFixedT(reportLanguage, "report");
        const tKeywords = i18n.getFixedT(reportLanguage, "keywords");
        const leftCanvas = getCanvas(CANVAS_ID.LEFT, true);
        const rightCanvas = getCanvas(CANVAS_ID.RIGHT, true);
        const leftViewport = leftCanvas.viewport;
        const rightViewport = rightCanvas.viewport;

        if (!leftViewport || !rightViewport) {
            throw new Error("Viewports are not ready.");
        }

        stage = "get-sprites";
        const leftSprite = leftViewport.children.find(
            x => x instanceof PIXI.Sprite
        ) as PIXI.Sprite | undefined;
        const rightSprite = rightViewport.children.find(
            x => x instanceof PIXI.Sprite
        ) as PIXI.Sprite | undefined;

        if (!leftSprite || !rightSprite) {
            throw new Error("Load both images before generating the report.");
        }

        stage = "collect-markings";
        const markingsLeft = MarkingsStore(CANVAS_ID.LEFT).state.markings;
        const markingsRight = MarkingsStore(CANVAS_ID.RIGHT).state.markings;
        const markingTypes = MarkingTypesStore.state.types;

        const matched = options.includeMatchedOnly
            ? getMatchedFeatures(markingsLeft, markingsRight)
            : getPairedByLabel(markingsLeft, markingsRight);

        stage = "read-image-meta";
        const leftMeta = await getImageMeta(leftSprite);
        const rightMeta = await getImageMeta(rightSprite);
        const selectedFeatures = matched;

        stage = "image-data-urls";
        const leftOriginal = await toDataUrl(leftMeta.bytes, leftMeta.name);
        const rightOriginal = await toDataUrl(rightMeta.bytes, rightMeta.name);

        stage = "render-overlays";
        const [
            leftAllCanvas,
            rightAllCanvas,
            leftSelectedCanvas,
            rightSelectedCanvas,
        ] = await Promise.all([
            renderImageWithMarkings(
                leftMeta.bytes,
                markingsLeft,
                markingTypes,
                1.6
            ),
            renderImageWithMarkings(
                rightMeta.bytes,
                markingsRight,
                markingTypes,
                1.6
            ),
            renderImageWithMarkings(
                leftMeta.bytes,
                selectedFeatures.map(x => x.left),
                markingTypes,
                1.6
            ),
            renderImageWithMarkings(
                rightMeta.bytes,
                selectedFeatures.map(x => x.right),
                markingTypes,
                1.6
            ),
        ]);
        const detailCrops = await Promise.all(
            selectedFeatures.map(async feature => {
                const [leftSingleCanvas, rightSingleCanvas] = await Promise.all(
                    [
                        renderImageWithMarkings(
                            leftMeta.bytes,
                            [feature.left],
                            markingTypes,
                            1.6,
                            { showMarkingLabels: false, markingsAlpha: 0.45 }
                        ),
                        renderImageWithMarkings(
                            rightMeta.bytes,
                            [feature.right],
                            markingTypes,
                            1.6,
                            { showMarkingLabels: false, markingsAlpha: 0.45 }
                        ),
                    ]
                );

                const rightRotationRad = getAlignmentRotationRad(
                    feature.left,
                    feature.right
                );
                const leftTypeDefinition = markingTypes.find(
                    type => type.id === feature.left.typeId
                );
                const rightTypeDefinition = markingTypes.find(
                    type => type.id === feature.right.typeId
                );
                const leftCenter = getFeatureCropCenter(
                    feature.left,
                    leftTypeDefinition,
                    1.6
                );
                const rightCenter = getFeatureCropCenter(
                    feature.right,
                    rightTypeDefinition,
                    1.6
                );

                const leftTargetSize = Math.max(
                    1,
                    Math.min(
                        IMAGE_CELL_SIZE,
                        leftSingleCanvas.width,
                        leftSingleCanvas.height
                    )
                );
                const leftCropped = cropCanvas(
                    leftSingleCanvas,
                    leftCenter.x,
                    leftCenter.y,
                    leftTargetSize
                );

                const rightTargetSize = Math.max(
                    1,
                    Math.min(
                        IMAGE_CELL_SIZE,
                        rightSingleCanvas.width,
                        rightSingleCanvas.height
                    )
                );
                let rightCropped: HTMLCanvasElement;

                if (Math.abs(rightRotationRad) < 1e-4) {
                    rightCropped = cropCanvas(
                        rightSingleCanvas,
                        rightCenter.x,
                        rightCenter.y,
                        rightTargetSize
                    );
                } else {
                    const expandedSize = getExpandedCropSizeForRotation(
                        rightTargetSize,
                        rightRotationRad
                    );
                    const safeSize = Math.max(
                        1,
                        Math.min(
                            expandedSize,
                            rightSingleCanvas.width,
                            rightSingleCanvas.height
                        )
                    );
                    const expandedCropped = cropCanvas(
                        rightSingleCanvas,
                        rightCenter.x,
                        rightCenter.y,
                        safeSize
                    );
                    rightCropped = rotateCanvas(
                        expandedCropped,
                        rightRotationRad,
                        rightTargetSize
                    );
                }

                return {
                    left: leftCropped.toDataURL("image/png"),
                    right: rightCropped.toDataURL("image/png"),
                };
            })
        );

        const leftImages: RenderedImages = {
            originalDataUrl: leftOriginal,
            allMarkingsCanvas: leftAllCanvas,
            selectedMarkingsCanvas: leftSelectedCanvas,
        };
        const rightImages: RenderedImages = {
            originalDataUrl: rightOriginal,
            allMarkingsCanvas: rightAllCanvas,
            selectedMarkingsCanvas: rightSelectedCanvas,
        };

        stage = "report-metadata";
        const {
            reportId,
            reportDateTime,
            performedBy,
            department,
            address,
            appVersion,
        } = await buildReportIdentity(options, leftMeta, rightMeta);

        stage = "build-dom";
        const root = createReportRoot();
        root.appendChild(createStyles());

        const addressHtml =
            address.length > 0
                ? address.map(line => `<div>${line}</div>`).join("")
                : "<div>-</div>";

        const page1 = createPage();
        page1.innerHTML = `
        <div class="report-title">${tReport("Technical report title")}</div>
        <div class="meta-grid">
            <div>${tReport("Report ID label")} <strong>${reportId}</strong></div>
            <div>${tReport("Report date and time label")} ${reportDateTime}</div>
            <div>${tReport("Performed by label")}</div>
            <div class="meta-block">
                <div>${performedBy || "-"}</div>
                <div>${department || "-"}</div>
                ${addressHtml}
            </div>
        </div>

        <div class="section-title">${tReport("Software information")}</div>
        <div class="software-grid">
            <div>${tReport("Application name")} Biometrics-Studio</div>
            <div>${tReport("Application version")} ${appVersion}</div>
        </div>

        <div class="section-title">${tReport("Input material")}</div>
        <div class="input-grid">
            <div class="meta-block">
                <div><strong>${tReport("Image 1")}:</strong></div>
                <div>${tReport("File name")} ${leftMeta.name}</div>
                <div>${tReport("Image dimensions")} ${leftMeta.width} x ${leftMeta.height} px</div>
                <div>${tReport("Size")} ${formatBytes(leftMeta.sizeBytes)}</div>
                <div>${tReport("Checksum")} ${leftMeta.checksum}</div>
            </div>
            <div class="meta-block">
                <div><strong>${tReport("Image 2")}:</strong></div>
                <div>${tReport("File name")} ${rightMeta.name}</div>
                <div>${tReport("Image dimensions")} ${rightMeta.width} x ${rightMeta.height} px</div>
                <div>${tReport("Size")} ${formatBytes(rightMeta.sizeBytes)}</div>
                <div>${tReport("Checksum")} ${rightMeta.checksum}</div>
            </div>
        </div>

        <div class="counts">
            <div>${tReport("Matched features count")} ${matched.length}</div>
            <div>${tReport("Selected features count")} ${selectedFeatures.length}</div>
        </div>

        <div class="note">
            <div class="section-title">${tReport("Note title")}</div>
            <div>${tReport("Note body")}</div>
        </div>

        ${createFooter(1, reportId, tReport)}
    `;

        const pages: HTMLElement[] = [page1];

        pages.push(
            createFigurePage(
                tReport("Figure 1"),
                leftImages.originalDataUrl,
                tReport("Image 1 label"),
                pages.length + 1,
                reportId,
                tReport
            )
        );
        pages.push(
            createFigurePage(
                tReport("Figure 2"),
                leftImages.allMarkingsCanvas.toDataURL("image/png"),
                tReport("Image 1 label"),
                pages.length + 1,
                reportId,
                tReport
            )
        );
        pages.push(
            createFigurePage(
                tReport("Figure 3"),
                rightImages.originalDataUrl,
                tReport("Image 2 label"),
                pages.length + 1,
                reportId,
                tReport
            )
        );
        pages.push(
            createFigurePage(
                tReport("Figure 4"),
                rightImages.allMarkingsCanvas.toDataURL("image/png"),
                tReport("Image 2 label"),
                pages.length + 1,
                reportId,
                tReport
            )
        );

        const chunks: {
            features: typeof selectedFeatures;
            crops: typeof detailCrops;
        }[] = [];
        for (let i = 0; i < selectedFeatures.length; i += FEATURES_PER_CHUNK) {
            const chunkFeatures = selectedFeatures.slice(
                i,
                i + FEATURES_PER_CHUNK
            );
            const chunkCrops = detailCrops.slice(i, i + FEATURES_PER_CHUNK);
            chunks.push({
                features: chunkFeatures,
                crops: chunkCrops,
            });
        }

        const overviewImages = await Promise.all(
            chunks.map(async chunk => {
                const [leftOverview, rightOverview] = await Promise.all([
                    createOverviewCalloutImage(
                        leftMeta.bytes,
                        chunk.features.map(x => x.left)
                    ),
                    createOverviewCalloutImage(
                        rightMeta.bytes,
                        chunk.features.map(x => x.right)
                    ),
                ]);
                return { leftOverview, rightOverview };
            })
        );

        chunks.forEach((chunk, chunkIdx) => {
            const images = overviewImages[chunkIdx];
            if (!images) return;

            const { leftOverview, rightOverview } = images;

            const overviewPage = createLandscapePage();
            const overviewTitle =
                chunks.length > 1
                    ? `${tReport("Comparative table overview")} (${chunkIdx + 1}/${chunks.length})`
                    : tReport("Comparative table overview");

            overviewPage.innerHTML = `
                <div class="section-title">${overviewTitle}</div>
                <div class="overview-grid landscape">
                    <img src="${leftOverview}" alt="Left overview" />
                    <img src="${rightOverview}" alt="Right overview" />
                </div>
                ${createFooter(pages.length + 1, reportId, tReport)}
            `;
            pages.push(overviewPage);

            chunk.features.forEach((feature, idx) => {
                const isNewPage = idx % ROWS_PER_PAGE === 0;

                if (isNewPage) {
                    const detailPage = createPage();
                    const detailTitle =
                        chunks.length > 1
                            ? `${tReport("Comparative table details")} (${chunkIdx + 1}/${chunks.length})`
                            : tReport("Comparative table details");

                    detailPage.innerHTML = `
                        <div class="section-title">${detailTitle}</div>
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>${tReport("Feature")}</th>
                                    <th>${tReport("Image 1")}</th>
                                    <th>${tReport("Image 2")}</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                        ${createFooter(pages.length + 1, reportId, tReport)}
                    `;
                    pages.push(detailPage);
                }

                const currentPage = pages[pages.length - 1];
                if (!currentPage) return;
                const tableBody = currentPage.querySelector(
                    "tbody"
                ) as HTMLTableSectionElement;
                if (!tableBody) return;

                const featureTypeDefinition = markingTypes.find(
                    type => type.id === feature.left.typeId
                );
                const featureType = resolveFeatureTypeName(
                    featureTypeDefinition,
                    tReport
                );
                const escapedFeatureType = escapeHtml(featureType);
                const markerRing = toCssColor(
                    featureTypeDefinition?.backgroundColor,
                    "#cc0000"
                );
                const markerOutline = toCssColor(
                    featureTypeDefinition?.textColor,
                    "#7a0000"
                );

                const { crops } = chunk;
                // eslint-disable-next-line security/detect-object-injection
                const detailCrop = crops[idx];
                if (!detailCrop) return;
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>
                        <div class="feature-cell">
                            <div
                                class="feature-index"
                                style="--marker-ring: ${markerRing}; --marker-outline: ${markerOutline}; --marker-text: ${markerOutline};"
                            >
                                <span class="feature-index-value">${feature.left.label}</span>
                            </div>
                            <div class="feature-type">${tReport("Feature type")} ${escapedFeatureType}</div>
                        </div>
                    </td>
                    <td><img class="feature-image" src="${detailCrop.left}" alt="${escapedFeatureType} (left)" /></td>
                    <td><img class="feature-image" src="${detailCrop.right}" alt="${escapedFeatureType} (right)" /></td>
                `;
                tableBody.appendChild(row);
            });
        });

        stage = "render-pdf";
        try {
            await renderPagesToPdf(
                root,
                pages,
                tKeywords("Generate report"),
                `report-${reportId}.pdf`
            );
        } finally {
            if (languageChanged) {
                await i18n.changeLanguage(previousLanguage);
            }
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // eslint-disable-next-line no-console
        console.error(`[report] failed at ${stage}: ${message}`, error);
        throw new Error(`Report failed at ${stage}: ${message}`);
    }
};
/* eslint-enable sonarjs/cognitive-complexity */
