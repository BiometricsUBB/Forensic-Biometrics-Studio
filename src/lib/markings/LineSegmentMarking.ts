import { MARKING_CLASS } from "./MARKING_CLASS";
import { MarkingClass } from "./MarkingClass";
import { Point } from "./Point";

export class LineSegmentMarking extends MarkingClass {
    readonly markingClass: MARKING_CLASS = MARKING_CLASS.LINE_SEGMENT;

    constructor(
        label: number,
        public override origin: Point, // FIX: Point as the SECOND arg
        typeId: string, // FIX: string as the THIRD arg
        public endpoint: Point,
        ids?: string[]
    ) {
        super(label, origin, typeId, ids);
    }

    public override calculateOriginViewportPosition(
        widthRatio: number,
        heightRatio: number
    ): Point {
        return {
            x: this.origin.x * widthRatio,
            y: this.origin.y * heightRatio,
        };
    }

    public calculateEndpointViewportPosition(
        widthRatio: number,
        heightRatio: number
    ): Point {
        return {
            x: this.endpoint.x * widthRatio,
            y: this.endpoint.y * heightRatio,
        };
    }
}
