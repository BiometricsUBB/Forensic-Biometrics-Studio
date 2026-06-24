import { MarkingClass } from "@/lib/markings/MarkingClass";
import { clamp, toBlobBytes } from "../report-utils";
import {
    Side,
    Placement,
    Bounds,
    FULL_CIRCLE,
    CANVAS_CONTEXT_ERROR,
} from "./types";

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
    if (angle >= -diagAngle + bias && angle < diagAngle - bias) return "right";
    if (angle >= diagAngle - bias && angle < Math.PI - diagAngle + bias)
        return "bottom";
    if (angle >= -Math.PI + diagAngle - bias && angle < -diagAngle + bias)
        return "top";
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
                sideCounts[item.side] += 1;
            });
            let bestSide: Side = cluster[0]?.side || "top";
            let maxCount = 0;
            (Object.entries(sideCounts) as [Side, number][]).forEach(
                ([s, count]) => {
                    if (count > maxCount) {
                        maxCount = count;
                        bestSide = s as Side;
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
        const idealPointsPerSide = placements.length / 4;
        const slack = 1.5 - pass * 0.2;
        const maxPointsPerSide = Math.max(
            3,
            Math.ceil(idealPointsPerSide * slack)
        );
        sides.forEach(side => {
            const sidePlacements = placements.filter(p => p.side === side);
            if (sidePlacements.length <= maxPointsPerSide) return;
            sidePlacements.sort((a, b) =>
                side === "top" || side === "bottom"
                    ? a.feature.origin.x - b.feature.origin.x
                    : a.feature.origin.y - b.feature.origin.y
            );
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
                    if (moved)
                        sidePlacements.splice(sidePlacements.indexOf(p), 1);
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
    const firstItem = sidePlacements[0];
    const lastItem = sidePlacements[sidePlacements.length - 1];
    if (!firstItem || !lastItem) return;
    const firstPos =
        side === "top" || side === "bottom" ? firstItem.x : firstItem.y;
    const lastPos =
        side === "top" || side === "bottom" ? lastItem.x : lastItem.y;
    const totalDim = lastPos - firstPos;
    if (totalDim < availableSize) {
        const expansionFactor = Math.min(
            expansionFactorLimit,
            availableSize / totalDim
        );
        const center = (firstPos + lastPos) / 2;
        sidePlacements.forEach(p => {
            const cp = p;
            if (side === "top" || side === "bottom")
                cp.x = center + (cp.x - center) * expansionFactor;
            else cp.y = center + (cp.y - center) * expansionFactor;
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
    const firstItem = sidePlacements[0];
    const lastItem = sidePlacements[sidePlacements.length - 1];
    if (!firstItem || !lastItem) return;
    const firstPos =
        side === "top" || side === "bottom" ? firstItem.x : firstItem.y;
    const lastPos =
        side === "top" || side === "bottom" ? lastItem.x : lastItem.y;
    const currentCenter = (firstPos + lastPos) / 2;
    const idealCenter =
        sidePlacements.reduce(
            (sum, p) =>
                sum +
                (side === "top" || side === "bottom"
                    ? p.feature.origin.x - cropX + margin
                    : p.feature.origin.y - cropY + margin),
            0
        ) / sidePlacements.length;
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
                if (curr.x - prev.x < minGap) curr.x = prev.x + minGap;
            } else if (curr.y - prev.y < minGap) curr.y = prev.y + minGap;
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
                if (p2.x < p1.x + minGap * 0.5) p2.x = p1.x + minGap * 0.5;
            } else if (p2.y < p1.y + minGap * 0.5) p2.y = p1.y + minGap * 0.5;
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
        .toSorted((a, b) =>
            side === "top" || side === "bottom"
                ? a.feature.origin.x - b.feature.origin.x
                : a.feature.origin.y - b.feature.origin.y
        );
    if (sidePlacements.length === 0) return;
    const minGap = numberCircleRadius * 3.0;
    resolveInitialGaps(sidePlacements, side, minGap);
    if (side === "top" || side === "bottom")
        expandPlacements(sidePlacements, side, cropWidth * 0.95, 1.5);
    else expandPlacements(sidePlacements, side, cropHeight * 0.95, 1.5);
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
    sidePlacements.sort((a, b) =>
        side === "top" || side === "bottom"
            ? a.feature.origin.x - b.feature.origin.x
            : a.feature.origin.y - b.feature.origin.y
    );
    enforceMinimumGaps(sidePlacements, side, minGap);
};

export const createOverviewCalloutImage = async (
    imageBytes: Uint8Array,
    features: MarkingClass[],
    color: string = "#cc0000"
) => {
    const bitmap = await createImageBitmap(new Blob([toBlobBytes(imageBytes)]));
    const { width, height } = bitmap;
    const numberCircleRadius = Math.max(
        16,
        Math.round(Math.min(width, height) * 0.025)
    );
    const margin = Math.max(84, Math.round(Math.min(width, height) * 0.22));
    const canvas = document.createElement("canvas");
    canvas.width = width + margin * 2;
    canvas.height = height + margin * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(CANVAS_CONTEXT_ERROR);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, margin, margin);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(margin, margin, width, height);
    if (features.length === 0) return canvas.toDataURL("image/png");
    const fontSize = Math.max(14, Math.round(numberCircleRadius * 1.1));
    ctx.lineWidth = 2.2;
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const imgLeft = margin;
    const imgTop = margin;
    const imgRight = margin + width;
    const imgBottom = margin + height;
    const edgeOffset = numberCircleRadius + 8;
    const featureBounds = getFeatureBounds(features, width, height);
    const placements: Placement[] = features.map(f =>
        getInitialPlacement(
            f,
            featureBounds,
            0,
            0,
            margin,
            imgLeft,
            imgTop,
            imgRight,
            imgBottom,
            width,
            height,
            edgeOffset
        )
    );
    applyClustering(
        placements,
        width,
        height,
        0,
        0,
        margin,
        imgTop,
        imgBottom,
        imgLeft,
        imgRight,
        edgeOffset
    );
    balanceSides(
        placements,
        0,
        0,
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
            width,
            height,
            0,
            0,
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
        const fx = feature.origin.x + margin;
        const fy = feature.origin.y + margin;
        const dx = slot.x - fx;
        const dy = slot.y - fy;
        const length = Math.max(1, Math.hypot(dx, dy));
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(
            slot.x - (dx / length) * numberCircleRadius,
            slot.y - (dy / length) * numberCircleRadius
        );
        ctx.stroke();
    });
    features.forEach(feature => {
        const slot = slotForFeature.get(feature);
        if (!slot) return;
        ctx.beginPath();
        ctx.fillStyle = "#ffffff";
        ctx.arc(slot.x, slot.y, numberCircleRadius, 0, FULL_CIRCLE);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.fillText(String(feature.label), slot.x, slot.y + 0.5);
    });
    return canvas.toDataURL("image/png");
};
