import {
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogOverlay,
    DialogPortal,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils/shadcn";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { Toggle } from "@/components/ui/toggle";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import {
    defaultBackgroundColor,
    defaultSize,
    defaultTextColor,
} from "@/lib/markings/MarkingType";
import { Download, Plus, Upload, X } from "lucide-react";
import { ICON } from "@/lib/utils/const";
import MarkingTypesTable from "@/components/dialogs/marking-types/marking-types-table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuPortal,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportMarkingTypesWithDialog } from "@/components/dialogs/marking-types/exportMarkingTypesWithDialog";
import { importMarkingTypesWithDialog } from "@/components/dialogs/marking-types/importMarkingTypesWithDialog";
import { useTranslation } from "react-i18next";
import { WorkingModeStore } from "@/lib/stores/WorkingMode";
import { MARKING_CLASS } from "@/lib/markings/MARKING_CLASS";

function MarkingTypesDialogPortal() {
    const { t } = useTranslation();

    const workingMode = WorkingModeStore.use(state => state.workingMode);

    return (
        <DialogPortal>
            <DialogOverlay />
            <DialogContent className={cn("")}>
                <VisuallyHidden asChild>
                    <DialogTitle className={cn("text-2xl")}>
                        {t("Types")}
                    </DialogTitle>
                </VisuallyHidden>

                {/* Toolbar */}
                <div className="flex justify-between pb-1">
                    <div className="flex flex-row gap-1">
                        {/* Add new type */}
                        <DropdownMenu>
                            <DropdownMenuTrigger
                                title={t("Add")}
                                className={cn("h-6 w-6", "border border-input")}
                            >
                                <Plus
                                    size={ICON.SIZE}
                                    strokeWidth={ICON.STROKE_WIDTH}
                                />
                            </DropdownMenuTrigger>

                            <DropdownMenuPortal>
                                <DropdownMenuContent>
                                    {(
                                        Object.keys(
                                            MARKING_CLASS
                                        ) as (keyof typeof MARKING_CLASS)[]
                                    ).map(key => {
                                        return (
                                            <DropdownMenuItem
                                                key={key}
                                                onClick={() =>
                                                    MarkingTypesStore.actions.types.add(
                                                        {
                                                            id: crypto.randomUUID(),
                                                            displayName: t(
                                                                `Marking.Keys.markingClass.Keys.${MARKING_CLASS[key]}`,
                                                                {
                                                                    ns: "object",
                                                                }
                                                            ),
                                                            markingClass:
                                                                MARKING_CLASS[
                                                                    key
                                                                ],
                                                            backgroundColor:
                                                                defaultBackgroundColor,
                                                            textColor:
                                                                defaultTextColor,
                                                            size: defaultSize,
                                                            category:
                                                                workingMode!,
                                                        }
                                                    )
                                                }
                                            >
                                                {t(
                                                    `Marking.Keys.markingClass.Keys.${MARKING_CLASS[key]}`,
                                                    { ns: "object" }
                                                )}
                                            </DropdownMenuItem>
                                        );
                                    })}
                                </DropdownMenuContent>
                            </DropdownMenuPortal>
                        </DropdownMenu>

                        {/* Import types from file */}
                        <Toggle
                            title={t("Import marking types", {
                                ns: "tooltip",
                            })}
                            size="icon"
                            variant="outline"
                            pressed={false}
                            onClickCapture={() =>
                                importMarkingTypesWithDialog()
                            }
                        >
                            <Download
                                size={ICON.SIZE}
                                strokeWidth={ICON.STROKE_WIDTH}
                            />
                        </Toggle>

                        {/* Export types to json */}
                        <Toggle
                            title={t("Export marking types", {
                                ns: "tooltip",
                            })}
                            size="icon"
                            variant="outline"
                            pressed={false}
                            onClickCapture={() =>
                                exportMarkingTypesWithDialog()
                            }
                        >
                            <Upload
                                size={ICON.SIZE}
                                strokeWidth={ICON.STROKE_WIDTH}
                            />
                        </Toggle>

                        <span className="ml-1">
                            {t("Working mode")}:{" "}
                            <span className="font-bold">{workingMode}</span>
                        </span>
                    </div>

                    <div>
                        {/* Close dialog */}
                        <DialogClose>
                            <div aria-label="Close">
                                <X
                                    size={ICON.SIZE}
                                    strokeWidth={ICON.STROKE_WIDTH}
                                />
                            </div>
                        </DialogClose>
                    </div>
                </div>

                <MarkingTypesTable />

                <DialogDescription />
            </DialogContent>
        </DialogPortal>
    );
}

export default MarkingTypesDialogPortal;
