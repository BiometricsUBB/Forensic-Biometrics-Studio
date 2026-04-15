import { useState, useEffect, useRef, KeyboardEvent } from "react";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils/shadcn";
import {
    serializeCombo,
    isModifierOnly,
    isReserved,
    formatCombo,
} from "@/lib/utils/keybinding";

interface KeyCaptureDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    boundKey?: string;
    onKeyBind: (combo: string) => void;
    onKeyUnbind?: () => void;
}

function KeyCaptureDialog({
    open,
    onOpenChange,
    boundKey,
    onKeyBind,
    onKeyUnbind,
}: KeyCaptureDialogProps) {
    const { t } = useTranslation("keybindings");
    const [preview, setPreview] = useState<string | null>(null);
    const [reservedKey, setReservedKey] = useState<string | null>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open) {
            setPreview(null);
            setReservedKey(null);
            setTimeout(() => contentRef.current?.focus(), 0);
        }
    }, [open]);

    const handleKeyDown = (e: KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === "Escape") {
            onOpenChange(false);
            return;
        }

        if ((e.key === "Delete" || e.key === "Backspace") && onKeyUnbind) {
            onKeyUnbind();
            onOpenChange(false);
            return;
        }

        if (isModifierOnly(e.nativeEvent)) return;

        if (isReserved(e.nativeEvent)) {
            setPreview(null);
            setReservedKey(serializeCombo(e.nativeEvent));
            return;
        }

        setReservedKey(null);
        setPreview(serializeCombo(e.nativeEvent));
    };

    const handleKeyUp = (e: KeyboardEvent) => {
        if (!preview || isModifierOnly(e.nativeEvent)) return;
        onKeyBind(preview);
        onOpenChange(false);
    };

    const displayCombo = reservedKey ?? preview ?? boundKey ?? null;
    const displayParts = displayCombo ? formatCombo(displayCombo) : null;
    const hasKey = !!displayCombo;
    const isPreview = !!preview;
    const isReservedPreview = !!reservedKey;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                ref={contentRef}
                tabIndex={-1}
                className="grid gap-3 max-w-xs w-full outline-none select-none"
                onKeyDown={handleKeyDown}
                onKeyUp={handleKeyUp}
            >
                <div className="flex flex-col items-center gap-1.5 text-center">
                    <DialogTitle>{t("Assign keybinding")}</DialogTitle>
                    <DialogDescription className="text-xs">
                        {t("Press a key or combination")}
                    </DialogDescription>
                </div>

                <div className="flex flex-col items-center gap-3 py-2">
                    <div
                        className={cn(
                            "w-full flex items-center justify-center rounded-md h-16",
                            "border-2 transition-colors",
                            hasKey
                                ? "border-solid border-border"
                                : "border-dashed border-border/60",
                            isPreview && "border-primary/60",
                            isReservedPreview && "border-destructive/60"
                        )}
                    >
                        {displayParts ? (
                            <KbdGroup>
                                {displayParts.map(part => (
                                    <Kbd
                                        key={`part-${part}`}
                                        className={cn(
                                            "text-base px-2.5 py-1 h-auto",
                                            !isPreview &&
                                                !isReservedPreview &&
                                                "opacity-40",
                                            isReservedPreview && "opacity-50"
                                        )}
                                    >
                                        {part}
                                    </Kbd>
                                ))}
                            </KbdGroup>
                        ) : (
                            <span className="text-muted-foreground/60 text-sm">
                                {t("Waiting for input...")}
                            </span>
                        )}
                    </div>

                    {isReservedPreview && (
                        <p className="text-xs text-destructive text-center">
                            {t("This shortcut is reserved by the application")}
                        </p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <Kbd>Esc</Kbd>
                            {t("cancel")}
                        </span>
                        {onKeyUnbind && (
                            <span className="flex items-center gap-1">
                                <Kbd>Del</Kbd>
                                {t("remove")}
                            </span>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default KeyCaptureDialog;
