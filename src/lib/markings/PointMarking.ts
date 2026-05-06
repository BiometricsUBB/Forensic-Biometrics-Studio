import { MarkingClass } from "@/lib/markings/MarkingClass";
import { MARKING_CLASS } from "@/lib/markings/MARKING_CLASS";
import { MarkingType } from "@/lib/markings/MarkingType";

export class PointMarking extends MarkingClass {
    readonly markingClass = MARKING_CLASS.POINT;

    constructor(
        label: MarkingClass["label"],
        origin: MarkingClass["origin"],
        typeId: MarkingType["id"],
        ids?: string[]
    ) {
        super(label, origin, typeId, ids);
    }
}
