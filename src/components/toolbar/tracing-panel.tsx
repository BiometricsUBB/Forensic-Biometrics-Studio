import { Label } from "@/components/ui/label";
import { DashboardToolbarStore } from "@/lib/stores/DashboardToolbar";
import { cn } from "@/lib/utils/shadcn";
import { Check, Edit3, Minus, RotateCcw, RotateCw } from "lucide-react";
import { HTMLAttributes } from "react";
import { useTranslation } from "react-i18next";

const PRESET_COLORS = [
    "#ff0000",
    "#00ff00",
    "#0000ff",
    "#ffff00",
    "#00ffff",
    "#ff00ff",
    "#ffffff",
    "#000000",
];

export type TracingPanelProps = HTMLAttributes<HTMLDivElement>;

export function TracingPanel({ className, ...props }: TracingPanelProps) {
    const { t } = useTranslation();

    const { color, opacity, brushSize, mode } = DashboardToolbarStore.use(
        state =>
            state.settings.tracing ?? {
                color: "#ff0000",
                opacity: 1,
                brushSize: 2,
                mode: "free",
            }
    );

    const { setColor, setOpacity, setBrushSize, setMode } =
        DashboardToolbarStore.actions.settings.tracing;

    return (
        <div
            className={cn(
                "flex flex-col gap-3 p-3 glass rounded-xl border border-border/40 bg-card/50",
                className
            )}
            {...props}
        >
            <div className="flex bg-secondary/50 p-1 rounded-lg gap-1">
                <button
                    type="button"
                    onClick={() => setMode("free")}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-1.5 px-2 rounded-md transition-all text-xs font-medium",
                        mode === "free"
                            ? "bg-background shadow-sm text-foreground"
                            : "text-muted-foreground hover:bg-secondary/80 hover:text-secondary-foreground"
                    )}
                >
                    <Edit3 className="w-4 h-4" />
                    {t("Free", { ns: "keywords" } as unknown as string)}
                </button>
                <button
                    type="button"
                    onClick={() => setMode("line")}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-1.5 px-2 rounded-md transition-all text-xs font-medium",
                        mode === "line"
                            ? "bg-background shadow-sm text-foreground"
                            : "text-muted-foreground hover:bg-secondary/80 hover:text-secondary-foreground"
                    )}
                >
                    <Minus className="w-4 h-4 rotate-45" />
                    {t("Line", { ns: "keywords" } as unknown as string)}
                </button>
            </div>

            {mode === "line" && (
                <p className="text-[10px] text-muted-foreground leading-tight px-1 text-center">
                    {t("Line mode instruction", {
                        ns: "tooltip",
                    } as unknown as string)}
                </p>
            )}

            <div className="flex gap-1">
                <button
                    type="button"
                    // Placeholder for undo - implies we need a way to trigger it
                    onClick={() =>
                        window.dispatchEvent(new CustomEvent("tracing:undo"))
                    }
                    className="flex-1 flex items-center justify-center gap-2 py-1.5 px-2 rounded-md transition-all text-xs font-medium text-muted-foreground hover:bg-secondary/80 hover:text-secondary-foreground"
                >
                    <RotateCcw className="w-4 h-4" />
                    {t("Undo", { ns: "keywords" } as unknown as string)}
                </button>
                <button
                    type="button"
                    // Placeholder for redo
                    onClick={() =>
                        window.dispatchEvent(new CustomEvent("tracing:redo"))
                    }
                    className="flex-1 flex items-center justify-center gap-2 py-1.5 px-2 rounded-md transition-all text-xs font-medium text-muted-foreground hover:bg-secondary/80 hover:text-secondary-foreground"
                >
                    <RotateCw className="w-4 h-4" />
                    {t("Redo", { ns: "keywords" } as unknown as string)}
                </button>
            </div>

            <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold">
                    {t("Color", { ns: "keywords" } as unknown as string)}
                </Label>
                <div className="flex gap-2 items-center">
                    <input
                        type="color"
                        value={color}
                        onChange={e => setColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0"
                    />
                    <span className="text-xs text-muted-foreground font-mono">
                        {color.toUpperCase()}
                    </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                    {PRESET_COLORS.map(presetColor => (
                        <button
                            key={presetColor}
                            type="button"
                            onClick={() => setColor(presetColor)}
                            className={cn(
                                "w-6 h-6 rounded-md border border-border/50 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                                color === presetColor &&
                                    "ring-2 ring-ring ring-offset-1"
                            )}
                            style={{ backgroundColor: presetColor }}
                            aria-label={`Select color ${presetColor}`}
                        >
                            {color === presetColor && (
                                <Check
                                    className={cn(
                                        "w-4 h-4 mx-auto",
                                        // Invert color for contrast
                                        [
                                            "#ffffff",
                                            "#ffff00",
                                            "#00ffff",
                                        ].includes(presetColor)
                                            ? "text-black"
                                            : "text-white"
                                    )}
                                />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                    <Label className="text-xs font-semibold">
                        {t("Opacity", { ns: "keywords" } as unknown as string)}
                    </Label>
                    <span className="text-xs text-muted-foreground w-8 text-right">
                        {Math.round(opacity * 100)}%
                    </span>
                </div>
                <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={opacity}
                    onChange={e => setOpacity(Number(e.target.value))}
                    className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                />
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                    <Label className="text-xs font-semibold">
                        {t("Thickness", {
                            ns: "keywords",
                        } as unknown as string)}
                    </Label>
                    <span className="text-xs text-muted-foreground w-8 text-right">
                        {brushSize}px
                    </span>
                </div>
                <input
                    type="range"
                    min="1"
                    max="20"
                    step="1"
                    value={brushSize}
                    onChange={e => setBrushSize(Number(e.target.value))}
                    className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                />
            </div>
        </div>
    );
}
