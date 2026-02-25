import { Button } from "@/components/ui/button";
import { AutoRotateStore } from "@/lib/stores/AutoRotate/AutoRotate";
import { RotationStore } from "@/lib/stores/Rotation/Rotation";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils/shadcn";
import { HTMLAttributes } from "react";
import { Check, X } from "lucide-react";
import { ICON } from "@/lib/utils/const";

export type RotationPanelProps = HTMLAttributes<HTMLDivElement>;

export function RotationPanel({ className, ...props }: RotationPanelProps) {
    const { t } = useTranslation();

    const finishedLines = AutoRotateStore.use(state => state.finishedLines);

    const leftLineExists = finishedLines[CANVAS_ID.LEFT] !== null;
    const rightLineExists = finishedLines[CANVAS_ID.RIGHT] !== null;

    const canApplyRotation = leftLineExists && rightLineExists;

    const handleApplyRotation = () => {
        if (canApplyRotation) {
            AutoRotateStore.actions.applyRotation();
        }
    };

    const handleResetRotation = () => {
        RotationStore(CANVAS_ID.LEFT).actions.resetRotation();
        RotationStore(CANVAS_ID.RIGHT).actions.resetRotation();
        AutoRotateStore.actions.resetFinishedLines();
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
                {t("Rotation instructions", { ns: "tooltip" })}
            </p>

            <div className="flex items-center justify-center gap-4 text-sm">
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
                </div>
                <span className="text-muted-foreground">|</span>
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
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={!canApplyRotation}
                    onClick={handleApplyRotation}
                >
                    {t("Calculate and align", { ns: "tooltip" })}
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleResetRotation}
                >
                    {t("Reset rotation panel", { ns: "tooltip" })}
                </Button>
            </div>
        </div>
    );
}
