import { CanvasMetadata } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { showErrorDialog } from "@/lib/errors/showErrorDialog";
import { MarkingsStore } from "@/lib/stores/Markings";
import { save as saveFileSelectionDialog } from "@tauri-apps/plugin-dialog";
import { t } from "i18next";
import { Viewport } from "pixi-viewport";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { Sprite } from "pixi.js";
import { RayMarking } from "@/lib/markings/RayMarking";
import { MARKING_CLASS } from "@/lib/markings/MARKING_CLASS";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";

function getBase64FromSprite(sprite: Sprite): string | null {
    try {
        const canvas = document.createElement("canvas");
        canvas.width = sprite.texture.width;
        canvas.height = sprite.texture.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        // @ts-expect-error resource source might be an ImageBitmap or HTMLImageElement
        const { source } = sprite.texture.baseTexture.resource;
        if (source) {
            ctx.drawImage(source, 0, 0);
            return canvas.toDataURL("image/jpeg").split(",")[1] ?? null;
        }
        return null;
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Failed to extract base64 from sprite", e);
        return null;
    }
}

export async function saveAnsiNist(filePath: string, viewport: Viewport) {
    const canvasId = viewport.name as CanvasMetadata["id"] | null;
    if (canvasId === null) {
        throw new Error(`Canvas ID not found`);
    }

    const sprite = viewport.children.find(x => x instanceof Sprite) as
        | Sprite
        | undefined;
    const base64Image = sprite ? getBase64FromSprite(sprite) : "";

    const { markings } = MarkingsStore(canvasId).state;

    // We filter for minutiae (RayMarkings) since Type-9 is primarily minutiae
    const minutiae = markings.filter(
        m => m.markingClass === MARKING_CLASS.RAY
    ) as RayMarking[];

    const existingTypes = MarkingTypesStore.state.types;

    const minutiaeXml = minutiae
        .map((m, idx) => {
            // Normalize angle to degrees
            const angleDeg = m.angleRad * (180 / Math.PI) + 90;
            const typeInfo = existingTypes.find(t => t.id === m.typeId);
            let categoryCode = "UNK";
            if (typeInfo) {
                const name = typeInfo.name.toLowerCase();
                if (name.includes("end")) categoryCode = "END";
                if (name.includes("bif")) categoryCode = "BIF";
            }

            return `
            <biom:MinutiaeFeature>
                <biom:MinutiaeID>${idx + 1}</biom:MinutiaeID>
                <biom:MinutiaeXCoordinate>${Math.round(m.origin.x)}</biom:MinutiaeXCoordinate>
                <biom:MinutiaeYCoordinate>${Math.round(m.origin.y)}</biom:MinutiaeYCoordinate>
                <biom:MinutiaeDirectionAngleMeasure>${Math.round(angleDeg)}</biom:MinutiaeDirectionAngleMeasure>
                <biom:MinutiaeCategoryCode>${categoryCode}</biom:MinutiaeCategoryCode>
            </biom:MinutiaeFeature>
        `;
        })
        .join("");

    const currentDate = new Date().toISOString().split("T")[0];
    const currentDateTime = new Date().toISOString();

    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<itl:NISTBiometricInformationExchangePackage
    xmlns:itl="http://biometrics.nist.gov/standard/2011"
    xmlns:biom="http://niem.gov/niem/biometrics/1.0"
    xmlns:nc="http://niem.gov/niem/niem-core/2.0">
    <itl:PackageInformationRecord>
        <biom:RecordCategoryCode>1</biom:RecordCategoryCode>
        <biom:Transaction>
            <biom:TransactionDate><nc:Date>${currentDate}</nc:Date></biom:TransactionDate>
            <biom:TransactionUTCDate><nc:DateTime>${currentDateTime}</nc:DateTime></biom:TransactionUTCDate>
        </biom:Transaction>
    </itl:PackageInformationRecord>
    
    <itl:PackageMinutiaeRecord>
        <biom:RecordCategoryCode>9</biom:RecordCategoryCode>
        <biom:ImageReferenceIdentification>
            <nc:IdentificationID>1</nc:IdentificationID>
        </biom:ImageReferenceIdentification>
        <biom:FrictionRidgeDetail>
            ${minutiaeXml}
        </biom:FrictionRidgeDetail>
    </itl:PackageMinutiaeRecord>

    ${
        base64Image
            ? `
    <itl:PackageLatentFrictionRidgeImageRecord>
        <biom:RecordCategoryCode>13</biom:RecordCategoryCode>
        <biom:ImageReferenceIdentification>
            <nc:IdentificationID>1</nc:IdentificationID>
        </biom:ImageReferenceIdentification>
        <biom:FrictionRidgeImage>
            <nc:BinaryBase64Object>${base64Image}</nc:BinaryBase64Object>
        </biom:FrictionRidgeImage>
    </itl:PackageLatentFrictionRidgeImageRecord>
    `
            : ""
    }
</itl:NISTBiometricInformationExchangePackage>`;

    await writeTextFile(filePath, xmlContent);
}

export async function saveAnsiNistWithDialog(viewport: Viewport) {
    try {
        const filePath = await saveFileSelectionDialog({
            title: t("Save ANSI/NIST (XML) data", { ns: "tooltip" }),
            filters: [{ name: "ANSI/NIST XML", extensions: ["xml"] }],
        });

        if (filePath === null) return;
        await saveAnsiNist(filePath, viewport);
    } catch (error) {
        showErrorDialog(error);
    }
}
