/**
 * @file Unit tests for the MinutiaMapper utility.
 * Verifies the correct mapping of fingerprint markings from internal FBS format
 * to ANSI/NIST-ITL / INTERPOL compliant minutiae structures using Dependency Injection.
 */

import "jest";
import { mapMinutiaFromFbsToAnsiNist } from "../../src/lib/ansi-nist-itl/MinutiaMapper";
import { MARKING_CLASS } from "../../src/lib/markings/MARKING_CLASS";
import {
    defaultBackgroundColor,
    defaultSize,
    defaultTextColor,
    MarkingType,
} from "../../src/lib/markings/MarkingType";
import { Point } from "../../src/lib/markings/Point";
import { RayMarking } from "../../src/lib/markings/RayMarking";
import { PointMarking } from "../../src/lib/markings/PointMarking";
import { WORKING_MODE } from "../../src/views/selectMode";

import { MINUTIA_CLASS } from "../../src/lib/ansi-nist-itl/MinutiaBase";
import { MinutiaType } from "../../src/lib/ansi-nist-itl/InterpolMinutiaeTypes";
import { CoreMinutia } from "../../src/lib/ansi-nist-itl/CoreMinutia";
import { DeltaMinutia } from "../../src/lib/ansi-nist-itl/DeltaMinutia";
import { Minutia } from "../../src/lib/ansi-nist-itl/Minutia";

