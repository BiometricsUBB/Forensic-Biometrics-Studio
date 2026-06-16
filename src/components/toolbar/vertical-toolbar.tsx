import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/shadcn";
import { HTMLAttributes, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { MarkingsStore } from "@/lib/stores/Markings";
import { matchWithSourceafis } from "@/lib/utils/viewport/autoMarkWithSourceafis";
import {
    CURSOR_MODES,
    DashboardToolbarStore,
} from "@/lib/stores/DashboardToolbar";
import {
    Hand,
    LockKeyhole,
    LockKeyholeOpen,
    SendToBack,
    ChevronDown,
    RotateCw,
    Crosshair,
    Settings,
    Brush,
    Ruler,
    Eye,
    EyeOff,
    Wand2,
} from "lucide-react";
import { ICON } from "@/lib/utils/const";
import { useTranslation } from "react-i18next";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { WorkingModeStore } from "@/lib/stores/WorkingMode";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuPortal,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReportDialog } from "@/components/dialogs/report/report-dialog";
import { KeybindingsStore } from "@/lib/stores/Keybindings";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useFormatCombo } from "@/lib/hooks/useKeyboardLayout";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { RotationPanel } from "./rotation-panel";
import { TracingPanel } from "./tracing-panel";
import { MeasurementPanel } from "./measurement-panel";
import { getCanvas } from "../pixi/canvas/hooks/useCanvas";

interface SourceAfisMinutia {
    x: number;
    y: number;
    type: "bifurcation" | "ending" | string;
}

interface SourceAfisData {
    leftMinutiae: SourceAfisMinutia[];
    rightMinutiae: SourceAfisMinutia[];
    matchScore: number;
}

interface AppMarking {
    id: string;
    typeId: string;
    label: string | number;
    x?: number;
    y?: number;
    origin?: { x: number; y: number };
    position?: { x: number; y: number };
}

interface ManualPair {
    left: AppMarking;
    right: AppMarking;
    lX: number;
    lY: number;
    rX: number;
    rY: number;
}

interface ValidPair {
    left: SourceAfisMinutia;
    right: SourceAfisMinutia;
    dist: number;
}

function detectCoordinatePath(obj: AppMarking) {
    if (obj.origin && typeof obj.origin.x === "number") {
        return { x: obj.origin.x, y: obj.origin.y, path: "origin" };
    }
    if (obj.position && typeof obj.position.x === "number") {
        return { x: obj.position.x, y: obj.position.y, path: "position" };
    }
    if (typeof obj.x === "number" && typeof obj.y === "number") {
        return { x: obj.x, y: obj.y, path: "plain" };
    }
    return { x: 0, y: 0, path: "unknown" };
}

function getProcrustesTransform(manualPairs: ManualPair[]) {
    let bestTheta = 0;
    let bestTx = 0;
    let bestTy = 0;

    if (manualPairs.length >= 2) {
        let sumLx = 0;
        let sumLy = 0;
        let sumRx = 0;
        let sumRy = 0;
        manualPairs.forEach(p => {
            sumLx += p.lX;
            sumLy += p.lY;
            sumRx += p.rX;
            sumRy += p.rY;
        });
        const cLx = sumLx / manualPairs.length;
        const cLy = sumLy / manualPairs.length;
        const cRx = sumRx / manualPairs.length;
        const cRy = sumRy / manualPairs.length;

        let sxx = 0;
        let sxy = 0;
        let syx = 0;
        let syy = 0;
        manualPairs.forEach(p => {
            const plx = p.lX - cLx;
            const ply = p.lY - cLy;
            const prx = p.rX - cRx;
            const pry = p.rY - cRy;
            sxx += plx * prx;
            sxy += plx * pry;
            syx += ply * prx;
            syy += ply * pry;
        });

        bestTheta = Math.atan2(sxy - syx, sxx + syy);
        bestTx = cRx - (cLx * Math.cos(bestTheta) - cLy * Math.sin(bestTheta));
        bestTy = cRy - (cLx * Math.sin(bestTheta) + cLy * Math.cos(bestTheta));
    }

    return { bestTheta, bestTx, bestTy };
}

