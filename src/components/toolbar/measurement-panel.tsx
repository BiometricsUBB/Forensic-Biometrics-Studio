import { Button } from "@/components/ui/button";
import { MeasurementStore } from "@/lib/stores/Measurement/Measurement";
import { AreaStore } from "@/lib/stores/Area/Area";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import {
    calcLinePixels,
    calcPolygonArea,
    convertPx,
    convertPxArea,
    DEFAULT_DPI,
    DISTANCE_UNITS,
    DistanceUnit,
} from "@/lib/utils/measurement/distance";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils/shadcn";
import { HTMLAttributes, useState } from "react";
import { Check, Ruler, Shapes, X } from "lucide-react";
import { ICON } from "@/lib/utils/const";
import {
    CURSOR_MODES,
    DashboardToolbarStore,
} from "@/lib/stores/DashboardToolbar";
import { Point } from "@/lib/markings/Point";

type UnitSelectorProps = {
    value: DistanceUnit;
    onChange: (unit: DistanceUnit) => void;
    squared?: boolean;
};

function UnitSelector({ value, onChange, squared = false }: UnitSelectorProps) {
    return (
        <select
            value={value}
            onChange={e => onChange(e.target.value as DistanceUnit)}
            className="rounded border border-border bg-background px-1 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
            {DISTANCE_UNITS.map(u => (
                <option key={u} value={u}>
                    {squared ? (u === "px" ? "px²" : `${u}²`) : u}
                </option>
            ))}
        </select>
    );
}

type LineRowProps = {
    label: string;
    lineExists: boolean;
    px: number;
    unit: DistanceUnit;
    dpi: number;
    canvasId: CANVAS_ID;
};

function LineRow({ label, lineExists, px, unit, dpi, canvasId }: LineRowProps) {
    return (
        <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
                <span className="font-semibold">{label}</span>
                {lineExists ? (
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
                {lineExists && (
                    <span className="text-xs text-muted-foreground">
                        {convertPx(px, unit, dpi)} {unit}
                    </span>
                )}
            </div>
            {lineExists && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => MeasurementStore.actions.clearLine(canvasId)}
                >
                    <X size={12} strokeWidth={ICON.STROKE_WIDTH} />
                </Button>
            )}
        </div>
    );
}

type AreaCanvasRowProps = {
    label: string;
    tempPoints: Point[];
    finished: Point[] | null;
    unit: DistanceUnit;
    dpi: number;
    canvasId: CANVAS_ID;
};

function AreaCanvasRow({
    label,
    tempPoints,
    finished,
    unit,
    dpi,
    canvasId,
}: AreaCanvasRowProps) {
    const { t } = useTranslation();
    const isDrawing = tempPoints.length > 0;
    const hasResult = finished !== null && finished.length >= 3;

    if (!isDrawing && !hasResult) return null;

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">{label}</span>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => AreaStore.actions.clearCanvas(canvasId)}
                >
                    ×
                </Button>
            </div>
            {isDrawing && !hasResult && (
                <p className="text-xs text-muted-foreground pl-1">
                    {t("Drawing", { ns: "tooltip" })}: {tempPoints.length}{" "}
                    {t("Points", { ns: "tooltip" })}
                </p>
            )}
            {hasResult && finished && (
                <div className="flex justify-between pl-1">
                    <span className="text-xs text-muted-foreground">
                        {t("Area", { ns: "tooltip" })}:
                    </span>
                    <span className="font-mono text-xs font-medium">
                        {convertPxArea(calcPolygonArea(finished), unit, dpi)}{" "}
                        {unit === "px" ? "px²" : `${unit}²`}
                    </span>
                </div>
            )}
        </div>
    );
}

type AreaModeSectionProps = {
    unit: DistanceUnit;
    setUnit: (unit: DistanceUnit) => void;
    dpi: number;
};

function AreaModeSection({ unit, setUnit, dpi }: AreaModeSectionProps) {
    const { t } = useTranslation();

    const leftTempPoints = AreaStore.use(
        state => state.tempPoints[CANVAS_ID.LEFT]
    );
    const rightTempPoints = AreaStore.use(
        state => state.tempPoints[CANVAS_ID.RIGHT]
    );
    const leftFinished = AreaStore.use(
        state => state.finishedPolygon[CANVAS_ID.LEFT]
    );
    const rightFinished = AreaStore.use(
        state => state.finishedPolygon[CANVAS_ID.RIGHT]
    );

    const leftHasResult = leftFinished !== null && leftFinished.length >= 3;
    const rightHasResult = rightFinished !== null && rightFinished.length >= 3;
    const hasAnyArea =
        leftTempPoints.length > 0 ||
        rightTempPoints.length > 0 ||
        leftHasResult ||
        rightHasResult;

    return (
        <>
            <p className="text-xs text-muted-foreground leading-relaxed">
                {t("Area instructions", { ns: "tooltip" })}
            </p>

            {hasAnyArea && (
                <div className="flex flex-col gap-2 text-sm">
                    <AreaCanvasRow
                        label={t("LeftCanvasLabel", { ns: "tooltip" })}
                        tempPoints={leftTempPoints}
                        finished={leftFinished}
                        unit={unit}
                        dpi={dpi}
                        canvasId={CANVAS_ID.LEFT}
                    />
                    <AreaCanvasRow
                        label={t("RightCanvasLabel", { ns: "tooltip" })}
                        tempPoints={rightTempPoints}
                        finished={rightFinished}
                        unit={unit}
                        dpi={dpi}
                        canvasId={CANVAS_ID.RIGHT}
                    />

                    {(leftHasResult || rightHasResult) && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="shrink-0">
                                {t("Unit", { ns: "tooltip" })}:
                            </span>
                            <UnitSelector
                                value={unit}
                                onChange={setUnit}
                                squared
                            />
                        </div>
                    )}
                </div>
            )}

            {hasAnyArea && (
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => AreaStore.actions.clearAll()}
                >
                    {t("Clear area", { ns: "tooltip" })}
                </Button>
            )}
        </>
    );
}

