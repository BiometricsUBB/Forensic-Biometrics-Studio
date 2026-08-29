/* eslint-disable security/detect-object-injection */
import { Point } from "@/lib/markings/Point";

export const dist = (a: Point, b: Point): number =>
    Math.hypot(b.x - a.x, b.y - a.y);

// Closed polygon: the last edge wraps from the final vertex back to the first.
export const polygonSegments = (points: Point[]): number[] => {
    if (points.length < 3) return [];
    return points.map((point, i) =>
        dist(point, points[(i + 1) % points.length]!)
    );
};

export const polygonPerimeter = (points: Point[]): number =>
    polygonSegments(points).reduce((acc, len) => acc + len, 0);

// Shoelace (Gauss) formula.
export const polygonArea = (points: Point[]): number => {
    if (points.length < 3) return 0;
    const twiceArea = points.reduce((acc, point, i) => {
        const next = points[(i + 1) % points.length]!;
        return acc + (point.x * next.y - next.x * point.y);
    }, 0);
    return Math.abs(twiceArea) / 2;
};