function matchAutomatedMinutiae(
    leftMinutiae: SourceAfisMinutia[],
    rightMinutiae: SourceAfisMinutia[],
    manualPairs: ManualPair[],
    transform: { bestTheta: number; bestTx: number; bestTy: number }
): ValidPair[] {
    const validPairs: ValidPair[] = [];
    const STRICT_PROG = 45;
    const { bestTheta, bestTx, bestTy } = transform;

    leftMinutiae.forEach(l => {
        const isAlreadyManual = manualPairs.some(
            p => Math.sqrt((p.lX - l.x) ** 2 + (p.lY - l.y) ** 2) < 15
        );
        if (isAlreadyManual) return;

        const transX =
            l.x * Math.cos(bestTheta) - l.y * Math.sin(bestTheta) + bestTx;
        const transY =
            l.x * Math.sin(bestTheta) + l.y * Math.cos(bestTheta) + bestTy;

        let closestRight: SourceAfisMinutia | null = null;
        let minDistance = Infinity;

        rightMinutiae.forEach(r => {
            if (l.type === r.type) {
                const isRightManual = manualPairs.some(
                    p => Math.sqrt((p.rX - r.x) ** 2 + (p.rY - r.y) ** 2) < 15
                );
                if (isRightManual) return;

                const d = Math.sqrt((transX - r.x) ** 2 + (transY - r.y) ** 2);
                if (d < minDistance) {
                    minDistance = d;
                    closestRight = r;
                }
            }
        });

        if (closestRight && minDistance < STRICT_PROG) {
            validPairs.push({
                left: l,
                right: closestRight,
                dist: minDistance,
            });
        }
    });

    return validPairs.sort((a, b) => a.dist - b.dist);
}

function createTransformedMarkings(
    automatedPairs: ValidPair[],
    leftCore: AppMarking,
    rightCore: AppMarking,
    maxCurrentLabel: number,
    bifurcationTypeId: string,
    endingTypeId: string
) {
    const clonedLeft: unknown[] = [];
    const clonedRight: unknown[] = [];

    const LeftConstructor = leftCore.constructor as new () => Record<
        string,
        unknown
    >;
    const RightConstructor = rightCore.constructor as new () => Record<
        string,
        unknown
    >;

    automatedPairs.forEach((pair, index) => {
        const nextLabel = maxCurrentLabel + index + 1;

        const leftClone = new LeftConstructor();

        /* eslint-disable-next-line security/detect-object-injection */
        Object.keys(leftCore).forEach(key => {
            if (
                !key.startsWith("_") &&
                key !== "transform" &&
                key !== "parent" &&
                key !== "children"
            ) {
                /* eslint-disable-next-line security/detect-object-injection */
                leftClone[key] = (
                    leftCore as unknown as Record<string, unknown>
                )[key];
            }
        });

        leftClone["id"] = crypto.randomUUID();
        leftClone["typeId"] =
            pair.left.type === "bifurcation" ? bifurcationTypeId : endingTypeId;
        leftClone["label"] = nextLabel;
        leftClone["origin"] = { x: pair.left.x, y: pair.left.y };

        const rightClone = new RightConstructor();

        /* eslint-disable-next-line security/detect-object-injection */
        Object.keys(rightCore).forEach(key => {
            if (
                !key.startsWith("_") &&
                key !== "transform" &&
                key !== "parent" &&
                key !== "children"
            ) {
                /* eslint-disable-next-line security/detect-object-injection */
                rightClone[key] = (
                    rightCore as unknown as Record<string, unknown>
                )[key];
            }
        });

        rightClone["id"] = crypto.randomUUID();
        rightClone["typeId"] =
            pair.right.type === "bifurcation"
                ? bifurcationTypeId
                : endingTypeId;
        rightClone["label"] = nextLabel;
        rightClone["origin"] = { x: pair.right.x, y: pair.right.y };

        clonedLeft.push(leftClone);
        clonedRight.push(rightClone);
    });

    return { clonedLeft, clonedRight };
}

export type VerticalToolbarProps = HTMLAttributes<HTMLDivElement>;

