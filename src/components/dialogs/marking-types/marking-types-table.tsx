import { cn } from "@/lib/utils/shadcn";
import { Input } from "@/components/ui/input";
import { t } from "i18next";
import { useDebouncedCallback } from "use-debounce";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { ICON, IS_DEV_ENVIRONMENT } from "@/lib/utils/const";
import { Toggle } from "@/components/ui/toggle";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { WorkingModeStore } from "@/lib/stores/WorkingMode";
import TypeKeybinding from "@/components/dialogs/marking-types/marking-type-keybinding";
import { KeybindingsStore } from "@/lib/stores/Keybindings";

function MarkingTypesTable() {
    const workingMode = WorkingModeStore.state.workingMode!;

    const types = MarkingTypesStore.use(state =>
        state.types.filter(c => c.category === workingMode)
    );

    const setType = useDebouncedCallback(
        (id, value) => MarkingTypesStore.actions.types.setType(id, value),
        10
    );

    const keybindings = KeybindingsStore.use(state =>
        state.typesKeybindings.filter(k => k.workingMode === workingMode)
    );

    return (
        <div className="h-[50vh] w-[50vw] no-scrollbar overflow-y-auto">
            <table className="w-full">
                <thead>
                    <TableRow className={cn("bg-card")}>
                        <TableHead className="text-center text-card-foreground">
                            {t(`MarkingType.Keys.displayName`, {
                                ns: "object",
                            })}
                        </TableHead>
                        <TableHead className="text-center text-card-foreground">
                            {t(`MarkingType.Keys.name`, {
                                ns: "object",
                            })}
                        </TableHead>
                        <TableHead className="text-center text-card-foreground">
                            {t(`MarkingType.Keys.markingClass`, {
                                ns: "object",
                            })}
                        </TableHead>
                        <TableHead className="text-center text-card-foreground">
                            {t(`MarkingType.Keys.backgroundColor`, {
                                ns: "object",
                            })}
                        </TableHead>
                        <TableHead className="text-center text-card-foreground">
                            {t(`MarkingType.Keys.textColor`, {
                                ns: "object",
                            })}
                        </TableHead>
                        <TableHead className="text-center text-card-foreground">
                            {t(`MarkingType.Keys.size`, {
                                ns: "object",
                            })}
                        </TableHead>
                        <TableHead className="text-center text-card-foreground">
                            {t("Keybinding", { ns: "keybindings" })}
                        </TableHead>
                        {IS_DEV_ENVIRONMENT && <TableHead />}
                    </TableRow>
                </thead>
                <tbody>
                    {types.map(item => (
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
                            {/* 
                            
                                TODO:
                                Allowed changing the typeName input in DEV_ENVIRONMENT until the adding method is redesigned; 
                                the typeName input should be repalced in the future to only display the typeName through the app;

                            */}
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
                                className={cn("p-1 cursor-default text-center")}
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
                                    value={item.backgroundColor as string}
                                    onChange={e => {
                                        setType(item.id, {
                                            backgroundColor: e.target.value,
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
                                    className="w-24 h-6 !p-0 text-center"
                                    min={6}
                                    max={32}
                                    width={12}
                                    title={`${t("MarkingType.Keys.size", { ns: "object" })}`}
                                    type="number"
                                    value={item.size}
                                    onChange={e => {
                                        setType(item.id, {
                                            size: Number(e.target.value),
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
                                    workingMode={workingMode}
                                    typeId={item.id}
                                />
                            </TableCell>
                            {/*  The option to delete types in the UI has been disabled for users.
                            However, this functionality remains unchanged and available in the developer version. 
                            It will be restored after the release of the improved version of types/presets. */}
                            {IS_DEV_ENVIRONMENT && (
                                <TableCell className="h-full text-center align-middle">
                                    <Toggle
                                        title={t("Remove")}
                                        className="block"
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
                                                workingMode
                                            );
                                        }}
                                    >
                                        <div className=" hover:text-destructive cursor-pointer">
                                            <Trash2
                                                size={ICON.SIZE}
                                                strokeWidth={ICON.STROKE_WIDTH}
                                            />
                                        </div>
                                    </Toggle>
                                </TableCell>
                            )}
                        </TableRow>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default MarkingTypesTable;
