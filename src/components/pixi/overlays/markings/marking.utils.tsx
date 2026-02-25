import {
    ColorSource,
    Graphics as PixiGraphics,
    TextStyle,
    Text,
} from "pixi.js";
import { MARKING_CLASS } from "@/lib/markings/MARKING_CLASS";
import { RayMarking } from "@/lib/markings/RayMarking";
import { PointMarking } from "@/lib/markings/PointMarking";
import { MarkingClass } from "@/lib/markings/MarkingClass";
import { BitmapText } from "@pixi/text-bitmap";
import { LineSegmentMarking } from "@/lib/markings/LineSegmentMarking";
import { MarkingType } from "@/lib/markings/MarkingType";
import { BoundingBoxMarking } from "@/lib/markings/BoundingBoxMarking";
import { PolygonMarking } from "@/lib/markings/PolygonMarking";
import { RectangleMarking } from "@/lib/markings/RectangleMarking";
import { Point } from "@/lib/markings/Point";
import { Calibration } from "@/lib/stores/Markings/Markings.store";

const transformPoint = (
    point: Point,
    rotation: number,
    centerX: number,
    centerY: number
): Point => {
    if (rotation === 0) return point;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const x = point.x - centerX;
    const y = point.y - centerY;
    const rotatedX = x * cos - y * sin;
    const rotatedY = x * sin + y * cos;
    return {
        x: rotatedX + centerX,
        y: rotatedY + centerY,
    };
};

export const getFontName = (fontSize: number) => {
    const FONT_FAMILY_NAME = "Cousine";
    const MAX_FONT_SIZE = 32;
    const MIN_FONT_SIZE = 6;
    const clampedFontSize = Math.max(
        MIN_FONT_SIZE,
        Math.min(MAX_FONT_SIZE, Math.ceil(fontSize))
    );

    return `${FONT_FAMILY_NAME} ${clampedFontSize}`;
};

const drawLabel = (
    g: PixiGraphics,
    text: string,
    position: Point,
    size: number,
    textColor: ColorSource,
    centered: boolean = false
) => {
    const fontSize = Math.ceil(
        (size * 2) / (text.length === 1 ? 1 : text.length * 0.58)
    );
    const fontName = getFontName(fontSize);

    const label = new BitmapText(text, {
        fontName,
        fontSize,
        tint: textColor,
    });
    label.x = position.x;
    label.y = position.y;

    if (centered) {
        label.anchor.set(0.5, 0.5);
        const bg = new PixiGraphics();
        bg.beginFill(0x000000, 0.7);
        bg.drawRoundedRect(
            position.x - label.width / 2 - 2,
            position.y - label.height / 2 - 2,
            label.width + 4,
            label.height + 4,
            4
        );
        bg.endFill();
        g.addChild(bg);
    } else {
        label.anchor.set(0.5, 0.43);
    }

    g.addChild(label);
};

const lineWidth = 2;
const lineLength = 4;
const shadowWidth = 0.5;

