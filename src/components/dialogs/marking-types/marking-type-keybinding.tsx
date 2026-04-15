import { useState } from "react";
import { KeybindingsStore } from "@/lib/stores/Keybindings";
import { MarkingType } from "@/lib/markings/MarkingType";
import { WORKING_MODE } from "@/views/selectMode";
import KeyCaptureDialog from "@/components/ui/key-capture-dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { formatCombo } from "@/lib/utils/keybinding";
import { cn } from "@/lib/utils/shadcn";
import { Plus } from "lucide-react";
import { ICON } from "@/lib/utils/const";

interface TypesKeyCaptureDialogProps {
    workingMode: WORKING_MODE;
    boundKey: string | undefined;
    typeId: MarkingType["id"];
    isConflict?: boolean;
}

function MarkingTypeKeybinding({
    workingMode,
    boundKey,
    typeId,
    isConflict = false,
}: TypesKeyCaptureDialogProps) {
    const [open, setOpen] = useState(false);

    const { add, remove } = KeybindingsStore.actions.typesKeybindings;

    const handleKeyBind = (combo: string) => {
        add({ workingMode, boundKey: combo, typeId });
    };

    const handleKeyUnbind = () => {
        remove(typeId, workingMode);
    };

    const parts = boundKey ? formatCombo(boundKey) : null;

    return (
        <>
            <button
                type="button"
                className={cn(
                    "group flex items-center justify-center m-auto rounded px-1 py-0.5",
                    "cursor-pointer",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                )}
                onClick={() => setOpen(true)}
            >
                {parts ? (
                    <KbdGroup>
                        {parts.map(part => (
                            <Kbd
                                key={`keybind-${typeId}-part-${part}`}
                                className={cn(
                                    "transition-colors",
                                    "group-hover:bg-accent group-hover:text-accent-foreground",
                                    isConflict &&
                                        "bg-destructive/15 text-destructive border-destructive/40 group-hover:bg-destructive/25 group-hover:text-destructive"
                                )}
                            >
                                {part}
                            </Kbd>
                        ))}
                    </KbdGroup>
                ) : (
                    <span className="flex items-center gap-1 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors text-xs">
                        <Plus
                            size={ICON.SIZE}
                            strokeWidth={ICON.STROKE_WIDTH}
                        />
                    </span>
                )}
            </button>

            <KeyCaptureDialog
                open={open}
                onOpenChange={setOpen}
                boundKey={boundKey}
                onKeyBind={handleKeyBind}
                onKeyUnbind={boundKey ? handleKeyUnbind : undefined}
            />
        </>
    );
}

export default MarkingTypeKeybinding;
