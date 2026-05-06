import { MarkingClass } from "@/lib/markings/MarkingClass";
import { MARKING_CLASS } from "@/lib/markings/MARKING_CLASS";

export class RayMarking extends MarkingClass {
    readonly markingClass = MARKING_CLASS.RAY;

    constructor(
        label: MarkingClass["label"],
        origin: MarkingClass["origin"],
        typeId: MarkingClass["typeId"],
        public angleRad: number,
        ids?: string[]
    ) {
        super(label, origin, typeId, ids);
    }
}