export function VerticalToolbar({ className, ...props }: VerticalToolbarProps) {
    const { t } = useTranslation();
    const formatCombo = useFormatCombo();
    const [afisLimit, setAfisLimit] = useState<number>(20);
    const collapsiblePanelTransitionClass =
        "overflow-hidden transition-all duration-300 ease-in-out";
    const collapsiblePanelExpandedClass = "max-h-96 opacity-100 mt-2";
    const collapsiblePanelCollapsedClass = "max-h-0 opacity-0";

    const allMarkingTypes = MarkingTypesStore.use(state => state.types);

    const coreType = allMarkingTypes.find(type => {
        const name = (type.name || "").toLowerCase();
        const display = (type.displayName || "").toLowerCase();
        return name.includes("core") || display.includes("core");
    });
    const coreTypeId = coreType?.id;
    const rozwidlenieType = allMarkingTypes.find(type => {
        const name = (type.name || "").toLowerCase();
        const display = (type.displayName || "").toLowerCase();
        return (
            name.includes("rozwidlenie") ||
            display.includes("rozwidlenie") ||
            name.includes("bifurcation") ||
            display.includes("bifurcation")
        );
    });
    const zakonczenieType = allMarkingTypes.find(type => {
        const name = (type.name || "").toLowerCase();
        const display = (type.displayName || "").toLowerCase();
        return (
            name.includes("zakończenie") ||
            name.includes("zakoncenie") ||
            display.includes("zakończenie") ||
            display.includes("zakoncenie") ||
            name.includes("ending") ||
            display.includes("ending")
        );
    });

    const nonCoreTypes = allMarkingTypes.filter(t => t.id !== coreTypeId);

    const rozwidlenieTypeId =
        rozwidlenieType?.id || nonCoreTypes[0]?.id || allMarkingTypes[0]?.id;
    const zakonczenieTypeId =
        zakonczenieType?.id ||
        nonCoreTypes[1]?.id ||
        nonCoreTypes[0]?.id ||
        allMarkingTypes[0]?.id;

    console.log(
        "SŁOWNIK TYPÓW ADNOTACJI W APLIKACJI",
        allMarkingTypes.map(t => ({
            id: t.id,
            name: t.name,
            displayName: t.displayName,
        }))
    );
    console.log(
        "Przypisane ID robocze -> Rozwidlenie:",
        rozwidlenieTypeId,
        "Zakończenie:",
        zakonczenieTypeId
    );

    const leftMarkings = MarkingsStore(CANVAS_ID.LEFT).use(
        state => state.markings
    );
    const rightMarkings = MarkingsStore(CANVAS_ID.RIGHT).use(
        state => state.markings
    );

    const leftCore = leftMarkings.find(m => m.typeId === coreTypeId);
    const rightCore = rightMarkings.find(m => m.typeId === coreTypeId);
    const isCoreMarkedOnBoth = !!leftCore && !!rightCore;

    const currentManualPairsCount = leftMarkings.filter(lm =>
        rightMarkings.some(rm => rm.label === lm.label)
    ).length;

    const isValidationPassed =
        isCoreMarkedOnBoth && currentManualPairsCount >= 4;

    const { mode: cursorMode } = DashboardToolbarStore.use(
        state => state.settings.cursor
    );

    const {
        locked: isViewportLocked,
        scaleSync: isViewportScaleSync,
        rotationSync: isRotationSync,
    } = DashboardToolbarStore.use(state => state.settings.viewport);

    const selectedTypeId = MarkingTypesStore.use(state => state.selectedTypeId);
    const hiddenTypes = MarkingTypesStore.use(state => state.hiddenTypes);

    const workingMode = WorkingModeStore.use(state => state.workingMode);

    const keybindings = KeybindingsStore.use(state => state.typesKeybindings);

    const availableMarkingTypes = useMemo(
        () =>
            workingMode
                ? allMarkingTypes.filter(type => type.category === workingMode)
                : [],
        [allMarkingTypes, workingMode]
    );

    const openTypesSettings = async () => {
        try {
            await invoke("open_settings_window", {
                category: "marking-types",
                workingMode,
            });
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error("Failed to open settings window:", error);
        }
    };

    const selectedMarkingType = useMemo(
        () => availableMarkingTypes.find(type => type.id === selectedTypeId),
        [availableMarkingTypes, selectedTypeId]
    );

    useEffect(() => {
        if (!selectedTypeId) {
            return;
        }

        const selectedTypeExistsInCurrentMode = availableMarkingTypes.some(
            type => type.id === selectedTypeId
        );

        if (!selectedTypeExistsInCurrentMode) {
            MarkingTypesStore.actions.selectedType.set(null);
        }
    }, [availableMarkingTypes, selectedTypeId]);

    return (
        <div
            className={cn(
                "flex flex-col gap-2 p-2 pb-24 h-full overflow-y-auto",
                className
            )}
            {...props}
        >
            <div className="flex flex-col gap-1">
                <h3 className="text-xs font-semibold">
                    {t("Control", { ns: "keywords" })}
                </h3>
                <ToggleGroup
                    type="single"
                    value={cursorMode}
                    className="flex flex-col gap-0.5"
                >
                    <ToggleGroupItem
                        value={CURSOR_MODES.SELECTION}
                        className="w-full justify-start gap-2"
                        onClick={() => {
                            DashboardToolbarStore.actions.settings.cursor.setCursorMode(
                                CURSOR_MODES.SELECTION
                            );
                        }}
                    >
                        <Hand
                            className="flex-shrink-0"
                            size={ICON.SIZE}
                            strokeWidth={ICON.STROKE_WIDTH}
                        />
                        <span className="text-sm">
                            {t("Mode.Selection", { ns: "cursor" })}
                        </span>
                    </ToggleGroupItem>
                    <ToggleGroupItem
                        value={CURSOR_MODES.MARKING}
                        className="w-full justify-start gap-2"
                        onClick={() => {
                            DashboardToolbarStore.actions.settings.cursor.setCursorMode(
                                CURSOR_MODES.MARKING
                            );
                        }}
                    >
                        <Crosshair
                            className="flex-shrink-0"
                            size={ICON.SIZE}
                            strokeWidth={ICON.STROKE_WIDTH}
                        />
                        <span className="text-sm">
                            {t("Mode.Marking", { ns: "cursor" })}
                        </span>
                    </ToggleGroupItem>
                    <ToggleGroupItem
                        value={CURSOR_MODES.AUTOROTATE}
                        className="w-full justify-start gap-2"
                        onClick={() => {
                            DashboardToolbarStore.actions.settings.cursor.setCursorMode(
                                CURSOR_MODES.AUTOROTATE
                            );
                        }}
                    >
                        <RotateCw
                            className="flex-shrink-0"
                            size={ICON.SIZE}
                            strokeWidth={ICON.STROKE_WIDTH}
                        />
                        <span className="text-sm">
                            {t("Mode.Rotation", { ns: "cursor" })}
                        </span>
                    </ToggleGroupItem>
                    <ToggleGroupItem
                        value={CURSOR_MODES.TRACING}
                        className="w-full justify-start gap-2"
                        onClick={() => {
                            DashboardToolbarStore.actions.settings.cursor.setCursorMode(
                                CURSOR_MODES.TRACING
                            );
                        }}
                    >
                        <Brush
                            className="flex-shrink-0"
                            size={ICON.SIZE}
                            strokeWidth={ICON.STROKE_WIDTH}
                        />
                        <span className="text-sm">
                            {t("Mode.Tracing", { ns: "cursor" })}
                        </span>
                    </ToggleGroupItem>
                </ToggleGroup>

                <div
                    className={cn(
                        collapsiblePanelTransitionClass,
                        cursorMode === CURSOR_MODES.AUTOROTATE
                            ? collapsiblePanelExpandedClass
                            : collapsiblePanelCollapsedClass
                    )}
                >
                    <RotationPanel />
                </div>

                <div
                    className={cn(
                        collapsiblePanelTransitionClass,
                        cursorMode === CURSOR_MODES.TRACING
                            ? collapsiblePanelExpandedClass
                            : collapsiblePanelCollapsedClass
                    )}
                >
                    <TracingPanel />
                </div>
            </div>

            <div className="border-t border-border/30" />

            <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold">
                        {t("Types", { ns: "keywords" })}
                    </h3>
                    <div className="flex items-center gap-1">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    className="p-1.5 rounded-md hover:bg-accent hover:text-accent-foreground"
                                    title={t("Filters", { ns: "keywords" })}
                                >
                                    <Eye
                                        size={16}
                                        strokeWidth={ICON.STROKE_WIDTH}
                                    />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                side="right"
                                align="start"
                                className="w-64 p-4 z-[9999]"
                            >
                                <div className="space-y-4">
                                    <h4 className="font-medium leading-none text-sm">
                                        {t("FeatureVisibility", {
                                            ns: "keywords",
                                        })}
                                    </h4>
                                    <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-2">
                                        {availableMarkingTypes.map(type => (
                                            <div
                                                key={type.id}
                                                className="flex items-center justify-between"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="w-3 h-3 rounded-sm flex-shrink-0"
                                                        style={{
                                                            backgroundColor:
                                                                type.backgroundColor as string,
                                                        }}
                                                    />
                                                    <span className="text-sm">
                                                        {type.displayName}
                                                    </span>
                                                </div>
                                                <Toggle
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 px-2"
                                                    pressed={hiddenTypes.includes(
                                                        type.id
                                                    )}
                                                    onClick={e => {
                                                        e.preventDefault();
                                                        MarkingTypesStore.actions.visibility.toggle(
                                                            type.id
                                                        );
                                                    }}
                                                >
                                                    {hiddenTypes.includes(
                                                        type.id
                                                    ) ? (
                                                        <EyeOff size={14} />
                                                    ) : (
                                                        <Eye size={14} />
                                                    )}
                                                </Toggle>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <button
                            type="button"
                            onClick={openTypesSettings}
                            className="p-1.5 rounded-md hover:bg-accent hover:text-accent-foreground"
                            title={t("Types", { ns: "keywords" })}
                        >
                            <Settings
                                size={16}
                                strokeWidth={ICON.STROKE_WIDTH}
                            />
                        </button>
                    </div>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger
                        className={cn(
                            "w-full overflow-hidden text-ellipsis whitespace-nowrap flex items-center justify-between gap-2 px-3 py-2.5",
                            "border border-input rounded-md",
                            "hover:bg-accent hover:text-accent-foreground transition-colors",
                            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                            "disabled:pointer-events-none disabled:opacity-50"
                        )}
                        disabled={!availableMarkingTypes.length}
                    >
                        <div className="flex items-center gap-2 overflow-hidden">
                            {selectedMarkingType && (
                                <div
                                    className="w-4 h-4 rounded-sm border border-border/40 flex-shrink-0"
                                    style={{
                                        backgroundColor:
                                            selectedMarkingType.backgroundColor as string,
                                    }}
                                />
                            )}
                            <span className="overflow-hidden text-ellipsis whitespace-nowrap text-sm">
                                {selectedMarkingType?.displayName ??
                                    t("None", { ns: "keybindings" })}
                            </span>
                        </div>
                        <ChevronDown
                            size={16}
                            strokeWidth={ICON.STROKE_WIDTH}
                            className="flex-shrink-0"
                        />
                    </DropdownMenuTrigger>
                    <DropdownMenuPortal>
                        <DropdownMenuContent
                            align="start"
                            className="max-h-[50vh] overflow-y-auto z-[9999] !min-w-0 w-[var(--radix-dropdown-menu-trigger-width)]"
                        >
                            {availableMarkingTypes.map(type => {
                                const boundKey = keybindings.find(
                                    k =>
                                        k.typeId === type.id &&
                                        k.workingMode === workingMode
                                )?.boundKey;
                                return (
                                    <DropdownMenuItem
                                        key={type.id}
                                        onClick={() => {
                                            MarkingTypesStore.actions.selectedType.set(
                                                type.id
                                            );
                                        }}
                                        className="cursor-pointer justify-between gap-4"
                                    >
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <div
                                                className="w-4 h-4 rounded-sm border border-border/40 flex-shrink-0"
                                                style={{
                                                    backgroundColor:
                                                        type.backgroundColor as string,
                                                }}
                                            />
                                            <span className="truncate">
                                                {type.displayName}
                                            </span>
                                        </div>
                                        {boundKey && (
                                            <KbdGroup className="flex-shrink-0">
                                                {formatCombo(boundKey).map(
                                                    part => (
                                                        <Kbd key={part}>
                                                            {part}
                                                        </Kbd>
                                                    )
                                                )}
                                            </KbdGroup>
                                        )}
                                    </DropdownMenuItem>
                                );
                            })}
                        </DropdownMenuContent>
                    </DropdownMenuPortal>
                </DropdownMenu>
            </div>

            <div className="border-t border-border/30" />

            <div className="flex flex-col gap-1">
                <h3 className="text-xs font-semibold">
                    {t("Tools", { ns: "keywords" })}
                </h3>
                <div className="flex flex-col gap-1">
                    <Toggle
                        variant="outline"
                        className="w-full justify-start gap-2 h-auto min-h-[40px] py-2 px-3"
                        pressed={isViewportLocked}
                        onClick={
                            DashboardToolbarStore.actions.settings.viewport
                                .toggleLockedViewport
                        }
                    >
                        {isViewportLocked ? (
                            <LockKeyhole
                                className="flex-shrink-0"
                                size={ICON.SIZE}
                                strokeWidth={ICON.STROKE_WIDTH}
                            />
                        ) : (
                            <LockKeyholeOpen
                                className="flex-shrink-0"
                                size={ICON.SIZE}
                                strokeWidth={ICON.STROKE_WIDTH}
                            />
                        )}
                        <span className="text-sm text-left leading-tight">
                            {t("Lock viewports", { ns: "tooltip" })}
                        </span>
                    </Toggle>

                    <Toggle
                        variant="outline"
                        className="w-full justify-start gap-2 h-auto min-h-[40px] py-2 px-3"
                        pressed={isViewportScaleSync}
                        onClick={
                            DashboardToolbarStore.actions.settings.viewport
                                .toggleLockScaleSync
                        }
                    >
                        <SendToBack
                            className="flex-shrink-0"
                            size={ICON.SIZE}
                            strokeWidth={ICON.STROKE_WIDTH}
                        />
                        <span className="text-sm text-left leading-tight">
                            {t("Synchronize viewports with scale", {
                                ns: "tooltip",
                            })}
                        </span>
                    </Toggle>

                    <Toggle
                        variant="outline"
                        className="w-full justify-start gap-2 h-auto min-h-[40px] py-2 px-3"
                        pressed={cursorMode === CURSOR_MODES.MEASUREMENT}
                        onClick={() => {
                            if (cursorMode === CURSOR_MODES.MEASUREMENT) {
                                DashboardToolbarStore.actions.settings.cursor.setCursorMode(
                                    CURSOR_MODES.SELECTION
                                );
                            } else {
                                DashboardToolbarStore.actions.settings.cursor.setCursorMode(
                                    CURSOR_MODES.MEASUREMENT
                                );
                            }
                        }}
                    >
                        <Ruler
                            className="flex-shrink-0"
                            size={ICON.SIZE}
                            strokeWidth={ICON.STROKE_WIDTH}
                        />
                        <span className="text-sm text-left leading-tight">
                            {t("Mode.Measurement", { ns: "cursor" })}
                        </span>
                    </Toggle>

                    <div
                        className={cn(
                            collapsiblePanelTransitionClass,
                            cursorMode === CURSOR_MODES.MEASUREMENT
                                ? collapsiblePanelExpandedClass
                                : collapsiblePanelCollapsedClass
                        )}
                    >
                        <MeasurementPanel />
                    </div>

                    <ReportDialog />

                    <Toggle
                        variant="outline"
                        className="w-full justify-start gap-2 h-auto min-h-[40px] py-2 px-3"
                        pressed={isRotationSync}
                        onClick={
                            DashboardToolbarStore.actions.settings.viewport
                                .toggleRotationSync
                        }
                    >
                        <RotateCw
                            className="flex-shrink-0"
                            size={ICON.SIZE}
                            strokeWidth={ICON.STROKE_WIDTH}
                        />
                        <span className="text-sm text-left leading-tight">
                            {t("Synchronize rotation", {
                                ns: "tooltip",
                            })}
                        </span>
                    </Toggle>

                    {}

                    <div className="mt-4 p-3.5 rounded-xl bg-card border border-border shadow-2xs transition-all">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-card-foreground flex items-center gap-1.5">
                                <Wand2 size={13} className="text-primary" />
                                Automatyczny Matcher AFIS
                            </span>
                            <span
                                className={`text-[10px] px-2 py-0.5 font-bold rounded-md tracking-wide border transition-all duration-300 ${
                                    isValidationPassed
                                        ? "bg-primary/10 text-primary border-primary/20"
                                        : "bg-muted text-muted-foreground border-border"
                                }`}
                            >
                                {isValidationPassed
                                    ? "GOTOWY"
                                    : `BAZA: ${currentManualPairsCount}/4`}
                            </span>
                        </div>

                        <div className="mb-4 space-y-1.5">
                            <div className="flex justify-between items-center px-0.5">
                                <span className="text-[12px] font-medium text-muted-foreground">
                                    Limit cech wynikowych
                                </span>
                                <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                    {afisLimit}
                                </span>
                            </div>
                            <input
                                type="range"
                                min="5"
                                max="50"
                                step="1"
                                value={afisLimit}
                                onChange={e =>
                                    setAfisLimit(Number(e.target.value))
                                }
                                className="w-full h-1.5 rounded-lg appearance-none cursor-pointer transition-all"
                                style={{
                                    background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${((afisLimit - 5) / 45) * 100}%, hsl(var(--border)) ${((afisLimit - 5) / 45) * 100}%, hsl(var(--border)) 100%)`,
                                }}
                            />
                            <div className="flex justify-between text-[9px] text-muted-foreground/50 font-medium px-0.5">
                                <span>5</span>
                                <span>50</span>
                            </div>
                        </div>

                        <Button
                            variant={
                                isValidationPassed ? "default" : "secondary"
                            }
                            disabled={!isValidationPassed}
                            className="w-full h-9 text-xs font-medium rounded-lg transition-all duration-200 cursor-pointer shadow-xs"
                            /* eslint-disable-next-line */
                            onClick={async () => {
                                /* eslint-disable sonarjs/cognitive-complexity, @typescript-eslint/no-explicit-any, no-empty */
                                try {
                                    const canvasLeft = getCanvas(
                                        CANVAS_ID.LEFT,
                                        true
                                    );
                                    const canvasRight = getCanvas(
                                        CANVAS_ID.RIGHT,
                                        true
                                    );
                                    const viewportLeft = canvasLeft?.viewport;
                                    const viewportRight = canvasRight?.viewport;

                                    if (
                                        !viewportLeft ||
                                        !viewportRight ||
                                        !leftCore ||
                                        !rightCore
                                    )
                                        return;

                                    const data = (await matchWithSourceafis(
                                        viewportLeft,
                                        viewportRight,
                                        afisLimit
                                    )) as unknown as SourceAfisData;
                                    if (
                                        !data ||
                                        !data.leftMinutiae ||
                                        !data.rightMinutiae
                                    ) {
                                        /* eslint-disable-next-line no-alert */
                                        alert(
                                            "Brak danych minucji z systemu AFIS"
                                        );
                                        return;
                                    }

                                    const lCore =
                                        leftCore as unknown as AppMarking;
                                    const rCore =
                                        rightCore as unknown as AppMarking;

                                    const manualPairs: ManualPair[] = [];
                                    (
                                        leftMarkings as unknown as AppMarking[]
                                    ).forEach(lm => {
                                        const rm = (
                                            rightMarkings as unknown as AppMarking[]
                                        ).find(m => m.label === lm.label);
                                        if (rm) {
                                            const lCoords =
                                                detectCoordinatePath(lm);
                                            const rCoords =
                                                detectCoordinatePath(rm);
                                            manualPairs.push({
                                                left: lm,
                                                right: rm,
                                                lX: lCoords.x,
                                                lY: lCoords.y,
                                                rX: rCoords.x,
                                                rY: rCoords.y,
                                            });
                                        }
                                    });

                                    const transform =
                                        getProcrustesTransform(manualPairs);
                                    const sortedValidPairs =
                                        matchAutomatedMinutiae(
                                            data.leftMinutiae,
                                            data.rightMinutiae,
                                            manualPairs,
                                            transform
                                        );
                                    const automatedPairs: ValidPair[] = [];
                                    const seenLeft = new Set<string>();
                                    const seenRight = new Set<string>();

                                    manualPairs.forEach(p => {
                                        seenLeft.add(`${p.lX}-${p.lY}`);
                                        seenRight.add(`${p.rX}-${p.rY}`);
                                    });

                                    const remainingLimit =
                                        afisLimit - manualPairs.length;

                                    if (remainingLimit > 0) {
                                        for (
                                            let k = 0;
                                            k < sortedValidPairs.length;
                                            k += 1
                                        ) {
                                            const pair = sortedValidPairs[k];
                                            if (!pair) break;
                                            const lKey = `${pair.left.x}-${pair.left.y}`;
                                            const rKey = `${pair.right.x}-${pair.right.y}`;

                                            if (
                                                !seenLeft.has(lKey) &&
                                                !seenRight.has(rKey)
                                            ) {
                                                seenLeft.add(lKey);
                                                seenRight.add(rKey);
                                                automatedPairs.push(pair);
                                            }
                                            if (
                                                automatedPairs.length >=
                                                remainingLimit
                                            )
                                                break;
                                        }
                                    }

                                    let maxCurrentLabel = 1;
                                    leftMarkings.forEach(m => {
                                        if (Number(m.label) > maxCurrentLabel)
                                            maxCurrentLabel = Number(m.label);
                                    });
                                    rightMarkings.forEach(m => {
                                        if (Number(m.label) > maxCurrentLabel)
                                            maxCurrentLabel = Number(m.label);
                                    });

                                    const { clonedLeft, clonedRight } =
                                        createTransformedMarkings(
                                            automatedPairs,
                                            lCore,
                                            rCore,
                                            maxCurrentLabel,
                                            rozwidlenieTypeId ?? "",
                                            zakonczenieTypeId ?? ""
                                        );

                                    const newLeftMarkings = [
                                        ...leftMarkings,
                                        ...clonedLeft,
                                    ];
                                    const newRightMarkings = [
                                        ...rightMarkings,
                                        ...clonedRight,
                                    ];

                                    MarkingsStore(
                                        CANVAS_ID.LEFT
                                    ).actions.markings.reset();
                                    MarkingsStore(
                                        CANVAS_ID.LEFT
                                    ).actions.markings.addMany(
                                        newLeftMarkings as any
                                    );

                                    MarkingsStore(
                                        CANVAS_ID.RIGHT
                                    ).actions.markings.reset();
                                    MarkingsStore(
                                        CANVAS_ID.RIGHT
                                    ).actions.markings.addMany(
                                        newRightMarkings as any
                                    );

                                    /* eslint-disable-next-line no-alert */
                                    alert(
                                        `Dopasowanie udane! Zablokowano ${manualPairs.length} punktów bazowych. Automat dobrał ${automatedPairs.length} kolejnych cech. Score: ${data.matchScore}`
                                    );
                                } catch (error) {
                                    /* eslint-disable-next-line no-console */
                                    console.error(
                                        "Błąd podczas parowania cech AFIS:",
                                        error
                                    );

                                    /* eslint-disable-next-line no-alert */
                                    alert(
                                        t(
                                            "toolbar.afis.error",
                                            "Wystąpił błąd podczas automatycznego dopasowywania cech. Sprawdź konsolę."
                                        )
                                    );
                                }
                            }}
                        >
                            {!isCoreMarkedOnBoth
                                ? t(
                                      "toolbar.afis.markCoreBoth",
                                      "Zaznacz CORE na obu zdjęciach"
                                  )
                                : currentManualPairsCount < 4
                                  ? t("toolbar.afis.markRemainingBasePoints", {
                                        count: 4 - currentManualPairsCount,
                                        defaultValue: `Zaznacz jeszcze ${4 - currentManualPairsCount} punkty bazowe`,
                                    })
                                  : t(
                                        "toolbar.afis.extractAndMatch",
                                        "Wyodrębnij i dopasuj"
                                    )}
                        </Button>
                    </div>
                    {}
                </div>
            </div>
        </div>
    );
}
