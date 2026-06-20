import React, { useCallback, useRef, useState } from "react";
import {
    GripVertical,
    Pencil,
    Trash2,
    Eye,
    EyeOff,
    Sun,
    Contrast,
    Waves,
    SlidersHorizontal,
    TrendingUp,
    Sparkles,
    Wand2,
    Brain,
    Loader2,
    AlertTriangle,
    CheckCircle2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/shadcn";
import { ICON } from "@/lib/utils/const";
import {
    AnyModifier,
    EnhancementModifier,
    isEnhancementModifier,
} from "@/lib/imageModifiers/types";

// ─── Icon per modifier type ───────────────────────────────────────────────────

export function ModifierIcon({
    type,
    size,
}: {
    type: AnyModifier["type"];
    size?: number;
}) {
    const cls = "shrink-0 text-primary";
    const s = size ?? ICON.SIZE - 2;
    if (type === "brightness")
        return <Sun size={s} strokeWidth={ICON.STROKE_WIDTH} className={cls} />;
    if (type === "contrast")
        return (
            <Contrast
                size={s}
                strokeWidth={ICON.STROKE_WIDTH}
                className={cls}
            />
        );
    if (type === "levels")
        return <SlidersHorizontal size={s} strokeWidth={ICON.STROKE_WIDTH} className={cls} />;
    if (type === "curves")
        return <TrendingUp size={s} strokeWidth={ICON.STROKE_WIDTH} className={cls} />;
    if (type === "gbfen")
        return (
            <Wand2 size={s} strokeWidth={ICON.STROKE_WIDTH} className={cls} />
        );
    if (type === "snfen")
        return (
            <Brain size={s} strokeWidth={ICON.STROKE_WIDTH} className={cls} />
        );
    if (type === "fft")
        return (
            <Waves size={s} strokeWidth={ICON.STROKE_WIDTH} className={cls} />
        );
    return (
        <Sparkles size={s} strokeWidth={ICON.STROKE_WIDTH} className={cls} />
    );
}

function EnhancementStatusBadge({
    modifier,
}: {
    modifier: EnhancementModifier;
}) {
    const { status } = modifier.params;
    if (status === "processing" || status === "pending") {
        return (
            <Loader2
                size={12}
                className="text-primary animate-spin shrink-0"
                aria-label={status}
            />
        );
    }
    if (status === "failed") {
        return (
            <AlertTriangle
                size={12}
                className="text-destructive shrink-0"
                aria-label="failed"
            />
        );
    }
    return (
        <CheckCircle2
            size={12}
            className="text-emerald-500 shrink-0"
            aria-label="ready"
        />
    );
}

// ─── Single item ──────────────────────────────────────────────────────────────

interface ModifierItemProps {
    modifier: AnyModifier;
    isDragging: boolean;
    onEdit: () => void;
    onToggle: () => void;
    onRemove: () => void;
    /** Called from the grip handle only */
    onGripMouseDown: (e: React.MouseEvent) => void;
    /** Called when the user presses ArrowUp / ArrowDown on the grip handle */
    onGripKeyDown: (e: React.KeyboardEvent) => void;
}

interface ItemActionsProps {
    modifier: AnyModifier;
    toggleDisabled: boolean;
    removeDisabled: boolean;
    onEdit: () => void;
    onToggle: () => void;
    onRemove: () => void;
}

function ItemActions({
    modifier,
    toggleDisabled,
    removeDisabled,
    onEdit,
    onToggle,
    onRemove,
}: ItemActionsProps) {
    const { t } = useTranslation(["tooltip", "keywords"]);
    return (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title={
                    modifier.enabled
                        ? t("Disable", { ns: "tooltip" })
                        : t("Enable", { ns: "tooltip" })
                }
                onClick={onToggle}
                disabled={toggleDisabled}
                id={`modifier-toggle-${modifier.id}`}
            >
                {modifier.enabled ? (
                    <Eye size={12} strokeWidth={2} />
                ) : (
                    <EyeOff size={12} strokeWidth={2} />
                )}
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title={t("Edit settings", { ns: "tooltip" })}
                onClick={onEdit}
                id={`modifier-edit-${modifier.id}`}
            >
                <Pencil size={12} strokeWidth={2} />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:text-destructive"
                title={t("Remove", { ns: "keywords" })}
                onClick={onRemove}
                disabled={removeDisabled}
                id={`modifier-remove-${modifier.id}`}
            >
                <Trash2 size={12} strokeWidth={2} />
            </Button>
        </div>
    );
}

function ModifierItem({
    modifier,
    isDragging,
    onEdit,
    onToggle,
    onRemove,
    onGripMouseDown,
    onGripKeyDown,
}: ModifierItemProps) {
    const { t } = useTranslation(["tooltip"]);

    let label: string;
    switch (modifier.type) {
        case "brightness":
            label = t("Brightness", { ns: "tooltip" });
            break;
        case "contrast":
            label = t("Contrast", { ns: "tooltip" });
            break;
        case "levels":
            label = t("Levels", { ns: "tooltip" });
            break;
        case "curves":
            label = t("Curves", { ns: "tooltip" });
            break;
        case "fft":
            label = t("FFT Filter", { ns: "tooltip" });
            break;
        case "gbfen":
            label = t("GBFEN", { ns: "tooltip" });
            break;
        default:
            label = t("SNFEN", { ns: "tooltip" });
            break;
    }

    const enhancement = isEnhancementModifier(modifier) ? modifier : null;
    const isProcessing =
        enhancement !== null &&
        (enhancement.params.status === "processing" ||
            enhancement.params.status === "pending");
    const toggleDisabled =
        enhancement !== null && enhancement.params.status !== "ready";

    const itemTitle = enhancement?.params.errorMessage
        ? enhancement.params.errorMessage
        : enhancement
          ? `${label} (${enhancement.params.status})`
          : label;

    return (
        <div
            className={cn(
                "group flex items-center gap-1.5 rounded-md border border-border/40 bg-background/60 px-2 py-1.5 text-sm transition-all duration-150",
                "hover:border-border/80 hover:bg-accent/20",
                isDragging && "opacity-30 scale-[0.97] pointer-events-none",
                !modifier.enabled && "opacity-60",
                enhancement?.params.status === "failed" &&
                    "border-destructive/60"
            )}
        >
            {/* Drag handle — mouse DnD and keyboard (↑ / ↓) reordering */}
            <button
                type="button"
                tabIndex={0}
                data-modifier-grip
                aria-label={t("Drag to reorder", { ns: "tooltip" })}
                title={`${t("Move up", { ns: "tooltip" })} / ${t("Move down", { ns: "tooltip" })}`}
                className="shrink-0 text-muted-foreground/50 cursor-grab active:cursor-grabbing select-none touch-none rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onMouseDown={onGripMouseDown}
                onKeyDown={onGripKeyDown}
            >
                <GripVertical
                    size={ICON.SIZE}
                    strokeWidth={ICON.STROKE_WIDTH}
                />
            </button>

            <ModifierIcon type={modifier.type} />

            <span
                className={cn(
                    "flex-1 truncate font-medium leading-tight",
                    !modifier.enabled && "line-through text-muted-foreground"
                )}
                title={itemTitle}
            >
                {label}
            </span>

            {enhancement && <EnhancementStatusBadge modifier={enhancement} />}

            <ItemActions
                modifier={modifier}
                toggleDisabled={toggleDisabled}
                removeDisabled={isProcessing}
                onEdit={onEdit}
                onToggle={onToggle}
                onRemove={onRemove}
            />
        </div>
    );
}

// ─── List with mouse-based DnD ────────────────────────────────────────────────
//
// Native HTML5 draggable DnD does not work reliably in Tauri WebView2 on
// Windows (shows "no-drop" cursor and never fires drop events).
// We implement reordering with plain mouse events on the document instead.

interface ModifierListProps {
    modifiers: AnyModifier[];
    onEdit: (id: string) => void;
    onToggle: (id: string) => void;
    onRemove: (id: string) => void;
    /** fromIndex and toIndex are final positions in the array (post-splice). */
    onReorder: (fromIndex: number, toIndex: number) => void;
}

export function ModifierList({
    modifiers,
    onEdit,
    onToggle,
    onRemove,
    onReorder,
}: ModifierListProps) {
    const handleKeyboardReorder = useCallback(
        (e: React.KeyboardEvent, idx: number) => {
            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
            e.preventDefault();
            const to = e.key === "ArrowUp" ? idx - 1 : idx + 1;
            if (to < 0 || to >= modifiers.length) return;
            onReorder(idx, to);
            requestAnimationFrame(() => {
                const handles = document.querySelectorAll<HTMLElement>(
                    "[data-modifier-grip]"
                );
                handles[to]?.focus();
            });
        },
        [modifiers.length, onReorder]
    );
    const { t } = useTranslation(["tooltip", "keywords"]);
    // dragging: which item + where it started
    const [dragging, setDragging] = useState<{
        id: string;
        fromIdx: number;
    } | null>(null);
    // dropIndex: visual insertion point (0 = before first, length = after last)
    const [dropIndex, setDropIndex] = useState<number>(-1);

    // Refs so the document-level handlers see current values without closures
    const draggingRef = useRef<{ id: string; fromIdx: number } | null>(null);
    const dropIndexRef = useRef<number>(-1);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
    const modifiersLengthRef = useRef(modifiers.length);
    modifiersLengthRef.current = modifiers.length;

    const startDrag = useCallback(
        (e: React.MouseEvent, id: string, fromIdx: number) => {
            // Only left-button
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();

            const drag = { id, fromIdx };
            draggingRef.current = drag;
            dropIndexRef.current = fromIdx;
            setDragging(drag);
            setDropIndex(fromIdx);

            function handleMove(ev: MouseEvent) {
                const len = modifiersLengthRef.current;
                let newDrop = len; // default: after last item

                for (let i = 0; i < len; i += 1) {
                    const el = itemRefs.current[i];
                    if (el) {
                        const rect = el.getBoundingClientRect();
                        if (ev.clientY < rect.top + rect.height / 2) {
                            newDrop = i;
                            break;
                        }
                    }
                }

                dropIndexRef.current = newDrop;
                setDropIndex(newDrop);
            }

            function handleUp() {
                const drag2 = draggingRef.current;
                const drop = dropIndexRef.current;

                if (drag2 !== null && drop !== -1) {
                    const { fromIdx: from } = drag2;
                    const to = drop > from ? drop - 1 : drop;
                    if (to !== from) {
                        onReorder(from, to);
                    }
                }

                draggingRef.current = null;
                dropIndexRef.current = -1;
                setDragging(null);
                setDropIndex(-1);
                document.removeEventListener("mousemove", handleMove);
                document.removeEventListener("mouseup", handleUp);
            }

            document.addEventListener("mousemove", handleMove);
            document.addEventListener("mouseup", handleUp);
        },
        [onReorder]
    );

    if (modifiers.length === 0) {
        return (
            <p className="text-xs text-muted-foreground/60 text-center py-3">
                {t("No modifiers yet", { ns: "keywords" })}
            </p>
        );
    }

    // Decide if a drop-line indicator should be shown.
    // No-op positions: dropping at fromIdx or fromIdx+1 yields no change.
    const fromIdx = dragging?.fromIdx ?? -1;
    const isNoop =
        dragging === null || dropIndex === fromIdx || dropIndex === fromIdx + 1;

    return (
        <div className="flex flex-col gap-1 select-none">
            {modifiers.map((mod, idx) => {
                // Show a blue top line at the insertion point
                const showTopLine = !isNoop && dropIndex === idx;
                // Show a blue bottom line when inserting after the last item
                const showBottomLine =
                    !isNoop &&
                    idx === modifiers.length - 1 &&
                    dropIndex === modifiers.length;

                return (
                    <div
                        key={mod.id}
                        ref={el => {
                            // eslint-disable-next-line security/detect-object-injection
                            itemRefs.current[idx] = el;
                        }}
                        className={cn(
                            "relative",
                            showTopLine &&
                                "before:absolute before:top-[-3px] before:inset-x-0 before:h-[2px] before:bg-primary before:rounded-full before:z-10",
                            showBottomLine &&
                                "after:absolute after:bottom-[-3px] after:inset-x-0 after:h-[2px] after:bg-primary after:rounded-full after:z-10"
                        )}
                    >
                        <ModifierItem
                            modifier={mod}
                            isDragging={dragging?.id === mod.id}
                            onEdit={() => onEdit(mod.id)}
                            onToggle={() => onToggle(mod.id)}
                            onRemove={() => onRemove(mod.id)}
                            onGripMouseDown={ev => startDrag(ev, mod.id, idx)}
                            onGripKeyDown={ev => handleKeyboardReorder(ev, idx)}
                        />
                    </div>
                );
            })}
        </div>
    );
}
