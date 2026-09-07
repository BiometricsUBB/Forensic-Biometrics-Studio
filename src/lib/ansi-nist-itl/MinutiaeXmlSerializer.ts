/**
 * @file XML serialization utility for fingerprint minutiae data conforming to the
 * "ANSI/NIST-ITL 1-2011: UPDATE 2015" standard (specifically Type-9 PackageMinutiaeRecord).
 */

import { DeltaMinutia } from "./DeltaMinutia";
import { CoreMinutia } from "./CoreMinutia";
import { Minutia } from "./Minutia";
import { MINUTIA_CLASS, MinutiaBase } from "./MinutiaBase";

/**
 * Serializes a standard minutia point into an ANSI/NIST-ITL `<biom:INCITSMinutia>` structure.
 * Matches standard fields for fingerprint ridge endings, bifurcations, or unspecified types.
 *
 * @param otherMinutia - The source standard minutia instance containing position, type, and quality.
 * @returns Formatted XML segment representing a single INCITS minutia node.
 */
function serializeStandardMinutia(otherMinutia: Minutia): string {
    return `      <biom:INCITSMinutia>
        <biom:MinutiaIdentification>
          <nc:IdentificationID>${otherMinutia.id}</nc:IdentificationID>
        </biom:MinutiaIdentification>
        <biom:INCITSMinutiaLocation>
          <biom:PositionHorizontalCoordinateValue>${otherMinutia.x}</biom:PositionHorizontalCoordinateValue>
          <biom:PositionVerticalCoordinateValue>${otherMinutia.y}</biom:PositionVerticalCoordinateValue>
          <biom:ImageLocationThetaAngleMeasure>${otherMinutia.angle}</biom:ImageLocationThetaAngleMeasure>
        </biom:INCITSMinutiaLocation>
        <biom:INCITSMinutiaCategoryCode>${otherMinutia.type}</biom:INCITSMinutiaCategoryCode>
        <biom:MinutiaQualityValue>${otherMinutia.quality}</biom:MinutiaQualityValue>
      </biom:INCITSMinutia>`;
}

/**
 * Serializes a core point location into an ANSI/NIST-ITL `<biom:FingerprintPatternCoreLocation>` structure.
 * Corresponds to biometric Field 09.139 (CORE).
 *
 * @param coreMinutia - The source core point instance containing coordinate positions and orientation angle.
 * @returns Formatted XML segment representing a single core location node.
 */
function serializeCoreLocation(coreMinutia: CoreMinutia): string {
    return `<biom:FingerprintPatternCoreLocation>
      <biom:PositionHorizontalCoordinateValue>${coreMinutia.x}</biom:PositionHorizontalCoordinateValue>
      <biom:PositionVerticalCoordinateValue>${coreMinutia.y}</biom:PositionVerticalCoordinateValue>
      <biom:ImageLocationThetaAngleMeasure>${coreMinutia.angle}</biom:ImageLocationThetaAngleMeasure>
    </biom:FingerprintPatternCoreLocation>`;
}

/**
 * Serializes a delta point location into an ANSI/NIST-ITL `<biom:FingerprintPatternDeltaLocation>` structure.
 * Dynamically handles up to three standardized orientation angles (Field 09.140 / 09.141).
 *
 * @param deltaMinutia - The source delta point instance supporting primary, secondary, and tertiary angles.
 * @returns Formatted XML segment representing a single delta location node.
 */
function serializeDeltaLocation(deltaMinutia: DeltaMinutia): string {
    let anglesXml = `      <biom:ImageLocationThetaAngleMeasure>${deltaMinutia.angle}</biom:ImageLocationThetaAngleMeasure>`;

    if (deltaMinutia.secondAngle !== undefined) {
        anglesXml += `\n      <biom:ImageLocationThetaAngleMeasure>${deltaMinutia.secondAngle}</biom:ImageLocationThetaAngleMeasure>`;
    }
    if (deltaMinutia.thirdAngle !== undefined) {
        anglesXml += `\n      <biom:ImageLocationThetaAngleMeasure>${deltaMinutia.thirdAngle}</biom:ImageLocationThetaAngleMeasure>`;
    }

    return `    <biom:FingerprintPatternDeltaLocation>
      <biom:PositionHorizontalCoordinateValue>${deltaMinutia.x}</biom:PositionHorizontalCoordinateValue>
      <biom:PositionVerticalCoordinateValue>${deltaMinutia.y}</biom:PositionVerticalCoordinateValue>
${anglesXml}
    </biom:FingerprintPatternDeltaLocation>`;
}

/**
 * Generates a complete Type-9 PackageMinutiaeRecord XML block from an array of polymorphic minutiae.
 * Automatically filters and groups minutiae into standard INCITS, Core, and Delta representations.
 *
 * @param minutiae - Array of fingerprint minutiae points extending {@link MinutiaBase}.
 * @param idc - Information Designation Character ID to link with the logical record (Field 09.002).
 * @returns A formatted XML string containing the Type-9 package record structure.
 */
export function serializeToType9AnsiRecordXml(
    minutiae: MinutiaBase[],
    idc: number
): string {
    const otherMinutiae = minutiae.filter(
        m => m.minutiaClass === MINUTIA_CLASS.OTHER
    ) as Minutia[];
    const coreMinutiae = minutiae.filter(
        m => m.minutiaClass === MINUTIA_CLASS.CORE
    ) as CoreMinutia[];
    const deltaMinutiae = minutiae.filter(
        m => m.minutiaClass === MINUTIA_CLASS.DELTA
    ) as DeltaMinutia[];

    // Map sub-components to formatted strings with clean line breaks
    const otherXml = otherMinutiae
        .map(m => serializeStandardMinutia(m))
        .join("\n");
    const coreXml = coreMinutiae.map(m => serializeCoreLocation(m)).join("\n");
    const deltaXml = deltaMinutiae
        .map(m => serializeDeltaLocation(m))
        .join("\n");

    return `<itl:PackageMinutiaeRecord>
    <biom:RecordCategoryCode>9</biom:RecordCategoryCode>
    <biom:ImageReferenceIdentification>
      <nc:IdentificationID>${idc}</nc:IdentificationID>
    </biom:ImageReferenceIdentification>
    <biom:MinutiaeImpressionCaptureCategoryCode>4</biom:MinutiaeImpressionCaptureCategoryCode>
    <biom:MinutiaeFormatNISTStandardIndicator>false</biom:MinutiaeFormatNISTStandardIndicator>
    <biom:INCITSMinutiae>
      <biom:MinutiaeQuantity>${otherMinutiae.length}</biom:MinutiaeQuantity>${otherXml ? `\n${otherXml}` : ""}
    </biom:INCITSMinutiae>
    ${coreXml ? `${coreXml}` : ""}${deltaXml ? `\n${deltaXml}` : ""}
  </itl:PackageMinutiaeRecord>`;
}
