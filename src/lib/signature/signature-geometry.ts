/* eslint-disable security/detect-object-injection */
import { Point } from "@/lib/markings/Point";

/** Euclidean distance between two points. */
export const dist = (a: Point, b: Point): number =>
    Math.hypot(b.x - a.x, b.y - a.y);

/**
 * Lengths of the edges of a closed polygon (l1..lN), where the last edge
 * connects the final vertex back to the first one.
 */
export const polygonSegments = (points: Point[]): number[] => {
    if (points.length < 2) return [];
    return points.map((point, i) =>
        dist(point, points[(i + 1) % points.length]!)
    );
};

/** Perimeter of a closed polygon: P = sum of edge lengths. */
export const polygonPerimeter = (points: Point[]): number =>
    polygonSegments(points).reduce((acc, len) => acc + len, 0);

/** Area of a polygon via the shoelace (Gauss) formula, absolute value. */
export const polygonArea = (points: Point[]): number => {
    if (points.length < 3) return 0;
    const twiceArea = points.reduce((acc, point, i) => {
        const next = points[(i + 1) % points.length]!;
        return acc + (point.x * next.y - next.x * point.y);
    }, 0);
    return Math.abs(twiceArea) / 2;
};