describe("MinutiaMapper - mapMinutiaFromFbsToAnsiNist", () => {
    const MOCK_MARKING_TYPE_IDS = {
        CORE: "uuid-core-type",
        DELTA: "uuid-delta-type",
        BIFURCATION: "uuid-bifurcation-type",
        RIDGE_ENDING: "uuid-ending-type",
        UNKNOWN: "uuid-unknown-type",
    } as const;

    /**
     * Isolated list of static marking type configurations used to inject
     * into the mapper, bypassing the global store state.
     */
    const MOCK_MARKING_TYPES: MarkingType[] = [
        {
            id: MOCK_MARKING_TYPE_IDS.CORE,
            name: "Core",
            displayName: "Core",
            markingClass: MARKING_CLASS.POINT,
            backgroundColor: defaultBackgroundColor,
            textColor: defaultTextColor,
            size: defaultSize,
            category: WORKING_MODE.FINGERPRINT,
        },
        {
            id: MOCK_MARKING_TYPE_IDS.DELTA,
            name: "Delta",
            displayName: "Delta",
            markingClass: MARKING_CLASS.POINT,
            backgroundColor: defaultBackgroundColor,
            textColor: defaultTextColor,
            size: defaultSize,
            category: WORKING_MODE.FINGERPRINT,
        },
        {
            id: MOCK_MARKING_TYPE_IDS.BIFURCATION,
            name: "Bifurcation",
            displayName: "Bifurcation",
            markingClass: MARKING_CLASS.RAY,
            backgroundColor: defaultBackgroundColor,
            textColor: defaultTextColor,
            size: defaultSize,
            category: WORKING_MODE.FINGERPRINT,
        },
        {
            id: MOCK_MARKING_TYPE_IDS.RIDGE_ENDING,
            name: "RidgeEnding",
            displayName: "RidgeEnding",
            markingClass: MARKING_CLASS.RAY,
            backgroundColor: defaultBackgroundColor,
            textColor: defaultTextColor,
            size: defaultSize,
            category: WORKING_MODE.FINGERPRINT,
        },
        {
            id: MOCK_MARKING_TYPE_IDS.UNKNOWN,
            name: "SomeCustomMarking",
            displayName: "SomeCustomMarking",
            markingClass: MARKING_CLASS.RAY,
            backgroundColor: defaultBackgroundColor,
            textColor: defaultTextColor,
            size: defaultSize,
            category: WORKING_MODE.FINGERPRINT,
        },
    ];

    it("should correctly round coordinates and default angle to 0 for non-ray markings", () => {
        const label = 1;
        const origin: Point = { x: 1217.5796395433022, y: 1278.6685591394883 };
        const typeId = MOCK_MARKING_TYPE_IDS.BIFURCATION;
        const ids = ["test-id"];

        const mockMarking = new PointMarking(label, origin, typeId, ids);

        const result = mapMinutiaFromFbsToAnsiNist(
            mockMarking,
            42,
            85,
            MOCK_MARKING_TYPES
        );

        expect(result.x).toBe(1218);
        expect(result.y).toBe(1279);
        expect(result.angle).toBe(0);
    });

    it("should map to CoreMinutia class when marking type is 'Core'", () => {
        const label = 1;
        const origin: Point = { x: 500.1, y: 600.9 };
        const typeId = MOCK_MARKING_TYPE_IDS.CORE;
        const ids = ["core-uuid"];

        const mockMarking = new PointMarking(label, origin, typeId, ids);

        const result = mapMinutiaFromFbsToAnsiNist(
            mockMarking,
            1,
            0,
            MOCK_MARKING_TYPES
        );

        expect(result).toBeInstanceOf(CoreMinutia);
        expect(result.minutiaClass).toBe(MINUTIA_CLASS.CORE);
        expect(result.x).toBe(500);
        expect(result.y).toBe(601);
    });

    it("should map to DeltaMinutia class when marking type is 'Delta'", () => {
        const label = 1;
        const origin: Point = { x: 100, y: 200 };
        const typeId = MOCK_MARKING_TYPE_IDS.DELTA;
        const angleRad = 1.5;
        const ids = ["delta-uuid"];

        const mockMarking = new RayMarking(
            label,
            origin,
            typeId,
            angleRad,
            ids
        );

        const result = mapMinutiaFromFbsToAnsiNist(
            mockMarking,
            2,
            0,
            MOCK_MARKING_TYPES
        );

        expect(result).toBeInstanceOf(DeltaMinutia);
        expect(result.minutiaClass).toBe(MINUTIA_CLASS.DELTA);
    });

    it("should map to standard Minutia and resolve proper MinutiaType for Bifurcation", () => {
        const label = 1;
        const origin: Point = { x: 100, y: 100 };
        const typeId = MOCK_MARKING_TYPE_IDS.BIFURCATION;
        const angleRad = 0;
        const ids = ["bif-uuid"];

        const mockMarking = new RayMarking(
            label,
            origin,
            typeId,
            angleRad,
            ids
        );

        const result = mapMinutiaFromFbsToAnsiNist(
            mockMarking,
            99,
            75,
            MOCK_MARKING_TYPES
        );

        expect(result).toBeInstanceOf(Minutia);
        expect(result.minutiaClass).toBe(MINUTIA_CLASS.OTHER);

        const standardMinutia = result as Minutia;
        expect(standardMinutia.id).toBe(99);
        expect(standardMinutia.quality).toBe(75);
        expect(standardMinutia.type).toBe(MinutiaType.RidgeBifurcation);
    });

    it("should map to standard Minutia and resolve proper MinutiaType for RidgeEnding", () => {
        const label = 1;
        const origin: Point = { x: 300, y: 400 };
        const typeId = MOCK_MARKING_TYPE_IDS.RIDGE_ENDING;
        const angleRad = 1.0;
        const ids = ["ending-uuid"];

        const mockMarking = new RayMarking(
            label,
            origin,
            typeId,
            angleRad,
            ids
        );

        const result = mapMinutiaFromFbsToAnsiNist(
            mockMarking,
            105,
            90,
            MOCK_MARKING_TYPES
        );

        expect(result).toBeInstanceOf(Minutia);
        expect(result.minutiaClass).toBe(MINUTIA_CLASS.OTHER);

        const standardMinutia = result as Minutia;
        expect(standardMinutia.type).toBe(MinutiaType.RidgeEnding);
    });

    it("should fallback to MinutiaType.Other if marking type is unrecognized or missing", () => {
        const label = 1;
        const origin: Point = { x: 100, y: 100 };
        const typeId = "non-existent-id";
        const angleRad = 0;
        const ids = ["unknown-uuid"];

        const mockMarking = new RayMarking(
            label,
            origin,
            typeId,
            angleRad,
            ids
        );

        const result = mapMinutiaFromFbsToAnsiNist(
            mockMarking,
            100,
            0,
            MOCK_MARKING_TYPES
        );

        expect(result).toBeInstanceOf(Minutia);
        expect(result.minutiaClass).toBe(MINUTIA_CLASS.OTHER);

        const standardMinutia = result as Minutia;
        expect(standardMinutia.type).toBe(MinutiaType.Other);
    });

    it("should return Minutia with type Other if the marking type exists in store but is unmapped in switch-case", () => {
        const label = 1;
        const origin: Point = { x: 200, y: 200 };
        const typeId = MOCK_MARKING_TYPE_IDS.UNKNOWN;
        const angleRad = 0;
        const ids = ["custom-marking-uuid"];

        const mockMarking = new RayMarking(
            label,
            origin,
            typeId,
            angleRad,
            ids
        );

        const result = mapMinutiaFromFbsToAnsiNist(
            mockMarking,
            200,
            50,
            MOCK_MARKING_TYPES
        );

        expect(result).toBeInstanceOf(Minutia);
        expect(result.minutiaClass).toBe(MINUTIA_CLASS.OTHER);

        const standardMinutia = result as Minutia;
        expect(standardMinutia.type).toBe(MinutiaType.Other);
    });

    it("should fallback to quality 0 if minutiaQuality parameter is omitted", () => {
        const label = 1;
        const origin: Point = { x: 100, y: 100 };
        const typeId = MOCK_MARKING_TYPE_IDS.BIFURCATION;
        const angleRad = 0;
        const ids = ["quality-test-uuid"];

        const mockMarking = new RayMarking(
            label,
            origin,
            typeId,
            angleRad,
            ids
        );

        const result = mapMinutiaFromFbsToAnsiNist(
            mockMarking,
            77,
            undefined,
            MOCK_MARKING_TYPES
        );

        expect(result).toBeInstanceOf(Minutia);
        expect(result.minutiaClass).toBe(MINUTIA_CLASS.OTHER);

        const standardMinutia = result as Minutia;
        expect(standardMinutia.quality).toBe(0);
    });

    /**
     * Mathematical verification using actual dataset coordinates extracted
     * from a sample output json file in FBS format.
     */
    it("should accurately convert app radians to quantized 2-degree Interpol steps", () => {
        const label = 1;
        const origin: Point = { x: 1091.609, y: 1162.838 };
        const typeId = MOCK_MARKING_TYPE_IDS.BIFURCATION;
        const angleRad = 2.802299804385144;
        const ids = ["d294b0ff-0029-4683-9534-da292e84a4cf"];

        const mockMarking = new RayMarking(
            label,
            origin,
            typeId,
            angleRad,
            ids
        );

        const result = mapMinutiaFromFbsToAnsiNist(
            mockMarking,
            1,
            0,
            MOCK_MARKING_TYPES
        );

        expect(result.angle).toBe(55);
    });

    it("should wrap incitsDegrees from 180 to 0 due to the quantization boundary condition", () => {
        const label = 1;
        const origin: Point = { x: 100, y: 100 };
        const typeId = MOCK_MARKING_TYPE_IDS.BIFURCATION;
        // -2.5 * PI after transformation: -(-2.5*PI) - 0.5*PI = 2.0*PI (360 degrees -> divided by 2 = 180)
        const angleRad = -2.5 * Math.PI;
        const ids = ["wrap-angle-uuid"];

        const mockMarking = new RayMarking(
            label,
            origin,
            typeId,
            angleRad,
            ids
        );

        const result = mapMinutiaFromFbsToAnsiNist(
            mockMarking,
            1,
            0,
            MOCK_MARKING_TYPES
        );

        // Must wrap from 180 to 0 according to NIST/INCITS 378 biometric standards
        expect(result.angle).toBe(0);
    });
});