const drawMeasurementMarking = (
    g: PixiGraphics,
    selected: boolean,
    { origin, endpoint }: LineSegmentMarking,
    { textColor, size }: MarkingType,
    relativeOrigin: Point,
    relativeEndpoint: Point,
    calibration?: Calibration
) => {
    const { x, y } = relativeOrigin;
    const { x: ex, y: ey } = relativeEndpoint;

    const dxReal = endpoint.x - origin.x;
    const dyReal = endpoint.y - origin.y;
    const distPx = Math.sqrt(dxReal * dxReal + dyReal * dyReal);

    if (distPx < 0.1) return;

    let textToDisplay = `${distPx.toFixed(2)} px`;
    if (
        calibration &&
        calibration.unit === "mm" &&
        calibration.pixelsPerUnit > 0
    ) {
        const distMm = distPx / calibration.pixelsPerUnit;
        textToDisplay = `${distMm.toFixed(2)} mm`;
    }

    if (selected) {
        g.lineStyle(size + 4, 0x0000ff, 0.3);
        g.moveTo(x, y).lineTo(ex, ey);
    }

    g.lineStyle(2, textColor);
    g.moveTo(x, y).lineTo(ex, ey);

    const angle = Math.atan2(ey - y, ex - x);
    const perpAngle = angle - Math.PI / 2;
    const tickSize = 10;

    const drawTick = (cx: number, cy: number) => {
        const x1 = cx + Math.cos(perpAngle) * (tickSize / 2);
        const y1 = cy + Math.sin(perpAngle) * (tickSize / 2);
        const x2 = cx - Math.cos(perpAngle) * (tickSize / 2);
        const y2 = cy - Math.sin(perpAngle) * (tickSize / 2);
        g.moveTo(x1, y1).lineTo(x2, y2);
    };
    drawTick(x, y);
    drawTick(ex, ey);

    const midX = (x + ex) / 2;
    const midY = (y + ey) / 2;

    const textOffset = 15;
    const textX = midX + Math.cos(perpAngle) * textOffset;
    const textY = midY + Math.sin(perpAngle) * textOffset;

    const style = new TextStyle({
        fontSize: 14,
        fill: 0xffffff,
        fontFamily: "Arial",
        fontWeight: "bold",
        stroke: 0x000000,
        strokeThickness: 3,
    });

    const label = new Text(textToDisplay, style);
    label.anchor.set(0.5, 0.5);
    label.x = textX;
    label.y = textY;
    label.resolution = 2;

    const bgPadding = 4;
    g.lineStyle(0);
    g.beginFill(0x000000, 0.6);
    g.drawRoundedRect(
        textX - label.width / 2 - bgPadding,
        textY - label.height / 2 - bgPadding,
        label.width + bgPadding * 2,
        label.height + bgPadding * 2,
        4
    );
    g.endFill();

    g.addChild(label);
};

const drawPointMarking = (
    g: PixiGraphics,
    selected: boolean,
    { label }: PointMarking,
    { backgroundColor, textColor, size }: MarkingType,
    relativeOrigin: Point,
    showMarkingLabels?: boolean
) => {
    const { x, y } = relativeOrigin;
    if (selected) {
        g.lineStyle(1, textColor);
        g.beginFill(0x0000ff, 0.5);
        g.drawRect(x - size - 2, y - size - 2, size * 2 + 4, size * 2 + 4);
    }

    g.lineStyle(shadowWidth, textColor);
    g.drawCircle(x, y, size);
    g.beginFill(backgroundColor);
    g.drawCircle(x, y, size - shadowWidth);
    g.endFill();

    if (showMarkingLabels) {
        drawLabel(g, String(label), relativeOrigin, size, textColor);
    } else {
        g.beginHole();
        g.drawCircle(x, y, size - lineWidth - 1 - shadowWidth);
        g.endHole();
        g.drawCircle(x, y, size - lineWidth - 2 - shadowWidth);
    }
};

const drawRayMarking = (
    g: PixiGraphics,
    selected: boolean,
    { angleRad, label }: RayMarking,
    { backgroundColor, textColor, size }: MarkingType,
    relativeOrigin: Point,
    showMarkingLabels?: boolean,
    rotation: number = 0
) => {
    const { x, y } = relativeOrigin;

    if (selected) {
        g.lineStyle(1, textColor);
        g.beginFill(0x0000ff, 0.5);
        g.drawRect(x - size - 2, y - size - 2, size * 2 + 4, size * 2 + 4);
    }

    const a = new PixiGraphics();
    a.pivot.set(x, y);
    a.rotation = angleRad + rotation;

    a.moveTo(x, y - 3 * shadowWidth);
    a.lineStyle(lineWidth + 3 * shadowWidth, textColor);
    a.lineTo(x, y + lineLength * size + 3 * shadowWidth);

    a.moveTo(x, y);
    a.lineStyle(lineWidth, backgroundColor);
    a.lineTo(x, y + lineLength * size);
    a.position.set(x, y);

    g.addChild(a);

    const b = new PixiGraphics();
    b.lineStyle(shadowWidth, textColor);
    b.drawCircle(x, y, size);
    b.beginFill(backgroundColor);
    b.drawCircle(x, y, size - shadowWidth);
    b.endFill();
    if (showMarkingLabels) {
        drawLabel(b, String(label), relativeOrigin, size, textColor);
    } else {
        b.beginHole();
        b.drawCircle(x, y, size - lineWidth - 1 - shadowWidth);
        b.endHole();
        b.drawCircle(x, y, size - lineWidth - 2 - shadowWidth);
    }

    g.addChild(b);
};

