/**
 * @file Abstract base definitions and structural classifications for all fingerprint minutiae types.
 * Based on the "NIST INTERPOL standard v6.00.02" specification.
 */

import { InterpolMinutiaType } from "./InterpolMinutiaeTypes";

/**
 * High-level structural classification of the minutia point within the application.
 */
export enum MINUTIA_CLASS {
    CORE = "core",
    DELTA = "delta",
    OTHER = "other",
}

/**
 * Abstract base class representing the core geometric properties shared by all types of minutiae.
 */
export abstract class MinutiaBase {
    /** The structural classification of this minutia instance. */
    public abstract readonly minutiaClass: MINUTIA_CLASS;

    /**
     * @param x Horizontal position in pixels.
     * @param y Vertical position in pixels.
     * @param angle Orientation angle represented in 2-degree increments [0, 179].
     */
    public constructor(
        /** See {@link InterpolMinutiaType.x} */
        public x: InterpolMinutiaType["x"],
        /** See {@link InterpolMinutiaType.y} */
        public y: InterpolMinutiaType["y"],
        /** See {@link InterpolMinutiaType.angle} */
        public angle: InterpolMinutiaType["angle"]
    ) {
        this.x = x;
        this.y = y;
        this.angle = angle;
    }
}
