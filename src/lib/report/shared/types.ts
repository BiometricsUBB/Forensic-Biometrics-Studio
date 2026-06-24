import { MarkingClass } from "@/lib/markings/MarkingClass";

export type ImageMeta = {
    name: string;
    width: number;
    height: number;
    sizeBytes: number;
    checksum: string;
    bytes: Uint8Array;
};

export type PairedFeature = {
    id: string;
    left: MarkingClass;
    right: MarkingClass;
};

export type Side = "top" | "bottom" | "left" | "right";

export interface Placement {
    feature: MarkingClass;
    x: number;
    y: number;
    side: Side;
}

export interface Bounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

export const PAGE = { width: 794, height: 1123, margin: 95 };
export const LANDSCAPE = { width: PAGE.height, height: PAGE.width, margin: 70 };
export const IMAGE_CELL_SIZE = 200;
export const FULL_CIRCLE = Math.PI * 2;