const drawLineSegmentMarking = (
    g: PixiGraphics,
    selected: boolean,
    { label }: LineSegmentMarking,
    { backgroundColor, textColor, size }: MarkingType,
    relativeOrigin: Point,
    relativeEndpoint: Point,
    showMarkingLabels?: boolean
) => {
    const { x, y } = relativeOrigin;
    const { x: ex, y: ey } = relativeEndpoint;

    if (selected) {
        g.lineStyle(1, textColor);
        g.beginFill(0x0000ff, 0.5);
        g.drawRect(x - size - 2, y - size - 2, size * 2 + 4, size * 2 + 4);
    }

    const origin = new PixiGraphics();
    origin.lineStyle(shadowWidth, textColor).drawCircle(x, y, size);
    origin
        .beginFill(backgroundColor)
        .drawCircle(x, y, size - shadowWidth)
        .endFill();

    const line = new PixiGraphics();
    line.moveTo(x, y)
        .lineStyle(lineWidth + 3 * shadowWidth, textColor)
        .lineTo(ex, ey);
    line.moveTo(x, y).lineStyle(lineWidth, backgroundColor).lineTo(ex, ey);

    const endpoint = new PixiGraphics();
    endpoint.lineStyle(shadowWidth, textColor).drawCircle(ex, ey, size);
    endpoint
        .beginFill(backgroundColor)
        .drawCircle(ex, ey, size - shadowWidth)
        .endFill();
    endpoint
        .beginHole()
        .drawCircle(ex, ey, size - lineWidth - 1 - shadowWidth)
        .drawCircle(ex, ey, size - lineWidth - 2 - shadowWidth)
        .endHole();

    if (showMarkingLabels) {
        drawLabel(origin, String(label), relativeOrigin, size, textColor);
    } else {
        origin.beginHole();
        origin.drawCircle(x, y, size - lineWidth - 1 - shadowWidth);
        origin.endHole();
        origin.drawCircle(x, y, size - lineWidth - 2 - shadowWidth);
    }

    g.addChild(line);
    g.addChild(origin);
    g.addChild(endpoint);
};

const drawBoundingBoxMarking = (
    g: PixiGraphics,
    selected: boolean,
    { label }: BoundingBoxMarking,
    { backgroundColor, textColor, size }: MarkingType,
    relativeOrigin: Point,
    relativeEndpoint: Point,
    showMarkingLabels?: boolean
) => {
    const { x, y } = relativeOrigin;
    const { x: ex, y: ey } = relativeEndpoint;

    const rectX = Math.min(x, ex);
    const rectY = Math.min(y, ey);
    const rectWidth = Math.abs(ex - x);
    const rectHeight = Math.abs(ey - y);

    if (selected) {
        g.lineStyle(1, textColor);
        g.beginFill(0x0000ff, 0.5);
        g.drawRect(
            rectX - size - 2,
            rectY - size - 2,
            rectWidth + size * 2 + 4,
            rectHeight + size * 2 + 4
        );
    }

    g.lineStyle(2, textColor);
    g.drawRect(rectX, rectY, rectWidth, rectHeight);

    g.beginFill(backgroundColor, 0.3);
    g.drawRect(rectX, rectY, rectWidth, rectHeight);
    g.endFill();

    if (showMarkingLabels) {
        const labelPadding = 4;
        const labelText = String(label);
        const hexTextColor = `${textColor.toString(16).padStart(6, "0")}`;

        const textStyle = new TextStyle({
            fontSize: size * 1.5,
            fill: hexTextColor,
            fontWeight: "bold",
        });

        const labelTextObj = new Text(labelText, textStyle);

        const labelWidth = labelTextObj.width + labelPadding * 2;
        const labelHeight = labelTextObj.height + labelPadding;

        g.beginFill(backgroundColor, 1);
        g.drawRect(rectX, rectY - labelHeight, labelWidth, labelHeight);
        g.endFill();

        labelTextObj.x = rectX + labelPadding;
        labelTextObj.y = rectY - labelHeight + labelPadding / 2;

        g.addChild(labelTextObj);
    }
};

