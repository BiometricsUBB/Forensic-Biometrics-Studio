import { MarkingClass } from "@/lib/markings/MarkingClass";
import SparkMD5 from "spark-md5";

export type MatchedFeature = {
    id: string;
    left: MarkingClass;
    right: MarkingClass;
};

export const getMatchedFeatures = (
    left: MarkingClass[],
    right: MarkingClass[]
) => {
    const rightById = new Map<string, MarkingClass>();
    right.forEach(marking => {
        marking.ids?.forEach(id => rightById.set(id, marking));
    });

    const pairs = new Map<string, MatchedFeature>();
    left.forEach(marking => {
        marking.ids?.forEach(id => {
            const rightMarking = rightById.get(id);
            if (!rightMarking) return;
            const pairKey = `${marking.label}:${rightMarking.label}`;
            if (!pairs.has(pairKey)) {
                pairs.set(pairKey, { id, left: marking, right: rightMarking });
            }
        });
    });

    return Array.from(pairs.values()).sort(
        (a, b) => a.left.label - b.left.label
    );
};

export const MAX_REPORT_FEATURES = 24;

export const getPairedByLabel = (
    left: MarkingClass[],
    right: MarkingClass[]
) => {
    const rightByLabel = new Map<number, MarkingClass>();
    right.forEach(marking => rightByLabel.set(marking.label, marking));
    const pairs: MatchedFeature[] = [];
    left.forEach(marking => {
        const rightMarking = rightByLabel.get(marking.label);
        if (rightMarking) {
            pairs.push({
                id: marking.ids?.[0] ?? crypto.randomUUID(),
                left: marking,
                right: rightMarking,
            });
        }
    });
    return pairs.sort((a, b) => a.left.label - b.left.label);
};

export const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

export const formatReportDateTime = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, "0");
    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = date.getFullYear();
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${day}.${month}.${year} - ${hours}:${minutes}:${seconds}`;
};

export const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes)) return "-";
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
};

export const getMimeTypeFromName = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".gif")) return "image/gif";
    if (lower.endsWith(".bmp")) return "image/bmp";
    return "application/octet-stream";
};

export const toBlobBytes = (bytes: Uint8Array): Uint8Array =>
    new Uint8Array(bytes);

export const toDataUrl = (bytes: Uint8Array, name: string): Promise<string> =>
    new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(
            new Blob([toBlobBytes(bytes)], {
                type: getMimeTypeFromName(name),
            })
        );
    });

export const md5Bytes = (bytes: Uint8Array): string => {
    const buffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
    );
    return SparkMD5.ArrayBuffer.hash(buffer);
};

export const md5String = (value: string): string => SparkMD5.hash(value);

export const sha256Bytes = async (bytes: Uint8Array): Promise<string> => {
    const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
};
