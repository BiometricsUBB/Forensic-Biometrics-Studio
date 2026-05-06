import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogOverlay,
    DialogPortal,
    DialogTitle,
} from "@/components/ui/dialog";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { MarkingClass } from "@/lib/markings/MarkingClass";
import { MarkingType } from "@/lib/markings/MarkingType";
import { MarkingsStore } from "@/lib/stores/Markings";
import { useTranslation } from "react-i18next";
import { MarkingMetadataForm } from "./MarkingMetadataForm";

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    canvasId: CANVAS_ID;
    marking: MarkingClass;
    markingType: MarkingType;
};

export function MarkingMetadataEditDialog({
    open,
    onOpenChange,
    canvasId,
    marking,
    markingType,
}: Props) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState<Record<string, string>>(
        marking.attributeValues ?? {}
    );

    const handleSubmit = () => {
        MarkingsStore(canvasId).actions.markings.updateAttributeValues(
            marking.label,
            draft
        );
        onOpenChange(false);
    };

    const heading = `${t("Edit metadata", { ns: "tooltip" })} #${marking.label}`;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogPortal>
                <DialogOverlay />
                <DialogContent className="w-120 max-w-[90vw] max-h-[80vh] flex flex-col gap-3">
                    <div className="flex flex-col gap-1 border-b pb-2">
                        <DialogTitle className="text-xs font-normal text-muted-foreground">
                            {heading}
                        </DialogTitle>
                        <DialogDescription className="text-base font-semibold text-foreground">
                            {markingType.displayName}
                        </DialogDescription>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-1">
                        <MarkingMetadataForm
                            markingType={markingType}
                            values={draft}
                            onChange={(attrId, optionId) =>
                                setDraft(prev => ({
                                    ...prev,
                                    [attrId]: optionId,
                                }))
                            }
                        />
                    </div>
                    <div className="flex items-center justify-end gap-2 border-t pt-3">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            {t("Cancel", { ns: "keywords" })}
                        </Button>
                        <Button onClick={handleSubmit}>
                            {t("Submit", { ns: "keywords" })}
                        </Button>
                    </div>
                </DialogContent>
            </DialogPortal>
        </Dialog>
    );
}