const drawPolygonMarking = (
    g: PixiGraphics,
    selected: boolean,
    { label }: PolygonMarking | RectangleMarking,
    { backgroundColor, textColor, size }: MarkingType,
    relativeOrigin: Point,
    relativePoints: Point[],
    showMarkingLabels?: boolean
) => {
    if (relativePoints.length === 0) return;

    if (selected) {
        const minX = Math.min(...relativePoints.map(p => p.x));
        const maxX = Math.max(...relativePoints.map(p => p.x));
        const minY = Math.min(...relativePoints.map(p => p.y));
        const maxY = Math.max(...relativePoints.map(p => p.y));
        g.lineStyle(1, textColor);
        g.beginFill(0x0000ff, 0.5);
        g.drawRect(
            minX - size - 2,
            minY - size - 2,
            maxX - minX + size * 2 + 4,
            maxY - minY + size * 2 + 4
        );
    }

    g.lineStyle(lineWidth, backgroundColor);
    const [firstPoint, ...restPoints] = relativePoints;
    if (firstPoint) {
        g.moveTo(firstPoint.x, firstPoint.y);
        restPoints.forEach(point => {
            g.lineTo(point.x, point.y);
        });
        if (relativePoints.length > 2) {
            g.lineTo(firstPoint.x, firstPoint.y);
        }
    }

    if (relativePoints.length > 2) {
        g.beginFill(backgroundColor, 0.3);
        g.drawPolygon(relativePoints.map(p => [p.x, p.y]).flat());
        g.endFill();
    }

    const firstPointForLabel = relativePoints[0];
    if (firstPointForLabel) {
        g.lineStyle(shadowWidth, textColor);
        g.drawCircle(firstPointForLabel.x, firstPointForLabel.y, size);
        g.beginFill(backgroundColor);
        g.drawCircle(
            firstPointForLabel.x,
            firstPointForLabel.y,
            size - shadowWidth
        );
        g.endFill();
        drawLabel(g, String(label), firstPointForLabel, size, textColor);
    }

    if (showMarkingLabels) {
        drawLabel(g, String(label), relativeOrigin, size, textColor);
    }
};

type BlinkState = { label: number; until: number; periodMs: number } | null;

let blinking: BlinkState = null;

export const blinkMarking = (label: number, flashes = 3, periodMs = 150) => {
    const durationMs = flashes * 2 * periodMs;
    blinking = { label, until: Date.now() + durationMs, periodMs };
};

export const isBlinkActive = () => !!blinking && Date.now() < blinking.until;

const isBlinkingThis = (label: number) =>
    !!blinking && blinking.label === label && Date.now() < blinking.until;

const shouldBlinkNow = (periodMs: number) =>
    Math.floor(Date.now() / periodMs) % 2 === 0;

