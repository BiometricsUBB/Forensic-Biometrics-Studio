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
import { wsqToPNG } from "@li0ard/wsq";
import { loadImage } from "./loadImage";
import { createMinutiaMarking } from "./ansiNistHelper";

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
            t(
                "XML file is corrupt or has an invalid format. Rejected by parser.",
                { ns: "dialog" }
            )
        );
    }

    const b64Text = getElementText(xmlDoc, "BinaryBase64Object");
    let imageLoaded = false;

    if (b64Text) {
        let imageBytes = base64ToUint8Array(b64Text.trim());
        // Detect WSQ magic number (SOI is FF A0)
        if (
            imageBytes.length > 2 &&
            imageBytes[0] === 0xff &&
            imageBytes[1] === 0xa0
        ) {
            imageBytes = wsqToPNG(imageBytes);
        }
        await loadImage(imageBytes, viewport, "ANSI_Image");
        imageLoaded = true;
    }

    const minutiaeNodes = [
        ...Array.from(xmlDoc.getElementsByTagNameNS("*", "MinutiaeFeature")),
        ...Array.from(xmlDoc.getElementsByTagNameNS("*", "EFSMinutia")),
        ...Array.from(xmlDoc.getElementsByTagNameNS("*", "INCITSMinutia")),
    ];

    if (minutiaeNodes.length === 0 && !imageLoaded) {
        throw new Error(
            t(
                "No usable biometric data found in the file (neither supported image nor minutiae).",
                { ns: "dialog" }
            )
        );
    }

    if (minutiaeNodes.length === 0 && imageLoaded) {
        await message(
            t(
                "Loaded image from file, but it did not contain any saved minutiae.",
                { ns: "dialog" }
            ),
            {
                title: t("File info", { ns: "dialog" }),
                kind: "info",
            }
        );
    } else if (minutiaeNodes.length > 0 && !imageLoaded) {
        await message(
            t(
                "Loaded minutiae, but the file did not contain an image (or the image format is not supported).",
                { ns: "dialog" }
            ),
            {
                title: t("File info", { ns: "dialog" }),
                kind: "warning",
            }
        );
    }

    if (minutiaeNodes.length > 0) {
        const importedMarkings = minutiaeNodes
            .map((node, index) => {
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
                    getElementText(node, "INCITSMinutiaCategoryCode") ||
                    undefined;

                const x = xText ? parseInt(xText, 10) : 0;
                const y = yText ? parseInt(yText, 10) : 0;
                const angleDeg = dirText ? parseFloat(dirText) : 0;

                return createMinutiaMarking(
                    index + 1,
                    x,
                    y,
                    angleDeg,
                    typeText
                );
            })
            .filter((m): m is RayMarking => m !== null);

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
