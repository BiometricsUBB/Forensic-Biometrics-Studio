/**
 * @file Type definitions based on the INTERPOL Implementation of the “ANSI/NIST-ITL 1-2011: UPDATE 2015” standard.
 * @see Implementation specification: “NIST INTERPOL standard v6.00.02”
 * @see Source PDF: https://github.com/INTERPOL-Innovation-Centre/ANSI-NIST-XML-ITL-Implementation/blob/master/Documentation/NIST%20INTERPOL%20standard%20v6.00.02.pdf
 */

/**
 * Minutia type classification.
 * @see INTERPOL Implementation - Appendix A, Table A.27
 */
export enum MinutiaType {
    Other = 0,
    RidgeEnding = 1,
    RidgeBifurcation = 2,
}

/**
 * Represents the structure of Field 09.137 (M1 Finger Minutiae Data - FMD).
 */
export interface InterpolMinutiaType {
    /** Field 09.137-A (Minutia Index Number - MAN): Unique identifier for the minutia point. */
    id: number;

    /** Field 09.137-B (X Coordinate - MXC): Horizontal position in pixels (measured from left to right). */
    x: number;

    /** Field 09.137-C (Y Coordinate - MYC): Vertical position in pixels (measured from top to bottom). */
    y: number;

    /** Field 09.137-D (Minutia Angle - MAV): Angle of the minutia.
     * @type {number} Represented in 2-degree increments, limiting the value range to [0, 179].
     */
    angle: number;

    /** Field 09.137-E (Minutia Type - M1M): Categorization of the minutia point. */
    type: MinutiaType;

    /** Field 09.137-F (Quality of Minutia - QOM): Predictor of minutia reliability.
     * Value ranges from 1 (lowest quality) to 100 (highest quality).
     * A value of 0 indicates that no quality score is available.
     */
    quality: number;
}

/**
 * Represents the structure of Field 09.139 (M1 Core Information - CIN).
 */
export interface InterpolCoreMinutiaType {
    /** Field 09.139-A (X Coordinate - XCC): Horizontal core position in pixels (measured from left to right). */
    x: number;

    /** Field 09.139-B (Y Coordinate - YCC): Vertical core position in pixels (measured from top to bottom). */
    y: number;

    /** Field 09.139-C (Angle of the Core - ANGC): Orientation angle of the fingerprint core.
     * @type {number} Represented in 2-degree increments, limiting the value range to [0, 179].
     */
    angle: number;
}

/**
 * Represents the structure of Field 09.140 (M1 Delta Information - DIN),
 * integrating data from Field 09.141 (M1 Additional Delta Angles - ADA).
 */
export interface InterpolDeltaMinutiaType {
    /** Field 09.140-A (X Coordinate - XCD): Horizontal delta position in pixels (measured from left to right). */
    x: number;

    /** Field 09.140-B (Y Coordinate - YCD): Vertical delta position in pixels (measured from top to bottom). */
    y: number;

    /** Field 09.140-C (First Angle of the Delta / ANG1): Primary orientation angle of the delta.
     * @type {number} Represented in 2-degree increments, limiting the value range to [0, 179].
     */
    angle: number;

    /** Field 09.141-A (Second Angle of the Delta / ANG2): Secondary orientation angle of the delta.
     * @type {number} Represented in 2-degree increments, limiting the value range to [0, 179].
     */
    secondAngle?: number;

    /** Field 09.141-B (Third Angle of the Delta / ANG3): The last orientation angle of the delta.
     * @type {number} Represented in 2-degree increments, limiting the value range to [0, 179].
     */
    thirdAngle?: number;
}
