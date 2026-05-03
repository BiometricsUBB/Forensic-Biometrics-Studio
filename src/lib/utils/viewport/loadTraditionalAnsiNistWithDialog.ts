import { CanvasMetadata } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { showErrorDialog } from "@/lib/errors/showErrorDialog";
import { MarkingsStore } from "@/lib/stores/Markings";
import {
    open as openFileSelectionDialog,
    message,
} from "@tauri-apps/plugin-dialog";
import { t } from "i18next";
import { Viewport } from "pixi-viewport";
import { readFile } from "@tauri-apps/plugin-fs";
import { RayMarking } from "@/lib/markings/RayMarking";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { Point } from "@/lib/markings/Point";
import { wsqToPNG } from "@li0ard/wsq";
import { resolveSourceafisTypeId } from "./autoMarkWithSourceafis";
import { loadImage } from "./loadImage";

interface AnsiRecord {
    type: number;
    fields: Map<number, Uint8Array>;
}

/**
 * Parses fields within a record buffer.
 */
function parseFields(recordBuf: Uint8Array): Map<number, Uint8Array> {
    const fields = new Map<number, Uint8Array>();
    const GS = 0x1d;
    const COLON = 0x3a;
    let fieldStart = 0;

    while (fieldStart < recordBuf.length) {
        const colonIdx = recordBuf.indexOf(COLON, fieldStart);
        if (colonIdx === -1) break;

        const tag = new TextDecoder().decode(
            recordBuf.slice(fieldStart, colonIdx)
        );
        const parts = tag.split(".");
        const fNum = parseInt(parts[1]!, 10);

        if (fNum === 999) {
            fields.set(fNum, recordBuf.slice(colonIdx + 1));
            break;
        }

        let fieldEnd = recordBuf.indexOf(GS, colonIdx);
        if (fieldEnd === -1) fieldEnd = recordBuf.length;

        fields.set(fNum, recordBuf.slice(colonIdx + 1, fieldEnd));
        fieldStart = fieldEnd + 1;
    }
    return fields;
}

/**
 * Detects record length and type from current position
 */
function getRecordInfo(
    buffer: Uint8Array,
    pos: number
): { len: number; rType: number; isTagValue: boolean } {
    const COLON = 0x3a;
    const GS = 0x1d;
    const colonIdx = buffer.indexOf(COLON, pos);

    // Check for Tag:Value (e.g. "1.001:")
    if (colonIdx !== -1 && colonIdx - pos < 15) {
        const gsIdx = buffer.indexOf(GS, colonIdx);
        if (gsIdx !== -1) {
            const lenStr = new TextDecoder().decode(
                buffer.slice(colonIdx + 1, gsIdx)
            );
            const firstTag = new TextDecoder().decode(
                buffer.slice(pos, colonIdx)
            );
            return {
                len: parseInt(lenStr, 10),
                rType: parseInt(firstTag.split(".")[0]!, 10),
                isTagValue: true,
            };
        }
    }

    // Check for Type-4 (Fixed Binary Header)
    if (pos + 4 <= buffer.length) {
        // Multiplier math to avoid bitwise linter errors
        // eslint-disable-next-line security/detect-object-injection
        const len =
            buffer[pos]! * 16777216 +
            buffer[pos + 1]! * 65536 +
            buffer[pos + 2]! * 256 +
            buffer[pos + 3]!;
        return { len, rType: 4, isTagValue: false };
    }

    return { len: 0, rType: -1, isTagValue: false };
}

/**
 * Parses traditional binary ANSI/NIST.
 * Supports both Tag:Value records and old Type-4 binary records.
 */
function parseTraditional(buffer: Uint8Array): AnsiRecord[] {
    const records: AnsiRecord[] = [];
    let pos = 0;

    while (pos < buffer.length) {
        const { len, rType, isTagValue } = getRecordInfo(buffer, pos);
        if (len <= 0 || pos + len > buffer.length) break;

        const recordBuf = buffer.slice(pos, pos + len);
        if (isTagValue) {
            records.push({ type: rType, fields: parseFields(recordBuf) });
        } else if (rType === 4) {
            const fields = new Map<number, Uint8Array>();
            fields.set(6, recordBuf.slice(13, 15)); // HLL
            fields.set(7, recordBuf.slice(15, 17)); // VLL
            fields.set(9, recordBuf.slice(17, 18)); // CA
            fields.set(999, recordBuf.slice(18)); // Image Data
            records.push({ type: 4, fields });
        }
        pos += len;
    }
    return records;
}

/**
 * Converts raw grayscale bytes to a PNG Uint8Array using Canvas
 */
async function rawGrayscaleToPNG(
    raw: Uint8Array,
    width: number,
    height: number
): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            reject(new Error("Canvas context failed"));
            return;
        }
        const imgData = ctx.createImageData(width, height);
        for (let i = 0; i < raw.length && i < width * height; i += 1) {
            // eslint-disable-next-line security/detect-object-injection
            const val = raw[i]!;
            const idx = i * 4;
            // eslint-disable-next-line security/detect-object-injection
            imgData.data[idx] = val;
            // eslint-disable-next-line security/detect-object-injection
            imgData.data[idx + 1] = val;
            // eslint-disable-next-line security/detect-object-injection
            imgData.data[idx + 2] = val;
            // eslint-disable-next-line security/detect-object-injection
            imgData.data[idx + 3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);
        canvas.toBlob(blob => {
            if (!blob) {
                reject(new Error("Blob conversion failed"));
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () =>
                resolve(new Uint8Array(reader.result as ArrayBuffer));
            reader.readAsArrayBuffer(blob);
        }, "image/png");
    });
}

