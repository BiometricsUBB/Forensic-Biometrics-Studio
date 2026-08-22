import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/shadcn";
import { Edit3, Hand, Waves, Trash2, Eraser, X, Check } from "lucide-react";
import { ICON } from "@/lib/utils/const";
import { UseFftWorkspaceReturn } from "../hooks/useFftWorkspace";

const TOOL_BTN_CLASS =
    "flex-1 min-w-0 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md transition-all text-xs font-medium";
const TOOL_BTN_ACTIVE_CLASS = "bg-background shadow-sm text-foreground";
const TOOL_BTN_INACTIVE_CLASS =
    "text-muted-foreground hover:bg-secondary/80 hover:text-secondary-foreground";

interface SidebarFFTProps {
    fft: UseFftWorkspaceReturn;
    onCancel: () => void;
}

export function SidebarFFT({ fft, onCancel }: SidebarFFTProps) {
    const { t } = useTranslation(["tooltip", "keywords"]);

    return (
        <div className="flex flex-col gap-3 w-full bg-background/50 border border-primary/30 rounded-lg p-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                    <Waves size={ICON.SIZE} className="text-primary shrink-0" />
                    <span>{t("FFT Filter", { ns: "tooltip" })}</span>
                </div>
                {fft.status === "loading" && (
                    <span className="text-xs animate-pulse text-muted-foreground">
                        {t("Initializing...", {
                            ns: "keywords",
                            defaultValue: "Initializing...",
                        })}
                    </span>
                )}
                {fft.status === "processing" && (
                    <span className="text-xs animate-pulse text-primary">
                        {t("Processing...", { ns: "keywords" })}
                    </span>
                )}
            </div>

            {fft.status === "ready" && (
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <div className="flex bg-secondary/50 p-1 rounded-lg gap-1">
                            <button
                                type="button"
                                onClick={() => fft.setInteractionMode("draw")}
                                title={t("Draw", { ns: "keywords" })}
                                className={cn(
                                    TOOL_BTN_CLASS,
                                    fft.interactionMode === "draw"
                                        ? TOOL_BTN_ACTIVE_CLASS
                                        : TOOL_BTN_INACTIVE_CLASS
                                )}
                            >
                                <Edit3 className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">
                                    {t("Draw", { ns: "keywords" })}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => fft.setInteractionMode("erase")}
                                title={t("Eraser", { ns: "keywords" })}
                                className={cn(
                                    TOOL_BTN_CLASS,
                                    fft.interactionMode === "erase"
                                        ? TOOL_BTN_ACTIVE_CLASS
                                        : TOOL_BTN_INACTIVE_CLASS
                                )}
                            >
                                <Eraser className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">
                                    {t("Eraser", { ns: "keywords" })}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => fft.setInteractionMode("pan")}
                                title={t("Pan", { ns: "keywords" })}
                                className={cn(
                                    TOOL_BTN_CLASS,
                                    fft.interactionMode === "pan"
                                        ? TOOL_BTN_ACTIVE_CLASS
                                        : TOOL_BTN_INACTIVE_CLASS
                                )}
                            >
                                <Hand className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">
                                    {t("Pan", { ns: "keywords" })}
                                </span>
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label
                            htmlFor="fft-brush-size"
                            className="text-xs font-medium"
                        >
                            {t("Brush size", { ns: "keywords" })}
                        </Label>
                        <div className="flex items-center gap-3">
                            <Input
                                id="fft-brush-size"
                                type="range"
                                min="2"
                                max="64"
                                value={fft.brushSize}
                                onChange={e =>
                                    fft.setBrushSize(Number(e.target.value))
                                }
                                className="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                            />
                            <span className="text-xs text-muted-foreground min-w-[2.5rem] text-right">
                                {fft.brushSize}px
                            </span>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label
                            htmlFor="fft-brush-shape"
                            className="text-xs font-medium"
                        >
                            {t("Shape", { ns: "keywords" })}
                        </Label>
                        <select
                            id="fft-brush-shape"
                            value={fft.brushShape}
                            onChange={e =>
                                fft.setBrushShape(
                                    e.target.value as "circle" | "oval"
                                )
                            }
                            className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                            <option value="circle">
                                {t("Round", { ns: "keywords" })}
                            </option>
                            <option value="oval">
                                {t("Oval", { ns: "keywords" })}
                            </option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-2 pt-2 border-t border-border/20">
                        <Button
                            onClick={fft.clearMask}
                            variant="outline"
                            size="sm"
                            className="w-full"
                        >
                            <Trash2 size={ICON.SIZE - 2} className="mr-1.5" />
                            {t("Clear", { ns: "keywords" })}
                        </Button>
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={onCancel}
                                variant="secondary"
                                size="sm"
                                className="flex-1"
                            >
                                <X size={ICON.SIZE - 2} className="mr-1.5" />
                                {t("Cancel", { ns: "keywords" })}
                            </Button>
                            <Button
                                onClick={fft.applyFilter}
                                variant="default"
                                size="sm"
                                className="flex-1"
                            >
                                <Check
                                    size={ICON.SIZE - 2}
                                    className="mr-1.5"
                                />
                                {t("Apply", { ns: "keywords" })}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
