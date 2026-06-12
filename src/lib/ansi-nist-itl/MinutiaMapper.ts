/**
 * @file Data mapping utility to convert fingerprint minutiae from the application's internal FBS format
 * to the "ANSI/NIST-ITL 1-2011: UPDATE 2015" standard (INTERPOL v6.00.02 XML implementation profile).
 */

import { MARKING_CLASS } from "@/lib/markings/MARKING_CLASS";
import { MarkingClass } from "@/lib/markings/MarkingClass";
import { MarkingType } from "@/lib/markings/MarkingType";
import { RayMarking } from "@/lib/markings/RayMarking";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";

import { DeltaMinutia } from "./DeltaMinutia";
import { CoreMinutia } from "./CoreMinutia";
import { Minutia } from "./Minutia";
import { MinutiaBase } from "./MinutiaBase";
import { MinutiaType } from "./InterpolMinutiaeTypes";

const MARKING_TYPE_NAMES = {
    CORE: "Core",
    DELTA: "Delta",
    BIFURCATION: "Bifurcation",
    RIDGE_MERGE: "RidgeMerge",
    RIDGE_BEGINNING: "RidgeBeginning",
    RIDGE_ENDING: "RidgeEnding",
} as const;

/**
 * TypeScript Type Guard to safely check if a marking is of type RayMarking.
 */
function isRayMarking(marking: MarkingClass): marking is RayMarking {
    return marking.markingClass === MARKING_CLASS.RAY;
}

/**
 * Converts application internal orientation angles from radians to the standardized INTERPOL degree representation.
 * * The conversion follows a 4-step processing pipeline:
 * 1. Inverts the mathematical rotation direction and shifts the 0-origin coordinate from Down to Right.
 * 2. Converts the adjusted radian value into raw decimal degrees.
 * 3. Normalizes the decimal degree value into a standard [0, 360) circle via double modulo operations.
 * 4. Quantizes the result into standard 2-degree increments [0, 179] matching INCITS 378 / NIST blocks (where 180 wraps to 0).
 *
 * @param appRadians - Input angle value represented in radians from the application coordinate system.
 * @returns Standardized orientation value mapped to 2-degree integer steps within the [0, 179] range.
 */
function mapAppRadiansToInterpolDegrees(appRadians: number): number {
    // 1. Invert the rotation direction and shift the 0-origin from Down to Right
    const correctedRadians = -appRadians - Math.PI / 2.0;

    // 2. Convert to raw decimal degrees
    const degrees = correctedRadians * (180.0 / Math.PI);

    // 3. Cleanly normalize into a 0 to 360 circle using modulo
    const normalizedDegrees = ((degrees % 360.0) + 360.0) % 360.0;

    // 4. Format for INCITS 378 Blocks (Range: 0 to 179)
    return Math.round(normalizedDegrees / 2.0) % 180;
}

/**
 * Maps internal UI-facing marking type classifications to the rigid biometric standard {@link MinutiaType} enum.
 *
 * @param markingType - The internal application marking configuration structure to evaluate.
 * @returns The matching {@link MinutiaType} value (RidgeEnding, RidgeBifurcation, or Other) defined by standard Table A.27.
 */
function getMinutiaType(markingType: MarkingType): MinutiaType {
    switch (markingType.name) {
        case MARKING_TYPE_NAMES.BIFURCATION:
        case MARKING_TYPE_NAMES.RIDGE_MERGE:
            return MinutiaType.RidgeBifurcation;

        case MARKING_TYPE_NAMES.RIDGE_BEGINNING:
        case MARKING_TYPE_NAMES.RIDGE_ENDING:
            return MinutiaType.RidgeEnding;

        default:
            return MinutiaType.Other;
    }
}

/**
 * Maps a single fingerprint marking from the internal FBS (Forensic Biometrics Studio) format
 * to an ANSI/NIST-ITL compliant minutia object structure tailored for the INTERPOL profile.
 *
 * @param marking - The source marking object containing origin coordinates, class, and type metadata.
 * @param minutiaId - Unique identifier to be assigned to the minutia point (corresponds to Field 09.137-A / MAN).
 * @param minutiaQuality - Quality reliability predictor value ranging from 1 to 100, defaults to 0 if unknown (Field 09.137-F / QOM).
 * @param availableTypes - Optional list of marking types to allow dependency injection during testing.
 * @returns A concrete instance of {@link MinutiaBase} (either {@link Minutia}, {@link CoreMinutia}, or {@link DeltaMinutia}).
 */
export function mapMinutiaFromFbsToAnsiNist(
    marking: MarkingClass,
    minutiaId: number,
    minutiaQuality = 0,
    availableTypes: MarkingType[] = MarkingTypesStore.state.types
): MinutiaBase {
    const xPosition = Math.round(marking.origin.x);
    const yPosition = Math.round(marking.origin.y);

    const angleRad = isRayMarking(marking) ? marking.angleRad : undefined;

    const markingType = availableTypes.find(t => t.id === marking.typeId);

    // Default orientation angle to 0 degrees for marking types that lack directional/ray information
    const interpolAngleDeg =
        angleRad !== undefined ? mapAppRadiansToInterpolDegrees(angleRad) : 0;

    if (markingType === undefined) {
        return new Minutia(
            xPosition,
            yPosition,
            interpolAngleDeg,
            minutiaId,
            MinutiaType.Other,
            minutiaQuality
        );
    }

    switch (markingType.name) {
        case MARKING_TYPE_NAMES.CORE:
            return new CoreMinutia(xPosition, yPosition, interpolAngleDeg);

        case MARKING_TYPE_NAMES.DELTA:
            // TODO: Handle additional delta angles (Field 09.141 / ADA) if provided by UI
            return new DeltaMinutia(xPosition, yPosition, interpolAngleDeg);

        default:
            return new Minutia(
                xPosition,
                yPosition,
                interpolAngleDeg,
                minutiaId,
                getMinutiaType(markingType),
                minutiaQuality
            );
    }
}
