import { LineSegmentMarking } from "./LineSegmentMarking";
import { MARKING_CLASS } from "./MARKING_CLASS";

export class MeasurementMarking extends LineSegmentMarking {
    override readonly markingClass: MARKING_CLASS = MARKING_CLASS.MEASUREMENT;
}
