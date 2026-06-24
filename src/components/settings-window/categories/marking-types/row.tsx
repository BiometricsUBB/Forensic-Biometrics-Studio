import { cn } from "@/lib/utils/shadcn";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import { TableCell, TableRow } from "@/components/ui/table";
import { Trash2, GripVertical } from "lucide-react";
import { ICON } from "@/lib/utils/const";
import { Toggle } from "@/components/ui/toggle";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import TypeKeybinding from "@/components/dialogs/marking-types/marking-type-keybinding";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { MarkingType } from "@/lib/markings/MarkingType";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface SortableTypeRowProps {
    item: MarkingType;
    boundKey: string | undefined;
    isConflict: boolean;
    setType: (id: string, value: Partial<MarkingType>) => void;
    onRemove: (item: MarkingType) => void;
}

export function SortableTypeRow({
    item,
    boundKey,
    isConflict,
    setType,
    onRemove,
}: SortableTypeRowProps) {
    const { t } = useTranslation();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <TableRow
            ref={setNodeRef}
            style={style}
            className={cn(isDragging && "opacity-40 z-10 relative")}
        >
            <TableCell className="w-6 px-1">
                <button
                    type="button"
                    aria-label={t("Drag to reorder", { ns: "tooltip" })}
                    title={`${t("Move up", { ns: "tooltip" })} / ${t("Move down", { ns: "tooltip" })}`}
                    className="flex text-muted-foreground/50 cursor-grab active:cursor-grabbing select-none touch-none rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical
                        size={ICON.SIZE}
                        strokeWidth={ICON.STROKE_WIDTH}
                    />
                </button>
            </TableCell>
            <TableCell>
                <Input
                    className="h-6 p-0! text-center"
                    title={`${t("MarkingType.Keys.displayName", { ns: "object" })}`}
                    type="text"
                    value={item.displayName}
                    onChange={e =>
                        setType(item.id, { displayName: e.target.value })
                    }
                />
            </TableCell>
            {/* <TableCell>
                {IS_DEV_ENVIRONMENT ? (
                    <Input
                        className="h-6 p-0! text-center"
                        title={`${t("MarkingType.Keys.name", { ns: "object" })}`}
                        type="text"
                        value={item.name}
                        onChange={e => setType(item.id, { name: e.target.value })}
                    />
                ) : (
                    <span className="p-1 cursor-default">{item.name}</span>
                )}
            </TableCell> */}
            <TableCell className="p-1 cursor-default text-center">
                {t(`Marking.Keys.markingClass.Keys.${item.markingClass}`, {
                    ns: "object",
                })}
            </TableCell>
            <TableCell>
                <Input
                    className="size-6 cursor-pointer m-auto"
                    title={`${t("MarkingType.Keys.backgroundColor", { ns: "object" })}`}
                    type="color"
                    value={item.backgroundColor as string}
                    onChange={e =>
                        setType(item.id, { backgroundColor: e.target.value })
                    }
                />
            </TableCell>
            <TableCell>
                <Input
                    className="size-6 cursor-pointer m-auto"
                    title={`${t("MarkingType.Keys.textColor", { ns: "object" })}`}
                    type="color"
                    value={item.textColor as string}
                    onChange={e =>
                        setType(item.id, { textColor: e.target.value })
                    }
                />
            </TableCell>
            <TableCell>
                <Input
                    className="w-24 h-6 p-0! text-center m-auto"
                    min={6}
                    max={32}
                    width={12}
                    title={`${t("MarkingType.Keys.size", { ns: "object" })}`}
                    type="number"
                    value={item.size}
                    onChange={e =>
                        setType(item.id, { size: Number(e.target.value) })
                    }
                />
            </TableCell>
            <TableCell>
                <TypeKeybinding
                    boundKey={boundKey}
                    workingMode={item.category}
                    typeId={item.id}
                    isConflict={isConflict}
                />
            </TableCell>
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
                    onClickCapture={() => onRemove(item)}
                >
                    <Trash2
                        className="hover:text-destructive"
                        size={ICON.SIZE}
                        strokeWidth={ICON.STROKE_WIDTH}
                    />
                </Toggle>
            </TableCell>
        </TableRow>
    );
}
