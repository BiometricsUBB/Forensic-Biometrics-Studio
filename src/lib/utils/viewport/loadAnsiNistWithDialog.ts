import { CanvasMetadata } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { showErrorDialog } from "@/lib/errors/showErrorDialog";
import { MarkingsStore } from "@/lib/stores/Markings";
import {
    open as openFileSelectionDialog,
    message,
} from "@tauri-apps/plugin-dialog";
import { t } from "i18next";
import { Viewport } from "pixi-viewport";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { RayMarking } from "@/lib/markings/RayMarking";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { Point } from "@/lib/markings/Point";
import { wsqToPNG } from "@li0ard/wsq";
import { resolveSourceafisTypeId } from "./autoMarkWithSourceafis";
import { loadImage } from "./loadImage";

function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) {
        // eslint-disable-next-line security/detect-object-injection
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function getElementText(
    doc: Element | Document,
    localName: string
): string | null {
    const el = doc.getElementsByTagNameNS("*", localName)[0];
    if (el) return el.textContent;

    // Fallback if namespaces are ignored by DOMParser
    const els = doc.getElementsByTagName(localName);
    if (els.length > 0) return els[0]?.textContent ?? null;

    const elsNs = doc.getElementsByTagName(`biom:${localName}`);
    if (elsNs.length > 0) return elsNs[0]?.textContent ?? null;

    const elsNc = doc.getElementsByTagName(`nc:${localName}`);
    if (elsNc.length > 0) return elsNc[0]?.textContent ?? null;

    return null;
}

export async function loadAnsiNist(filePath: string, viewport: Viewport) {
    const canvasId = viewport.name as CanvasMetadata["id"] | null;
    if (canvasId === null) {
        throw new Error(`Canvas ID not found`);
    }

    const xmlText = await readTextFile(filePath);
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");

    const parseError = xmlDoc.querySelector("parsererror");
    if (parseError) {
        throw new Error(
            "Wybrany plik XML jest uszkodzony lub ma nieprawidłowy format. Został odrzucony przez parser."
        );
    }

    const b64Text = getElementText(xmlDoc, "BinaryBase64Object");
    let imageLoaded = false;

    if (b64Text) {
        let imageBytes = base64ToUint8Array(b64Text.trim());
        // Detect WSQ magic number: FF A0 FF A8
        if (
            imageBytes.length > 4 &&
            imageBytes[0] === 0xff &&
            imageBytes[1] === 0xa0 &&
            imageBytes[2] === 0xff &&
            imageBytes[3] === 0xa8
        ) {
            imageBytes = wsqToPNG(imageBytes);
        }
        await loadImage(imageBytes, viewport, "ANSI_Image");
        imageLoaded = true;
    }

    const minutiaeNodes = [
        ...Array.from(xmlDoc.getElementsByTagNameNS("*", "MinutiaeFeature")),
        ...Array.from(xmlDoc.getElementsByTagName("biom:MinutiaeFeature")),
        ...Array.from(xmlDoc.getElementsByTagName("MinutiaeFeature")),
        ...Array.from(xmlDoc.getElementsByTagNameNS("*", "EFSMinutia")),
        ...Array.from(xmlDoc.getElementsByTagName("biom:EFSMinutia")),
        ...Array.from(xmlDoc.getElementsByTagName("EFSMinutia")),
        ...Array.from(xmlDoc.getElementsByTagNameNS("*", "INCITSMinutia")),
        ...Array.from(xmlDoc.getElementsByTagName("biom:INCITSMinutia")),
        ...Array.from(xmlDoc.getElementsByTagName("INCITSMinutia")),
    ];

    if (minutiaeNodes.length === 0 && !imageLoaded) {
        throw new Error(
            "W pliku nie znaleziono żadnych użytecznych danych biometrycznych (ani obsługiwanego obrazu, ani minucji). Możliwe, że jest to plik zawierający wyłącznie dane tekstowe."
        );
    }

    if (minutiaeNodes.length === 0 && imageLoaded) {
        await message(
            "Wczytano obraz z pliku, ale nie zawierał on żadnych zapisanych minucji (brak rekordu Type-9).",
            { title: "Informacja o pliku", kind: "info" }
        );
    } else if (minutiaeNodes.length > 0 && !imageLoaded) {
        await message(
            "Wczytano minucje, ale plik nie zawierał obrazu (lub format obrazu nie jest obsługiwany).",
            { title: "Informacja o pliku", kind: "warning" }
        );
    }

    if (minutiaeNodes.length > 0) {
        // remove duplicates
        const uniqueNodes = Array.from(new Set(minutiaeNodes));

        const importedMarkings = uniqueNodes.map((node, index) => {
            const xText =
                getElementText(node, "MinutiaeXCoordinate") ||
                getElementText(
                    node,
                    "ImageLocationHorizontalCoordinateMeasure"
                ) ||
                getElementText(node, "PositionHorizontalCoordinateValue");
            const yText =
                getElementText(node, "MinutiaeYCoordinate") ||
                getElementText(
                    node,
                    "ImageLocationVerticalCoordinateMeasure"
                ) ||
                getElementText(node, "PositionVerticalCoordinateValue");
            const dirText =
                getElementText(node, "MinutiaeDirectionAngleMeasure") ||
                getElementText(node, "ImageLocationThetaAngleMeasure") ||
                "0";
            const typeText =
                getElementText(node, "MinutiaeCategoryCode") ||
                getElementText(node, "EFSMinutiaCategoryCode") ||
                getElementText(node, "INCITSMinutiaCategoryCode");

            const x = xText ? parseInt(xText, 10) : 0;
            const y = yText ? parseInt(yText, 10) : 0;
            const angleDeg = dirText ? parseFloat(dirText) : 0;
            const angleRad = (angleDeg - 90) * (Math.PI / 180);

            let typeStr = "ending";
            if (typeText && typeText.includes("BIF")) typeStr = "bifurcation";

            const typeId =
                resolveSourceafisTypeId(typeStr) ||
                MarkingTypesStore.state.types[0]?.id ||
                "unknown-type-id";

            return new RayMarking(
                index + 1,
                { x, y } as Point,
                typeId,
                angleRad,
                []
            );
        });

        MarkingsStore(canvasId).actions.markings.addManyForLoading(
            importedMarkings
        );
    }
}

export async function loadAnsiNistWithDialog(viewport: Viewport) {
    try {
        const filePath = await openFileSelectionDialog({
            title: t("Load ANSI/NIST (XML) data", { ns: "tooltip" }),
            filters: [{ name: "ANSI/NIST XML", extensions: ["xml"] }],
            directory: false,
            canCreateDirectories: false,
            multiple: false,
        });

        if (filePath === null) return;
        await loadAnsiNist(filePath, viewport);
    } catch (error) {
        showErrorDialog(error);
    }
}
