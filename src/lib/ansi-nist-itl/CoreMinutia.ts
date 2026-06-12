/**
 * @file Class implementation for fingerprint core information conforming to Field 09.139 (M1 Core Information - CIN).
 * Based on the "NIST INTERPOL standard v6.00.02" specification.
 */

import { InterpolCoreMinutiaType } from "./InterpolMinutiaeTypes";
import { MinutiaBase, MINUTIA_CLASS } from "./MinutiaBase";

/**
 * Represents fingerprint core information conforming to Field 09.139 (M1 Core Information - CIN).
 */
export class CoreMinutia
    extends MinutiaBase
    implements InterpolCoreMinutiaType
{
    readonly minutiaClass = MINUTIA_CLASS.CORE;

    // eslint-disable-next-line no-useless-constructor
    /**
     * @param x Horizontal core position.
     * @param y Vertical core position.
     * @param angle Orientation angle of the core.
     */
    constructor(
        /** Field 09.139-A (XCC): Horizontal core position in pixels. See {@link InterpolCoreMinutiaType.x} */
        public override x: InterpolCoreMinutiaType["x"],

        /** Field 09.139-B (YCC): Vertical core position in pixels. See {@link InterpolCoreMinutiaType.y} */
        public override y: InterpolCoreMinutiaType["y"],

        /** Field 09.139-C (ANGC): Orientation angle of the fingerprint core represented in 2-degree increments [0, 179]. See {@link InterpolCoreMinutiaType.angle} */
        public override angle: InterpolCoreMinutiaType["angle"]
    ) {
        super(x, y, angle);
    }
}
