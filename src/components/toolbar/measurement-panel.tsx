import { Button } from "@/components/ui/button";
import { MeasurementStore } from "@/lib/stores/Measurement/Measurement";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils/shadcn";
import { HTMLAttributes } from "react";
import { Check, X } from "lucide-react";
import { ICON } from "@/lib/utils/const";

export type MeasurementPanelProps = HTMLAttributes<HTMLDivElement>;

export function MeasurementPanel({
    className,
    ...props
}: MeasurementPanelProps) {
    const { t } = useTranslation();

    const leftLine = MeasurementStore.use(
        state => state.finishedLines[CANVAS_ID.LEFT]
    );
    const rightLine = MeasurementStore.use(
        state => state.finishedLines[CANVAS_ID.RIGHT]
    );

    const leftLineExists = leftLine !== null;
    const rightLineExists = rightLine !== null;

    const formatDistance = (line: typeof leftLine) => {
        if (!line) return null;
        const dx = line.endpoint.x - line.origin.x;
        const dy = line.endpoint.y - line.origin.y;
        return Math.sqrt(dx * dx + dy * dy).toFixed(2);
    };

    const handleClearAll = () => {
        MeasurementStore.actions.clearAll();
    };

    const handleClearLeft = () => {
        MeasurementStore.actions.clearLine(CANVAS_ID.LEFT);
    };

    const handleClearRight = () => {
        MeasurementStore.actions.clearLine(CANVAS_ID.RIGHT);
    };

    return (
        <div
            className={cn(
                "flex flex-col gap-3 p-3 glass rounded-xl",
                className
            )}
            {...props}
        >
            <p className="text-xs text-muted-foreground leading-relaxed">
                {t("Measurement instructions", { ns: "tooltip" })}
            </p>

            <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                        <span className="font-semibold">L</span>
                        {leftLineExists ? (
                            <Check
                                size={ICON.SIZE}
                                strokeWidth={ICON.STROKE_WIDTH}
                                className="text-green-500"
                            />
                        ) : (
                            <X
                                size={ICON.SIZE}
                                strokeWidth={ICON.STROKE_WIDTH}
                                className="text-muted-foreground"
                            />
                        )}
                        {leftLineExists && (
                            <span className="text-xs text-muted-foreground">
                                {formatDistance(leftLine)} px
                            </span>
                        )}
                    </div>
                    {leftLineExists && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={handleClearLeft}
                        >
                            <X size={12} strokeWidth={ICON.STROKE_WIDTH} />
                        </Button>
                    )}
                </div>
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                        <span className="font-semibold">P</span>
                        {rightLineExists ? (
                            <Check
                                size={ICON.SIZE}
                                strokeWidth={ICON.STROKE_WIDTH}
                                className="text-green-500"
                            />
                        ) : (
                            <X
                                size={ICON.SIZE}
                                strokeWidth={ICON.STROKE_WIDTH}
                                className="text-muted-foreground"
                            />
                        )}
                        {rightLineExists && (
                            <span className="text-xs text-muted-foreground">
                                {formatDistance(rightLine)} px
                            </span>
                        )}
                    </div>
                    {rightLineExists && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={handleClearRight}
                        >
                            <X size={12} strokeWidth={ICON.STROKE_WIDTH} />
                        </Button>
                    )}
                </div>
            </div>

            <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleClearAll}
                disabled={!leftLineExists && !rightLineExists}
            >
                {t("Clear measurement", { ns: "tooltip" })}
            </Button>
        </div>
    );
}
