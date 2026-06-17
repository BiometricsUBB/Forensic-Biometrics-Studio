import { cn } from "@/lib/utils/shadcn";
import { useTranslation } from "react-i18next";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { LayoutGrid } from "lucide-react";
import { MarkingType } from "@/lib/markings/MarkingType";
import { TypeKeybinding } from "@/lib/stores/Keybindings";
import { WORKING_MODE } from "@/views/selectMode";
import {
    DndContext,
    DragEndEvent,
    closestCenter,
    useSensors,
} from "@dnd-kit/core";
import {
    SortableContext,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableTypeRow } from "./row";

interface MarkingTypesTableProps {
    selectedCategory: WORKING_MODE | undefined;
    types: MarkingType[];
    keybindings: TypeKeybinding[];
    conflictingKeys: Set<string>;
    sensors: ReturnType<typeof useSensors>;
    onDragEnd: (event: DragEndEvent) => void;
    onRemove: (item: MarkingType) => void;
    setType: (id: string, value: Partial<MarkingType>) => void;
}

export function MarkingTypesTable({
    selectedCategory,
    types,
    keybindings,
    conflictingKeys,
    sensors,
    onDragEnd,
    onRemove,
    setType,
}: MarkingTypesTableProps) {
    const { t } = useTranslation();

    if (selectedCategory === undefined) {
        return (
            <div className="flex flex-col items-center text-center gap-2 border border-dashed py-8 rounded-lg">
                <LayoutGrid className="size-12" />
                <p>{t("Select a working mode to view marking types")}</p>
            </div>
        );
    }

    return (
        <table className="w-full">
            <thead className="sticky top-0 bg-card">
                <TableRow className={cn("bg-card border-b")}>
                    <TableHead className="w-6" />
                    <TableHead className="text-center text-card-foreground whitespace-nowrap">
                        {t(`MarkingType.Keys.displayName`, { ns: "object" })}
                    </TableHead>
                    {/* <TableHead className="text-center text-card-foreground whitespace-nowrap">
                        {t(`MarkingType.Keys.name`, { ns: "object" })}
                    </TableHead> */}
                    <TableHead className="text-center text-card-foreground whitespace-nowrap">
                        {t(`MarkingType.Keys.markingClass`, { ns: "object" })}
                    </TableHead>
                    <TableHead className="text-center text-card-foreground whitespace-nowrap">
                        {t(`MarkingType.Keys.backgroundColor`, {
                            ns: "object",
                        })}
                    </TableHead>
                    <TableHead className="text-center text-card-foreground whitespace-nowrap">
                        {t(`MarkingType.Keys.textColor`, { ns: "object" })}
                    </TableHead>
                    <TableHead className="text-center text-card-foreground whitespace-nowrap">
                        {t(`MarkingType.Keys.size`, { ns: "object" })}
                    </TableHead>
                    <TableHead className="text-center text-card-foreground whitespace-nowrap">
                        {t("Keybinding", { ns: "keybindings" })}
                    </TableHead>
                    <TableHead className="w-8" />
                </TableRow>
            </thead>
            <tbody>
                {types.length === 0 ? (
                    <TableRow>
                        <TableCell
                            colSpan={9}
                            className="text-center py-8 text-muted-foreground"
                        >
                            {t(
                                "No marking types found for the selected working mode"
                            )}
                        </TableCell>
                    </TableRow>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={onDragEnd}
                    >
                        <SortableContext
                            items={types.map(t => t.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {types.map(item => {
                                const itemBoundKey = keybindings.find(
                                    k => k.typeId === item.id
                                )?.boundKey;
                                return (
                                    <SortableTypeRow
                                        key={item.id}
                                        item={item}
                                        boundKey={itemBoundKey}
                                        isConflict={
                                            !!itemBoundKey &&
                                            conflictingKeys.has(itemBoundKey)
                                        }
                                        setType={setType}
                                        onRemove={onRemove}
                                    />
                                );
                            })}
                        </SortableContext>
                    </DndContext>
                )}
            </tbody>
        </table>
    );
}
