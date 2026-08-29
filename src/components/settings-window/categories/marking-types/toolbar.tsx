import { cn } from "@/lib/utils/shadcn";
import { useTranslation } from "react-i18next";
import { Toggle } from "@/components/ui/toggle";
import { WORKING_MODE } from "@/views/selectMode";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { exportMarkingTypesWithDialog } from "@/components/dialogs/marking-types/exportMarkingTypesWithDialog";
import { importMarkingTypesWithDialog } from "@/components/dialogs/marking-types/importMarkingTypesWithDialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuPortal,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MARKING_CLASS } from "@/lib/markings/MARKING_CLASS";
import {
    defaultBackgroundColor,
    defaultSize,
    defaultTextColor,
} from "@/lib/markings/MarkingType";
import { ICON } from "@/lib/utils/const";
import { ChevronDown, Download, Plus, Upload } from "lucide-react";
import { emitMarkingTypesChange } from "@/lib/hooks/useSettingsSync";

interface MarkingTypesToolbarProps {
    selectedCategory: WORKING_MODE | undefined;
    onSelectCategory: (mode: WORKING_MODE) => void;
}

export function MarkingTypesToolbar({
    selectedCategory,
    onSelectCategory,
}: MarkingTypesToolbarProps) {
    const { t } = useTranslation();
    const workingModes = Object.values(WORKING_MODE);

    return (
        <div className="flex flex-row gap-1.5 items-center">
            <DropdownMenu>
                <DropdownMenuTrigger
                    className={cn(
                        "h-8 px-3 flex items-center justify-between gap-2 min-w-[180px]",
                        "border border-input rounded-md",
                        "hover:bg-accent hover:text-accent-foreground"
                    )}
                >
                    <span className="text-sm">
                        {selectedCategory ? (
                            t(selectedCategory, { ns: "modes" })
                        ) : (
                            <span className="text-muted-foreground">
                                {t("Select working mode")}
                            </span>
                        )}
                    </span>
                    <ChevronDown size={14} />
                </DropdownMenuTrigger>
                <DropdownMenuPortal>
                    <DropdownMenuContent>
                        {workingModes.map(mode => (
                            <DropdownMenuItem
                                key={mode}
                                onClick={() => onSelectCategory(mode)}
                            >
                                {t(mode, { ns: "modes" })}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenuPortal>
            </DropdownMenu>

            <DropdownMenu>
                <DropdownMenuTrigger
                    title={t("Add")}
                    className={cn(
                        "h-8 w-8 flex items-center justify-center",
                        "border border-input rounded-md",
                        "hover:bg-accent hover:text-accent-foreground",
                        !selectedCategory && "opacity-50 cursor-not-allowed"
                    )}
                    disabled={!selectedCategory}
                >
                    <Plus size={ICON.SIZE} strokeWidth={ICON.STROKE_WIDTH} />
                </DropdownMenuTrigger>
                <DropdownMenuPortal>
                    <DropdownMenuContent>
                        {(
                            Object.keys(
                                MARKING_CLASS
                            ) as (keyof typeof MARKING_CLASS)[]
                        )
                            .filter(
                                key =>
                                    MARKING_CLASS[key] !==
                                    MARKING_CLASS.MEASUREMENT
                            )
                            .map(key => (
                                <DropdownMenuItem
                                    key={key}
                                    onClick={() => {
                                        MarkingTypesStore.actions.types.add({
                                            id: crypto.randomUUID(),
                                            name: t(
                                                `Marking.Keys.markingClass.Keys.${MARKING_CLASS[key]}`,
                                                { ns: "object" }
                                            ),
                                            displayName: t(
                                                `Marking.Keys.markingClass.Keys.${MARKING_CLASS[key]}`,
                                                { ns: "object" }
                                            ),
                                            markingClass: MARKING_CLASS[key],
                                            backgroundColor:
                                                defaultBackgroundColor,
                                            textColor: defaultTextColor,
                                            size: defaultSize,
                                            category: selectedCategory!,
                                        });
                                        emitMarkingTypesChange();
                                    }}
                                >
                                    {t(
                                        `Marking.Keys.markingClass.Keys.${MARKING_CLASS[key]}`,
                                        { ns: "object" }
                                    )}
                                </DropdownMenuItem>
                            ))}
                    </DropdownMenuContent>
                </DropdownMenuPortal>
            </DropdownMenu>

            <Toggle
                title={t("Import marking types", { ns: "tooltip" })}
                size="icon"
                variant="outline"
                className="h-8 w-8"
                pressed={false}
                onClickCapture={async () => {
                    await importMarkingTypesWithDialog();
                    emitMarkingTypesChange();
                }}
            >
                <Download size={ICON.SIZE} strokeWidth={ICON.STROKE_WIDTH} />
            </Toggle>

            <Toggle
                title={t("Export marking types", { ns: "tooltip" })}
                size="icon"
                variant="outline"
                className="h-8 w-8"
                pressed={false}
                onClickCapture={() => exportMarkingTypesWithDialog()}
            >
                <Upload size={ICON.SIZE} strokeWidth={ICON.STROKE_WIDTH} />
            </Toggle>
        </div>
    );
}
