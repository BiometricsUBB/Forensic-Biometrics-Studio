import { MarkingClass } from "@/lib/markings/MarkingClass";
import {
    MarkingType,
    MARKING_ATTRIBUTE_KIND,
} from "@/lib/markings/MarkingType";

export type ResolvedMetadataRow = {
    fieldLabel: string;
    selectedLabel: string;
};

export const resolveMarkingMetadata = (
    marking: MarkingClass,
    markingType: MarkingType | undefined
): ResolvedMetadataRow[] => {
    const attributes = markingType?.attributes ?? [];

    return attributes.flatMap(attribute => {
        const selectedId = marking.attributeValues?.[attribute.id];
        if (!selectedId) return [];

        const items =
            attribute.kind === MARKING_ATTRIBUTE_KIND.CHOICE
                ? attribute.options
                : attribute.ranges ?? [];
        const selected = items.find(item => item.id === selectedId);
        if (!selected) return [];

        const unit =
            attribute.kind === MARKING_ATTRIBUTE_KIND.SIZE && attribute.unit
                ? ` (${attribute.unit})`
                : "";

        return [
            {
                fieldLabel: `${attribute.label}${unit}`,
                selectedLabel: selected.label,
            },
        ];
    });
};

export type MetadataComparisonRow = {
    fieldLabel: string;
    leftLabel: string;
    rightLabel: string;
};

const PLACEHOLDER = "—";

export const resolveMetadataComparison = (
    left: MarkingClass,
    right: MarkingClass,
    markingType: MarkingType | undefined
): MetadataComparisonRow[] => {
    const attributes = markingType?.attributes ?? [];

    return attributes.flatMap(attribute => {
        const items =
            attribute.kind === MARKING_ATTRIBUTE_KIND.CHOICE
                ? attribute.options
                : attribute.ranges ?? [];
        const labelFor = (marking: MarkingClass) => {
            const id = marking.attributeValues?.[attribute.id];
            if (!id) return "";
            return items.find(item => item.id === id)?.label ?? "";
        };

        const leftLabel = labelFor(left);
        const rightLabel = labelFor(right);
        if (!leftLabel && !rightLabel) return [];

        const unit =
            attribute.kind === MARKING_ATTRIBUTE_KIND.SIZE && attribute.unit
                ? ` (${attribute.unit})`
                : "";

        return [
            {
                fieldLabel: `${attribute.label}${unit}`,
                leftLabel: leftLabel || PLACEHOLDER,
                rightLabel: rightLabel || PLACEHOLDER,
            },
        ];
    });
};
