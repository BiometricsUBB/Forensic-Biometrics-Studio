import { MarkingClass } from "@/lib/markings/MarkingClass";

export type ShoeprintReportGenerationOptions = {
    reportDateTime: string;
    reportLanguage?: string;
    performedBy: string;
    department: string;
    addressLines: string[];
    uniqueColor?: "red" | "green";
    reportTitle?: string;
};

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
export const UNIQUE_ROWS_PER_PAGE = 2;
export const FULL_CIRCLE = Math.PI * 2;
export const CANVAS_CONTEXT_ERROR = "Failed to create canvas context.";
export const PREFIX_PATTERN = "P:";
export const PREFIX_GROUP = "G:";
export const PREFIX_UNIQUE = "U:";
export const OVERVIEW_CHUNK_SIZE = 32;
