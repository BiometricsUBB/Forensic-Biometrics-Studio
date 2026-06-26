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
    leftType: MarkingType | undefined,
    rightType: MarkingType | undefined
): MetadataComparisonRow[] => {
    const leftRows = resolveMarkingMetadata(left, leftType);
    const rightRows = resolveMarkingMetadata(right, rightType);

    const leftByField = new Map(
        leftRows.map(row => [row.fieldLabel, row.selectedLabel])
    );
    const rightByField = new Map(
        rightRows.map(row => [row.fieldLabel, row.selectedLabel])
    );

    const orderedFields: string[] = [];
    const seen = new Set<string>();
    [...leftRows, ...rightRows].forEach(row => {
        if (seen.has(row.fieldLabel)) return;
        seen.add(row.fieldLabel);
        orderedFields.push(row.fieldLabel);
    });

    return orderedFields.map(fieldLabel => ({
        fieldLabel,
        leftLabel: leftByField.get(fieldLabel) || PLACEHOLDER,
        rightLabel: rightByField.get(fieldLabel) || PLACEHOLDER,
    }));
};