/**
 * Extracts width and height for raw grayscale
 */
function getRawDimensions(record: AnsiRecord): { w: number; h: number } {
    if (record.type === 4) {
        // eslint-disable-next-line security/detect-object-injection
        const hll = record.fields.get(6);
        // eslint-disable-next-line security/detect-object-injection
        const vll = record.fields.get(7);
        const w = hll ? hll[0]! * 256 + hll[1]! : 0;
        const h = vll ? vll[0]! * 256 + vll[1]! : 0;
        return { w, h };
    }
    const decoder = new TextDecoder();
    const wStr = record.fields.get(6)
        ? decoder.decode(record.fields.get(6))
        : "0";
    const hStr = record.fields.get(7)
        ? decoder.decode(record.fields.get(7))
        : "0";
    return { w: parseInt(wStr, 10), h: parseInt(hStr, 10) };
}

/**
 * Processes image record (Type-4, 13, 14)
 */
async function processImage(
    record: AnsiRecord,
    viewport: Viewport
): Promise<boolean> {
    const data = record.fields.get(999);
    if (!data) return false;

    const comp = record.fields.get(9);
    const compStr = comp ? new TextDecoder().decode(comp).trim() : "0";
    let finalBytes = data;

    const isWSQ =
        compStr === "1" ||
        (comp && record.type === 4 && comp[0] === 1) ||
        (data[0] === 0xff && data[1] === 0xa0);

    if (isWSQ) {
        finalBytes = wsqToPNG(data);
    } else if (compStr === "0" || compStr === "197" || record.type === 4) {
        const { w, h } = getRawDimensions(record);
        if (w > 0 && h > 0) finalBytes = await rawGrayscaleToPNG(data, w, h);
    }

    await loadImage(finalBytes, viewport, `ANSI_Type${record.type}`);
    return true;
}

/**
 * Processes minutiae record (Type-9)
 */
function processMinutiae(record: AnsiRecord, canvasId: string): boolean {
    const field = record.fields.get(137) || record.fields.get(126);
    if (!field) return false;

    const text = new TextDecoder().decode(field);
    const markings = text
        .split("\x1e")
        .map((sf, idx) => {
            const items = sf
                .trim()
                .replace(new RegExp(String.fromCharCode(0x1f), "g"), " ")
                .split(/\s+/);
            if (items.length < 4) return null;

            const x = parseInt(items[1]!, 10);
            const y = parseInt(items[2]!, 10);
            const angleDeg = parseFloat(items[3]!);
            const typeStr =
                items[4] === "1" || (items[4] && items[4].includes("BIF"))
                    ? "bifurcation"
                    : "ending";

            const typeId =
                resolveSourceafisTypeId(typeStr) ||
                MarkingTypesStore.state.types[0]?.id ||
                "unknown";
            const angleRad = (angleDeg - 90) * (Math.PI / 180);

            return new RayMarking(
                idx + 1,
                { x, y } as Point,
                typeId,
                angleRad,
                []
            );
        })
        .filter((m): m is RayMarking => m !== null);

    if (markings.length > 0) {
        MarkingsStore(
            canvasId as CanvasMetadata["id"]
        ).actions.markings.addManyForLoading(markings);
        return true;
    }
    return false;
}

export async function loadTraditionalAnsiNist(
    filePath: string,
    viewport: Viewport
) {
    const canvasId = viewport.name as CanvasMetadata["id"] | null;
    if (canvasId === null) throw new Error("Canvas ID not found");

    const buffer = await readFile(filePath);
    const records = parseTraditional(buffer);

    const imgRec = records.find(
        r => r.type === 14 || r.type === 13 || r.type === 4
    );
    const imageLoaded = imgRec ? await processImage(imgRec, viewport) : false;

    const minRec = records.find(r => r.type === 9);
    const minutiaeFound = minRec ? processMinutiae(minRec, canvasId) : false;

    if (!imageLoaded && !minutiaeFound)
        throw new Error("Brak danych biometrycznych.");

    if (imageLoaded && !minutiaeFound) {
        await message("Wczytano obraz, brak minucji.", {
            title: "Info",
            kind: "info",
        });
    } else if (!imageLoaded && minutiaeFound) {
        await message("Wczytano minucje, brak obrazu.", {
            title: "Warning",
            kind: "warning",
        });
    }
}

export async function loadTraditionalAnsiNistWithDialog(viewport: Viewport) {
    try {
        const filePath = await openFileSelectionDialog({
            title: t("Load Traditional ANSI/NIST (.an2, .eft)", {
                ns: "tooltip",
            }),
            filters: [
                {
                    name: "Traditional ANSI/NIST",
                    extensions: ["an2", "eft", "ebts", "nist"],
                },
            ],
            multiple: false,
        });

        if (filePath) await loadTraditionalAnsiNist(filePath, viewport);
    } catch (error) {
        showErrorDialog(error);
    }
}
