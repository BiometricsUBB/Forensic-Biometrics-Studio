import { MarkingClass } from "@/lib/markings/MarkingClass";

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
