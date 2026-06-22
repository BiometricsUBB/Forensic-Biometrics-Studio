/**
 * @file Class implementation for standard finger minutiae data conforming to Field 09.137 (M1 Finger Minutiae Data - FMD).
 * Based on the "NIST INTERPOL standard v6.00.02" specification.
 */

import { InterpolMinutiaType } from "./InterpolMinutiaeTypes";
import { MinutiaBase, MINUTIA_CLASS } from "./MinutiaBase";

/**
 * Represents standard finger minutiae data conforming to Field 09.137 (M1 Finger Minutiae Data - FMD).
 */
export class Minutia extends MinutiaBase implements InterpolMinutiaType {
    readonly minutiaClass = MINUTIA_CLASS.OTHER;

    /**
     * @param x Horizontal minutia position.
     * @param y Vertical minutia position.
     * @param angle Orientation angle of the minutia.
     * @param id Unique identifier.
     * @param type Minutia classification type.
     * @param quality Quality reliability predictor.
     */
    public constructor(
        /** Field 09.137-B (MXC): Horizontal position in pixels. See {@link InterpolMinutiaType.x} */
        public override x: InterpolMinutiaType["x"],

        /** Field 09.137-C (MYC): Vertical position in pixels. See {@link InterpolMinutiaType.y} */
        public override y: InterpolMinutiaType["y"],

        /** Field 09.137-D (MAV): Angle of the minutia in 2-degree increments [0, 179]. See {@link InterpolMinutiaType.angle} */
        public override angle: InterpolMinutiaType["angle"],

        /** Field 09.137-A (MAN): Unique identifier for the minutia point. See {@link InterpolMinutiaType.id} */
        public id: InterpolMinutiaType["id"],

        /** Field 09.137-E (M1M): Categorization of the minutia point type. See {@link InterpolMinutiaType.type} */
        public type: InterpolMinutiaType["type"],

        /** Field 09.137-F (QOM): Predictor of minutia reliability [1, 100] or 0 if unavailable. See {@link InterpolMinutiaType.quality} */
        public quality: InterpolMinutiaType["quality"]
    ) {
        super(x, y, angle);
        this.id = id;
        this.type = type;
        this.quality = quality;
    }
}
