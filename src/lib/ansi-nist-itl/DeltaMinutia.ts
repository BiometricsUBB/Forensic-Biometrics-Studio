/**
 * @file Class implementation for fingerprint delta information conforming to Field 09.140 (M1 Delta Information - DIN)
 * and Field 09.141 (M1 Additional Delta Angles - ADA).
 * Based on the "NIST INTERPOL standard v6.00.02" specification.
 */

import { InterpolDeltaMinutiaType } from "./InterpolMinutiaeTypes";
import { MinutiaBase, MINUTIA_CLASS } from "./MinutiaBase";

/**
 * Represents fingerprint delta information conforming to Field 09.140 (M1 Delta Information - DIN)
 * and Field 09.141 (M1 Additional Delta Angles - ADA).
 */
export class DeltaMinutia
    extends MinutiaBase
    implements InterpolDeltaMinutiaType
{
    readonly minutiaClass = MINUTIA_CLASS.DELTA;

    /**
     * @param x Horizontal delta position.
     * @param y Vertical delta position.
     * @param angle Primary delta angle.
     * @param secondAngle Optional secondary delta angle.
     * @param thirdAngle Optional final delta angle.
     */
    constructor(
        /** Field 09.140-A (XCD): Horizontal delta position in pixels. See {@link InterpolDeltaMinutiaType.x} */
        public override x: InterpolDeltaMinutiaType["x"],

        /** Field 09.140-B (YCD): Vertical delta position in pixels. {@link InterpolDeltaMinutiaType.y} */
        public override y: InterpolDeltaMinutiaType["y"],

        /** Field 09.140-C (ANG1): Primary orientation angle of the delta represented in 2-degree increments [0, 179]. See {@link InterpolDeltaMinutiaType.angle} */
        public override angle: InterpolDeltaMinutiaType["angle"],

        /** Field 09.141-A (ANG2): Secondary orientation angle of the delta represented in 2-degree increments [0, 179]. See {@link InterpolDeltaMinutiaType.secondAngle} */
        public secondAngle?: InterpolDeltaMinutiaType["secondAngle"],

        /** Field 09.141-B (ANG3): The last orientation angle of the delta represented in 2-degree increments [0, 179]. See {@link InterpolDeltaMinutiaType.thirdAngle} */
        public thirdAngle?: InterpolDeltaMinutiaType["thirdAngle"]
    ) {
        super(x, y, angle);
        this.secondAngle = secondAngle;
        this.thirdAngle = thirdAngle;
    }
}
