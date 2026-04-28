import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/shadcn";
import { Edit3, Hand, Waves, Trash2 } from "lucide-react";
import { ICON } from "@/lib/utils/const";
import { UseFftWorkspaceReturn } from "../hooks/useFftWorkspace";

interface SidebarFFTProps {
    isFftActive: boolean;
    setIsFftActive: (active: boolean) => void;
    fft: UseFftWorkspaceReturn;
}

export function SidebarFFT({
    isFftActive,
    setIsFftActive,
    fft,
}: SidebarFFTProps) {
    const { t } = useTranslation(["tooltip", "keywords"]);

    return (
        <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-muted-foreground">FFT</h3>
            <div className="space-y-3 w-full">
                <Button
                    onClick={() => setIsFftActive(!isFftActive)}
                    variant={isFftActive ? "destructive" : "default"}
                    className="flex items-center justify-center gap-2 w-full"
                    disabled={
                        fft.status === "loading" || fft.status === "processing"
                    }
                >
                    <Waves size={ICON.SIZE} />
                    {t("FFT Filter", { ns: "tooltip" })}
                </Button>

                {isFftActive && fft.status === "loading" && (
                    <span className="text-xs animate-pulse text-blue-400">
                        {t("Loading...", { ns: "keywords" })}
                    </span>
                )}
                {isFftActive && fft.status === "processing" && (
                    <span className="text-xs animate-pulse text-primary">
                        {t("Processing...", { ns: "keywords" })}
                    </span>
                )}
                {isFftActive && fft.status === "ready" && (
                    <>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex bg-secondary/50 p-1 rounded-lg gap-1">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            fft.setInteractionMode("draw")
                                        }
                                        className={cn(
                                            "flex-1 flex items-center justify-center gap-2 py-1.5 px-2 rounded-md transition-all text-xs font-medium",
                                            fft.interactionMode !== "pan"
                                                ? "bg-background shadow-sm text-foreground"
                                                : "text-muted-foreground hover:bg-secondary/80 hover:text-secondary-foreground"
                                        )}
                                    >
                                        <Edit3 className="w-4 h-4" />
                                        {t("Draw", { ns: "keywords" })}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            fft.setInteractionMode("pan")
                                        }
                                        className={cn(
                                            "flex-1 flex items-center justify-center gap-2 py-1.5 px-2 rounded-md transition-all text-xs font-medium",
                                            fft.interactionMode === "pan"
                                                ? "bg-background shadow-sm text-foreground"
                                                : "text-muted-foreground hover:bg-secondary/80 hover:text-secondary-foreground"
                                        )}
                                    >
                                        <Hand className="w-4 h-4" />
                                        {t("Pan", { ns: "keywords" })}
                                    </button>
                                </div>
                                <Button
                                    type="button"
                                    variant={
                                        fft.interactionMode === "erase"
                                            ? "default"
                                            : "outline"
                                    }
                                    size="sm"
                                    className="w-full"
                                    onClick={() =>
                                        fft.setInteractionMode(
                                            fft.interactionMode === "erase"
                                                ? "draw"
                                                : "erase"
                                        )
                                    }
                                >
                                    {t("Eraser", { ns: "keywords" })}
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <Label
                                    htmlFor="fft-brush-size"
                                    className="text-sm font-medium"
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
                                            fft.setBrushSize(
                                                Number(e.target.value)
                                            )
                                        }
                                        className="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                                    />
                                    <span className="text-sm text-muted-foreground min-w-[3rem] text-right">
                                        {fft.brushSize}px
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label
                                    htmlFor="fft-brush-shape"
                                    className="text-sm font-medium"
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
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                    <option value="circle">
                                        {t("Round", { ns: "keywords" })}
                                    </option>
                                    <option value="oval">
                                        {t("Oval", { ns: "keywords" })}
                                    </option>
                                </select>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 pt-2">
                            <Button
                                onClick={fft.clearMask}
                                variant="outline"
                                className="w-full"
                            >
                                <Trash2 size={ICON.SIZE} className="mr-2" />
                                {t("Clear", { ns: "keywords" })}
                            </Button>
                            <Button
                                onClick={fft.applyFilter}
                                variant="default"
                                className="w-full"
                            >
                                {t("Apply", { ns: "keywords" })}
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
