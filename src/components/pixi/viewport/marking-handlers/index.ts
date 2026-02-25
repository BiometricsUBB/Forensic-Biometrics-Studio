import { MARKING_CLASS } from "@/lib/markings/MARKING_CLASS";
import { PointMarkingHandler } from "./pointMarkingHandler";
import { RayMarkingHandler } from "./rayMarkingHandler";
import { LineSegmentMarkingHandler } from "./lineSegmentMarkingHandler";
import { BoundingBoxMarkingHandler } from "./boundingBoxMarkingHandler";
import { RectangleMarkingHandler } from "./rectangleMarkingHandler";
import { PolygonMarkingHandler } from "./polygonMarkingHandler";

// eslint-disable-next-line import/no-cycle
export * from "./markingHandler";
export * from "./rayMarkingHandler";
export * from "./pointMarkingHandler";
export * from "./lineSegmentMarkingHandler";
// Ta linijka jest kluczowa dla Twojego błędu:
export * from "./boundingBoxMarkingHandler";
export * from "./polygonMarkingHandler";
export * from "./rectangleMarkingHandler";

export const MARKING_HANDLERS = {
    [MARKING_CLASS.POINT]: PointMarkingHandler,
    [MARKING_CLASS.RAY]: RayMarkingHandler,
    [MARKING_CLASS.LINE_SEGMENT]: LineSegmentMarkingHandler,
    [MARKING_CLASS.BOUNDING_BOX]: BoundingBoxMarkingHandler,
    [MARKING_CLASS.RECTANGLE]: RectangleMarkingHandler,
    [MARKING_CLASS.POLYGON]: PolygonMarkingHandler,
};
