import { LineSegmentMarking } from "./LineSegmentMarking";
import { MARKING_CLASS } from "./MARKING_CLASS";
import { Point } from "./Point";

export class MeasurementMarking extends LineSegmentMarking {
    override readonly markingClass: MARKING_CLASS = MARKING_CLASS.MEASUREMENT;

    constructor(
        label: number,
        origin: Point, // FIX: second arg (matches parent class)
        typeId: string, // FIX: third arg (matches parent class)
        endpoint: Point,
        ids?: string[]
    ) {
        super(label, origin, typeId, endpoint, ids);
    }
}
