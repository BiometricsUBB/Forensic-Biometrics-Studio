/* eslint-disable security/detect-object-injection */
import { cn } from "@/lib/utils/shadcn";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import { useDebouncedCallback } from "use-debounce";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { Trash2, Download, Upload, Plus, ChevronDown } from "lucide-react";
import { ICON, IS_DEV_ENVIRONMENT } from "@/lib/utils/const";
import { Toggle } from "@/components/ui/toggle";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { WORKING_MODE } from "@/views/selectMode";
import TypeKeybinding from "@/components/dialogs/marking-types/marking-type-keybinding";
import { KeybindingsStore } from "@/lib/stores/Keybindings";
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
import { useState, useEffect } from "react";
import { emitMarkingTypesChange } from "@/lib/hooks/useSettingsSync";

export function MarkingTypesSettings() {
    const { t } = useTranslation();

    const urlParams = new URLSearchParams(window.location.search);
    const urlWorkingMode = urlParams.get("workingMode") as WORKING_MODE | null;

    const [selectedCategory, setSelectedCategory] =
        useState<WORKING_MODE | null>(urlWorkingMode);

    useEffect(() => {
        const handleLocationChange = () => {
            const params = new URLSearchParams(window.location.search);
            const mode = params.get("workingMode") as WORKING_MODE | null;
            if (mode) {
                setSelectedCategory(mode);
            }
        };

        window.addEventListener("popstate", handleLocationChange);

        return () => {
            window.removeEventListener("popstate", handleLocationChange);
        };
    }, []);

    const types = MarkingTypesStore.use(state =>
        selectedCategory
            ? state.types.filter(c => c.category === selectedCategory)
            : state.types
    );

    const setType = useDebouncedCallback((id, value) => {
        MarkingTypesStore.actions.types.setType(id, value);
        emitMarkingTypesChange();
    }, 10);

    const keybindings = KeybindingsStore.use(state =>
        selectedCategory
            ? state.typesKeybindings.filter(
                  k => k.workingMode === selectedCategory
              )
            : state.typesKeybindings
    );

    const workingModes = Object.values(WORKING_MODE);

    return (
        <div className="flex flex-col gap-4 p-2 h-full">
            <div className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold">
                    {t("Types", { ns: "keywords" })}
                </h2>
                <p className="text-sm text-muted-foreground">{t("Types")}</p>
            </div>

            <div className="flex justify-between items-center gap-2 flex-wrap">
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
                                {selectedCategory ?? t("Working mode")}
                            </span>
                            <ChevronDown size={14} />
                        </DropdownMenuTrigger>
                        <DropdownMenuPortal>
                            <DropdownMenuContent>
                                {workingModes.map(mode => (
                                    <DropdownMenuItem
                                        key={mode}
                                        onClick={() =>
                                            setSelectedCategory(mode)
                                        }
                                    >
                                        {mode}
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
                                !selectedCategory &&
                                    "opacity-50 cursor-not-allowed"
                            )}
                            disabled={!selectedCategory}
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
                                            onClick={() => {
                                                MarkingTypesStore.actions.types.add(
                                                    {
                                                        id: crypto.randomUUID(),
                                                        name: t(
                                                            `Marking.Keys.markingClass.Keys.${MARKING_CLASS[key]}`,
                                                            {
                                                                ns: "object",
                                                            }
                                                        ),
                                                        displayName: t(
                                                            `Marking.Keys.markingClass.Keys.${MARKING_CLASS[key]}`,
                                                            {
                                                                ns: "object",
                                                            }
                                                        ),
                                                        markingClass:
                                                            MARKING_CLASS[key],
                                                        backgroundColor:
                                                            defaultBackgroundColor,
                                                        textColor:
                                                            defaultTextColor,
                                                        size: defaultSize,
                                                        category:
                                                            selectedCategory!,
                                                    }
                                                );
                                                emitMarkingTypesChange();
                                            }}
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

                    <Toggle
                        title={t("Import marking types", {
                            ns: "tooltip",
                        })}
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        pressed={false}
                        onClickCapture={async () => {
                            await importMarkingTypesWithDialog();
                            emitMarkingTypesChange();
                        }}
                    >
                        <Download
                            size={ICON.SIZE}
                            strokeWidth={ICON.STROKE_WIDTH}
                        />
                    </Toggle>

                    <Toggle
                        title={t("Export marking types", {
                            ns: "tooltip",
                        })}
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        pressed={false}
                        onClickCapture={() => exportMarkingTypesWithDialog()}
                    >
                        <Upload
                            size={ICON.SIZE}
                            strokeWidth={ICON.STROKE_WIDTH}
                        />
                    </Toggle>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                <table className="w-full">
                    <thead className="sticky top-0 bg-card z-10">
                        <TableRow className={cn("bg-card border-b")}>
                            <TableHead className="text-center text-card-foreground whitespace-nowrap">
                                {t(`MarkingType.Keys.displayName`, {
                                    ns: "object",
                                })}
                            </TableHead>
                            <TableHead className="text-center text-card-foreground whitespace-nowrap">
                                {t(`MarkingType.Keys.name`, {
                                    ns: "object",
                                })}
                            </TableHead>
                            <TableHead className="text-center text-card-foreground whitespace-nowrap">
                                {t(`MarkingType.Keys.markingClass`, {
                                    ns: "object",
                                })}
                            </TableHead>
                            <TableHead className="text-center text-card-foreground whitespace-nowrap">
                                {t(`MarkingType.Keys.backgroundColor`, {
                                    ns: "object",
                                })}
                            </TableHead>
                            <TableHead className="text-center text-card-foreground whitespace-nowrap">
                                {t(`MarkingType.Keys.textColor`, {
                                    ns: "object",
                                })}
                            </TableHead>
                            <TableHead className="text-center text-card-foreground whitespace-nowrap">
                                {t(`MarkingType.Keys.size`, {
                                    ns: "object",
                                })}
                            </TableHead>
                            <TableHead className="text-center text-card-foreground whitespace-nowrap">
                                {t("Keybinding", { ns: "keybindings" })}
                            </TableHead>
                            {IS_DEV_ENVIRONMENT && <TableHead />}
                        </TableRow>
                    </thead>
                    <tbody>
                        {types.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={8}
                                    className="text-center py-8 text-muted-foreground"
                                >
                                    {selectedCategory
                                        ? t("Types")
                                        : t("Working mode")}
                                </TableCell>
                            </TableRow>
                        ) : (
                            types.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <Input
                                            className="h-6 !p-0 text-center"
                                            title={`${t("MarkingType.Keys.name", { ns: "object" })}`}
                                            type="text"
                                            value={item.displayName}
                                            onChange={e => {
                                                setType(item.id, {
                                                    displayName: e.target.value,
                                                });
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {IS_DEV_ENVIRONMENT ? (
                                            <Input
                                                className="h-6 !p-0 text-center"
                                                title={`${t("MarkingType.Keys.name", { ns: "object" })}`}
                                                type="text"
                                                value={item.name}
                                                onChange={e => {
                                                    setType(item.id, {
                                                        name: e.target.value,
                                                    });
                                                }}
                                            />
                                        ) : (
                                            <span className="p-1 cursor-default">
                                                {item.name}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell
                                        className={cn(
                                            "p-1 cursor-default text-center"
                                        )}
                                    >
                                        {t(
                                            `Marking.Keys.markingClass.Keys.${item.markingClass}`,
                                            {
                                                ns: "object",
                                            }
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            className="size-6 cursor-pointer m-auto"
                                            title={`${t("MarkingType.Keys.backgroundColor", { ns: "object" })}`}
                                            type="color"
                                            value={
                                                item.backgroundColor as string
                                            }
                                            onChange={e => {
                                                setType(item.id, {
                                                    backgroundColor:
                                                        e.target.value,
                                                });
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            className="size-6 cursor-pointer m-auto"
                                            title={`${t("MarkingType.Keys.textColor", { ns: "object" })}`}
                                            type="color"
                                            value={item.textColor as string}
                                            onChange={e => {
                                                setType(item.id, {
                                                    textColor: e.target.value,
                                                });
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            className="w-24 h-6 !p-0 text-center m-auto"
                                            min={6}
                                            max={32}
                                            width={12}
                                            title={`${t("MarkingType.Keys.size", { ns: "object" })}`}
                                            type="number"
                                            value={item.size}
                                            onChange={e => {
                                                setType(item.id, {
                                                    size: Number(
                                                        e.target.value
                                                    ),
                                                });
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <TypeKeybinding
                                            boundKey={
                                                keybindings.find(
                                                    k => k.typeId === item.id
                                                )?.boundKey ?? undefined
                                            }
                                            workingMode={item.category}
                                            typeId={item.id}
                                        />
                                    </TableCell>
                                    {IS_DEV_ENVIRONMENT && (
                                        <TableCell>
                                            <Toggle
                                                title={t("Remove")}
                                                className="m-auto"
                                                size="icon"
                                                variant="outline"
                                                pressed={false}
                                                disabled={
                                                    MarkingTypesStore.actions.types.checkIfTypeIsInUse(
                                                        item.id,
                                                        CANVAS_ID.LEFT
                                                    ) ||
                                                    MarkingTypesStore.actions.types.checkIfTypeIsInUse(
                                                        item.id,
                                                        CANVAS_ID.RIGHT
                                                    )
                                                }
                                                onClickCapture={() => {
                                                    MarkingTypesStore.actions.types.removeById(
                                                        item.id
                                                    );

                                                    KeybindingsStore.actions.typesKeybindings.remove(
                                                        item.id,
                                                        item.category
                                                    );

                                                    emitMarkingTypesChange();
                                                }}
                                            >
                                                <Trash2
                                                    className="hover:text-destructive"
                                                    size={ICON.SIZE}
                                                    strokeWidth={
                                                        ICON.STROKE_WIDTH
                                                    }
                                                />
                                            </Toggle>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
