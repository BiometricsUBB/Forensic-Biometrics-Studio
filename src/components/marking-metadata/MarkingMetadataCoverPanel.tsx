import { Button } from "@/components/ui/button";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { MarkingsStore } from "@/lib/stores/Markings";
import { MetadataEntryStore } from "@/lib/stores/MetadataEntry";
import { useTranslation } from "react-i18next";
import { MarkingMetadataForm } from "./MarkingMetadataForm";

type Props = {
    panelCanvasId: CANVAS_ID;
};

/**
 * Full-fill metadata-entry form that covers the canvas *opposite* the one
 * where a new marking was just placed. Submit persists the values onto the
 * marking; Cancel removes the marking via history.
 */
export function MarkingMetadataCoverPanel({ panelCanvasId }: Props) {
    const { t } = useTranslation();
    const activeEntry = MetadataEntryStore.use(state => state.activeEntry);
    const types = MarkingTypesStore.use(state => state.types);
    const leftMarkings = MarkingsStore(CANVAS_ID.LEFT).use(
        state => state.markings
    );
    const rightMarkings = MarkingsStore(CANVAS_ID.RIGHT).use(
        state => state.markings
    );

    if (!activeEntry || activeEntry.canvasId === panelCanvasId) return null;

    const sourceMarkings =
        activeEntry.canvasId === CANVAS_ID.LEFT ? leftMarkings : rightMarkings;
    const marking = sourceMarkings.find(m => m.label === activeEntry.label);
    const markingType = marking
        ? types.find(type => type.id === marking.typeId)
        : undefined;

    if (!marking || !markingType?.attributes?.length) return null;

    return (
        <div className="absolute inset-0 z-30 bg-background flex flex-col">
            <div className="flex flex-col border-b p-3">
                <span className="text-xs text-muted-foreground">
                    {t("Edit metadata", { ns: "tooltip" })} #{marking.label}
                </span>
                <span className="text-base font-semibold">
                    {markingType.displayName}
                </span>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
                <MarkingMetadataForm
                    markingType={markingType}
                    values={activeEntry.draftValues}
                    onChange={(attrId, optionId) =>
                        MetadataEntryStore.actions.setValue(attrId, optionId)
                    }
                />
            </div>
            <div className="flex items-center justify-end gap-2 border-t p-3">
                <Button
                    variant="outline"
                    onClick={() => MetadataEntryStore.actions.cancel()}
                >
                    {t("Cancel", { ns: "keywords" })}
                </Button>
                <Button onClick={() => MetadataEntryStore.actions.submit()}>
                    {t("Submit", { ns: "keywords" })}
                </Button>
            </div>
        </div>
    );
}
