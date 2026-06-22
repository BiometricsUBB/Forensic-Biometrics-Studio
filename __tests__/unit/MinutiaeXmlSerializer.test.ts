/**
 * @file Unit tests for the MinutiaeXmlSerializer utility.
 * Validates the polymorphic serialization of fingerprint minutiae points into
 * ANSI/NIST-ITL 1-2011 compliant Type-9 PackageMinutiaeRecord XML elements.
 */

import "jest";
import { serializeToType9AnsiRecordXml } from "../../src/lib/ansi-nist-itl/MinutiaeXmlSerializer";
import { Minutia } from "../../src/lib/ansi-nist-itl/Minutia";
import { CoreMinutia } from "../../src/lib/ansi-nist-itl/CoreMinutia";
import { DeltaMinutia } from "../../src/lib/ansi-nist-itl/DeltaMinutia";
import { MinutiaType } from "../../src/lib/ansi-nist-itl/InterpolMinutiaeTypes";
import { MinutiaBase } from "../../src/lib/ansi-nist-itl/MinutiaBase";

const CoreLocationTag = "<biom:FingerprintPatternCoreLocation>";
const DeltaLocationTag = "<biom:FingerprintPatternDeltaLocation>";

/**
 * Test suite focusing on the black-box validation of the XML serialization pipeline.
 * Ensures structural integrity, precise field assignment, and compliance with biometric data boundaries.
 */
