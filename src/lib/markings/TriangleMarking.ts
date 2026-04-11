import { MarkingClass } from "@/lib/markings/MarkingClass";
import { MARKING_CLASS } from "@/lib/markings/MARKING_CLASS";
import { Point } from "@/lib/markings/Point";
import { PointsMarkingClass } from "@/lib/markings/PointsMarkingClass";

export class TriangleMarking extends PointsMarkingClass {
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

    public clone(ids: string[]): this {
        return new TriangleMarking(
            this.label,
            { ...this.origin },
            this.typeId,
            this.points.map(p => ({ ...p })),
            ids
        ) as this;
    }
}