export const drawMarking = (
    g: PixiGraphics,
    isSelected: boolean,
    marking: MarkingClass,
    markingType: MarkingType,
    viewportWidthRatio: number,
    viewportHeightRatio: number,
    showMarkingLabels?: boolean,
    calibration?: Calibration,
    rotation: number = 0,
    centerX: number = 0,
    centerY: number = 0
) => {
    if (!markingType) return;

    const emphasize = isBlinkingThis(marking.label)
        ? shouldBlinkNow(blinking!.periodMs)
        : isSelected;

    // Calculate the viewport position of the marking, based on zoom level
    const origin = marking.calculateOriginViewportPosition(
        viewportWidthRatio,
        viewportHeightRatio
    );
    const markingViewportPosition = transformPoint(
        origin,
        rotation,
        centerX,
        centerY
    );

    switch (marking.markingClass) {
        case MARKING_CLASS.POINT:
            drawPointMarking(
                g,
                emphasize,
                marking as PointMarking,
                markingType,
                markingViewportPosition,
                showMarkingLabels
            );
            break;

        case MARKING_CLASS.RAY:
            drawRayMarking(
                g,
                emphasize,
                marking as RayMarking,
                markingType,
                markingViewportPosition,
                showMarkingLabels,
                rotation
            );
            break;

        case MARKING_CLASS.MEASUREMENT:
            drawMeasurementMarking(
                g,
                emphasize,
                marking as LineSegmentMarking,
                markingType,
                markingViewportPosition,
                transformPoint(
                    (
                        marking as LineSegmentMarking
                    ).calculateEndpointViewportPosition(
                        viewportWidthRatio,
                        viewportHeightRatio
                    ),
                    rotation,
                    centerX,
                    centerY
                ),
                calibration
            );
            break;

        case MARKING_CLASS.LINE_SEGMENT:
            drawLineSegmentMarking(
                g,
                emphasize,
                marking as LineSegmentMarking,
                markingType,
                markingViewportPosition,
                transformPoint(
                    (
                        marking as LineSegmentMarking
                    ).calculateEndpointViewportPosition(
                        viewportWidthRatio,
                        viewportHeightRatio
                    ),
                    rotation,
                    centerX,
                    centerY
                ),
                showMarkingLabels
            );
            break;

        case MARKING_CLASS.BOUNDING_BOX:
            drawBoundingBoxMarking(
                g,
                emphasize,
                marking as BoundingBoxMarking,
                markingType,
                markingViewportPosition,
                transformPoint(
                    (
                        marking as BoundingBoxMarking
                    ).calculateEndpointViewportPosition(
                        viewportWidthRatio,
                        viewportHeightRatio
                    ),
                    rotation,
                    centerX,
                    centerY
                ),
                showMarkingLabels
            );
            break;

        case MARKING_CLASS.POLYGON:
        case MARKING_CLASS.RECTANGLE:
            drawPolygonMarking(
                g,
                emphasize,
                marking as PolygonMarking | RectangleMarking,
                markingType,
                markingViewportPosition,
                (marking as PolygonMarking | RectangleMarking)
                    .calculatePointsViewportPosition(
                        viewportWidthRatio,
                        viewportHeightRatio
                    )
                    .map(p => transformPoint(p, rotation, centerX, centerY)),
                showMarkingLabels
            );
            break;

        default:
            break;
    if (marking instanceof PointMarking) {
        drawPointMarking(
            g,
            isSelected,
            marking,
            markingType,
            markingViewportPosition,
            showMarkingLabels
        );
    } else if (marking instanceof RayMarking) {
        drawRayMarking(
            g,
            isSelected,
            marking,
            markingType,
            markingViewportPosition,
            showMarkingLabels,
            rotation
        );
    } else if (marking instanceof LineSegmentMarking) {
        drawLineSegmentMarking(
            g,
            isSelected,
            marking,
            markingType,
            markingViewportPosition,
            transformPoint(
                marking.calculateEndpointViewportPosition(
                    viewportWidthRatio,
                    viewportHeightRatio
                ),
                rotation,
                centerX,
                centerY
            ),
            showMarkingLabels
        );
    } else if (marking instanceof BoundingBoxMarking) {
        drawBoundingBoxMarking(
            g,
            isSelected,
            marking,
            markingType,
            markingViewportPosition,
            transformPoint(
                marking.calculateEndpointViewportPosition(
                    viewportWidthRatio,
                    viewportHeightRatio
                ),
                rotation,
                centerX,
                centerY
            ),
            showMarkingLabels
        );
    } else if (
        marking instanceof PolygonMarking ||
        marking instanceof RectangleMarking
    ) {
        drawPolygonMarking(
            g,
            isSelected,
            marking,
            markingType,
            markingViewportPosition,
            marking
                .calculatePointsViewportPosition(
                    viewportWidthRatio,
                    viewportHeightRatio
                )
                .map(p => transformPoint(p, rotation, centerX, centerY)),
            showMarkingLabels
        );
    } else {
        throw new Error(`Unsupported marking class: ${marking.markingClass}`);
    }
};