describe("MinutiaeXmlSerializer - serializeToType9AnsiRecordXml", () => {
    /**
     * Standard mock Information Designation Character (IDC) used across test records.
     */
    const MOCK_IDC = 7;

    /**
     * @test Structural compliance for boundary edge case of zero inputs.
     */
    it("should generate a valid base Type-9 XML structure when the minutiae array is empty", () => {
        // Arrange
        const emptyList: MinutiaBase[] = [];

        // Act
        const xmlResult = serializeToType9AnsiRecordXml(emptyList, MOCK_IDC);

        // Assert
        expect(xmlResult).toContain("<itl:PackageMinutiaeRecord>");
        expect(xmlResult).toContain(
            "<biom:RecordCategoryCode>9</biom:RecordCategoryCode>"
        );
        expect(xmlResult).toContain(
            `<nc:IdentificationID>${MOCK_IDC}</nc:IdentificationID>`
        );
        expect(xmlResult).toContain(
            "<biom:MinutiaeQuantity>0</biom:MinutiaeQuantity>"
        );
        expect(xmlResult).not.toContain("<biom:INCITSMinutia>");
        expect(xmlResult).not.toContain(CoreLocationTag);
        expect(xmlResult).not.toContain(DeltaLocationTag);
    });

    /**
     * @test Schema validation for standard INCITS minutiae definitions (Field 09.137).
     */
    it("should correctly serialize standard INCITS minutiae and reflect accurate quantity", () => {
        // Arrange
        const m1 = new Minutia(100, 200, 45, 1, MinutiaType.RidgeEnding, 0);
        const m2 = new Minutia(
            150,
            250,
            90,
            2,
            MinutiaType.RidgeBifurcation,
            0
        );

        // Act
        const xmlResult = serializeToType9AnsiRecordXml([m1, m2], MOCK_IDC);

        // Assert
        expect(xmlResult).toContain(
            "<biom:MinutiaeQuantity>2</biom:MinutiaeQuantity>"
        );

        // Verifiy 1st minutia
        expect(xmlResult).toContain(
            "<nc:IdentificationID>1</nc:IdentificationID>"
        );
        expect(xmlResult).toContain(
            "<biom:PositionHorizontalCoordinateValue>100</biom:PositionHorizontalCoordinateValue>"
        );
        expect(xmlResult).toContain(
            "<biom:PositionVerticalCoordinateValue>200</biom:PositionVerticalCoordinateValue>"
        );
        expect(xmlResult).toContain(
            "<biom:ImageLocationThetaAngleMeasure>45</biom:ImageLocationThetaAngleMeasure>"
        );
        expect(xmlResult).toContain(
            `<biom:INCITSMinutiaCategoryCode>${MinutiaType.RidgeEnding}</biom:INCITSMinutiaCategoryCode>`
        );

        // Verifiy 2nd minutia
        expect(xmlResult).toContain(
            "<nc:IdentificationID>2</nc:IdentificationID>"
        );
        expect(xmlResult).toContain(
            "<biom:PositionHorizontalCoordinateValue>150</biom:PositionHorizontalCoordinateValue>"
        );
        expect(xmlResult).toContain(
            "<biom:PositionVerticalCoordinateValue>250</biom:PositionVerticalCoordinateValue>"
        );
        expect(xmlResult).toContain(
            "<biom:ImageLocationThetaAngleMeasure>90</biom:ImageLocationThetaAngleMeasure>"
        );
        expect(xmlResult).toContain(
            `<biom:INCITSMinutiaCategoryCode>${MinutiaType.RidgeBifurcation}</biom:INCITSMinutiaCategoryCode>`
        );
    });

    /**
     * @test Schema validation for Core coordinate points (Field 09.139).
     */
    it("should correctly serialize Core locations", () => {
        // Arrange
        const core = new CoreMinutia(500, 600, 120);

        // Act
        const xmlResult = serializeToType9AnsiRecordXml([core], MOCK_IDC);

        // Assert
        expect(xmlResult).toContain(CoreLocationTag);
        expect(xmlResult).toContain(
            "<biom:PositionHorizontalCoordinateValue>500</biom:PositionHorizontalCoordinateValue>"
        );
        expect(xmlResult).toContain(
            "<biom:PositionVerticalCoordinateValue>600</biom:PositionVerticalCoordinateValue>"
        );
        expect(xmlResult).toContain(
            "<biom:ImageLocationThetaAngleMeasure>120</biom:ImageLocationThetaAngleMeasure>"
        );
    });

    /**
     * @test Verification of single-angle default behavior for Delta structures (Field 09.140).
     */
    it("should serialize Delta location with only the primary angle when secondary angles are missing", () => {
        // Arrange
        const delta = new DeltaMinutia(800, 900, 30);

        // Act
        const xmlResult = serializeToType9AnsiRecordXml([delta], MOCK_IDC);

        // Assert
        expect(xmlResult).toContain(DeltaLocationTag);
        expect(xmlResult).toContain(
            "<biom:PositionHorizontalCoordinateValue>800</biom:PositionHorizontalCoordinateValue>"
        );
        // Assert that exactly one angle tag is present
        const angleTagCount = (
            xmlResult.match(
                /<biom:ImageLocationThetaAngleMeasure>30<\/biom:ImageLocationThetaAngleMeasure>/g
            ) || []
        ).length;
        expect(angleTagCount).toBe(1);
    });

    /**
     * @test Evaluation of conditional multi-angle data injection for standard up-to-three-angle Delta blocks.
     */
    it("should dynamically serialize Delta location with multiple angles (secondary and tertiary)", () => {
        // Arrange
        const delta = new DeltaMinutia(850, 950, 30);
        delta.secondAngle = 75;
        delta.thirdAngle = 150;

        // Act
        const xmlResult = serializeToType9AnsiRecordXml([delta], MOCK_IDC);

        // Assert
        expect(xmlResult).toContain(DeltaLocationTag);
        expect(xmlResult).toContain(
            "<biom:ImageLocationThetaAngleMeasure>30</biom:ImageLocationThetaAngleMeasure>"
        );
        expect(xmlResult).toContain(
            "<biom:ImageLocationThetaAngleMeasure>75</biom:ImageLocationThetaAngleMeasure>"
        );
        expect(xmlResult).toContain(
            "<biom:ImageLocationThetaAngleMeasure>150</biom:ImageLocationThetaAngleMeasure>"
        );
    });

    /**
     * @test Output layout validation ensuring strings are line-broken for optimal downstream parsing readability.
     */
    it("should separate multiple elements with newlines for human-readable formatting", () => {
        // Arrange
        const m1 = new Minutia(100, 200, 45, 1, MinutiaType.RidgeEnding, 0);
        const m2 = new Minutia(
            150,
            250,
            90,
            2,
            MinutiaType.RidgeBifurcation,
            0
        );

        // Act
        const xmlResult = serializeToType9AnsiRecordXml([m1, m2], MOCK_IDC);

        // Assert
        expect(xmlResult).toContain(
            "</biom:INCITSMinutia>\n      <biom:INCITSMinutia>"
        );
    });

    /**
     * @test Polymorphic collection routing. Confirms the array filters divide and process
     * distinct subclasses accurately even when merged inside a single input array.
     */
    it("should correctly handle a mixed array containing all minutiae classes simultaneously", () => {
        // Arrange
        const m = new Minutia(100, 100, 10, 1, MinutiaType.RidgeEnding, 0);
        const c = new CoreMinutia(200, 200, 20);
        const d = new DeltaMinutia(300, 300, 30);

        // Act
        const xmlResult = serializeToType9AnsiRecordXml([m, c, d], MOCK_IDC);

        // Assert
        expect(xmlResult).toContain(
            "<biom:MinutiaeQuantity>1</biom:MinutiaeQuantity>"
        );
        expect(xmlResult).toContain("<biom:INCITSMinutia>");
        expect(xmlResult).toContain(CoreLocationTag);
        expect(xmlResult).toContain(DeltaLocationTag);
    });
});
