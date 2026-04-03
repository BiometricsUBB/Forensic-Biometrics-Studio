import { MarkingClass } from "@/lib/markings/MarkingClass";
import { MARKING_CLASS } from "@/lib/markings/MARKING_CLASS";
import { Point } from "@/lib/markings/Point";

export class TriangleMarking extends MarkingClass {
    readonly markingClass = MARKING_CLASS.TRIANGLE;

    constructor(
        label: MarkingClass["label"],
        origin: MarkingClass["origin"],
        typeId: MarkingClass["typeId"],
        public points: Point[],
        ids?: string[]
    ) {
        super(label, origin, typeId, ids);
        this.points = points;
    }

    public calculatePointsViewportPosition(
        viewportWidthRatio: number,
        viewportHeightRatio: number
    ): Point[] {
        return this.points.map(point => ({
            x: point.x * viewportWidthRatio,
            y: point.y * viewportHeightRatio,
        }));
    }
}