export type MeasurementPanelProps = HTMLAttributes<HTMLDivElement>;

export function MeasurementPanel({
    className,
    ...props
}: MeasurementPanelProps) {
    const { t } = useTranslation();
    const [unit, setUnit] = useState<DistanceUnit>("px");
    const [dpi, setDpi] = useState(DEFAULT_DPI);

    const cursorMode = DashboardToolbarStore.use(
        state => state.settings.cursor.mode
    );
    const isAreaMode = cursorMode === CURSOR_MODES.AREA;

    const leftLine = MeasurementStore.use(
        state => state.finishedLines[CANVAS_ID.LEFT]
    );
    const rightLine = MeasurementStore.use(
        state => state.finishedLines[CANVAS_ID.RIGHT]
    );
    const leftLineExists = leftLine !== null;
    const rightLineExists = rightLine !== null;

    const leftPx = calcLinePixels(leftLine) ?? 0;
    const rightPx = calcLinePixels(rightLine) ?? 0;

    return (
        <div
            className={cn(
                "flex flex-col gap-3 p-3 glass rounded-xl",
                className
            )}
            {...props}
        >
            <div className="flex bg-secondary/50 p-1 rounded-lg gap-1">
                <button
                    type="button"
                    onClick={() =>
                        DashboardToolbarStore.actions.settings.cursor.setCursorMode(
                            CURSOR_MODES.MEASUREMENT
                        )
                    }
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-1.5 px-2 rounded-md transition-all text-xs font-medium",
                        !isAreaMode
                            ? "bg-background shadow-sm text-foreground"
                            : "text-muted-foreground hover:bg-secondary/80 hover:text-secondary-foreground"
                    )}
                >
                    <Ruler className="w-4 h-4" />
                    {t("Ruler", { ns: "tooltip" })}
                </button>
                <button
                    type="button"
                    onClick={() =>
                        DashboardToolbarStore.actions.settings.cursor.setCursorMode(
                            CURSOR_MODES.AREA
                        )
                    }
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-1.5 px-2 rounded-md transition-all text-xs font-medium",
                        isAreaMode
                            ? "bg-background shadow-sm text-foreground"
                            : "text-muted-foreground hover:bg-secondary/80 hover:text-secondary-foreground"
                    )}
                >
                    <Shapes className="w-4 h-4" />
                    {t("Area", { ns: "tooltip" })}
                </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="shrink-0">{t("DPI", { ns: "tooltip" })}:</span>
                <input
                    type="number"
                    min={1}
                    value={dpi}
                    onChange={e => {
                        const val = parseInt(e.target.value, 10);
                        if (val > 0) setDpi(val);
                    }}
                    className="w-16 rounded border border-border bg-background px-1 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
            </div>

            {!isAreaMode && (
                <>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        {t("Measurement instructions", { ns: "tooltip" })}
                    </p>

                    <div className="flex flex-col gap-2 text-sm">
                        <LineRow
                            label={t("LeftCanvasLabel", { ns: "tooltip" })}
                            lineExists={leftLineExists}
                            px={leftPx}
                            unit={unit}
                            dpi={dpi}
                            canvasId={CANVAS_ID.LEFT}
                        />
                        <LineRow
                            label={t("RightCanvasLabel", { ns: "tooltip" })}
                            lineExists={rightLineExists}
                            px={rightPx}
                            unit={unit}
                            dpi={dpi}
                            canvasId={CANVAS_ID.RIGHT}
                        />
                    </div>

                    {(leftLineExists || rightLineExists) && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="shrink-0">
                                {t("Unit", { ns: "tooltip" })}:
                            </span>
                            <UnitSelector value={unit} onChange={setUnit} />
                        </div>
                    )}

                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => MeasurementStore.actions.clearAll()}
                        disabled={!leftLineExists && !rightLineExists}
                    >
                        {t("Clear measurement", { ns: "tooltip" })}
                    </Button>
                </>
            )}

            {isAreaMode && (
                <AreaModeSection unit={unit} setUnit={setUnit} dpi={dpi} />
            )}
        </div>
    );
}
