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
    Wand2
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

export type VerticalToolbarProps = HTMLAttributes<HTMLDivElement>;

export function VerticalToolbar({ className, ...props }: VerticalToolbarProps) {
    const { t } = useTranslation();
    const formatCombo = useFormatCombo();
    const [afisLimit, setAfisLimit] = useState<number>(20);
    const collapsiblePanelTransitionClass = "overflow-hidden transition-all duration-300 ease-in-out";
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
        return name.includes("rozwidlenie") || display.includes("rozwidlenie") || name.includes("bifurcation") || display.includes("bifurcation");
    });
    const zakonczenieType = allMarkingTypes.find(type => {
        const name = (type.name || "").toLowerCase();
        const display = (type.displayName || "").toLowerCase();
        return name.includes("zakończenie") || name.includes("zakoncenie") || display.includes("zakończenie") || display.includes("zakoncenie") || name.includes("ending") || display.includes("ending");
    });

    const nonCoreTypes = allMarkingTypes.filter(t => t.id !== coreTypeId);

    const rozwidlenieTypeId = rozwidlenieType?.id || nonCoreTypes[0]?.id || allMarkingTypes[0]?.id;
    const zakonczenieTypeId = zakonczenieType?.id || nonCoreTypes[1]?.id || nonCoreTypes[0]?.id || allMarkingTypes[0]?.id;

    console.log("SŁOWNIK TYPÓW ADNOTACJI W APLIKACJI", allMarkingTypes.map(t => ({ id: t.id, name: t.name, displayName: t.displayName })));
    console.log("Przypisane ID robocze -> Rozwidlenie:", rozwidlenieTypeId, "Zakończenie:", zakonczenieTypeId);

    const leftMarkings = MarkingsStore(CANVAS_ID.LEFT).use(state => state.markings);
    const rightMarkings = MarkingsStore(CANVAS_ID.RIGHT).use(state => state.markings);
    
    const leftCore = leftMarkings.find(m => m.typeId === coreTypeId);
    const rightCore = rightMarkings.find(m => m.typeId === coreTypeId);
    const isCoreMarkedOnBoth = !!leftCore && !!rightCore;

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
                    <div className="flex flex-col gap-3 p-3 mt-4 border border-green-200 bg-green-50/40 rounded-md">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-semibold text-green-900 flex items-center gap-1.5">
                                <Wand2 size={12} />
                                SourceAFIS Match
                            </h4>
                            <span className="text-[10px] font-bold text-green-800 bg-green-200 px-1.5 py-0.5 rounded">
                                Limit: {afisLimit}
                            </span>
                        </div>
                        
                        <div className="flex flex-col gap-1">
                            <input
                                type="range"
                                min="5"
                                max="100"
                                step="1"
                                value={afisLimit}
                                onChange={(e) => setAfisLimit(Number(e.target.value))}
                                className="w-full accent-green-600 cursor-pointer"
                            />
                            <div className="flex justify-between text-[9px] text-green-700/70 font-medium px-0.5">
                                <span>5</span>
                                <span>100</span>
                            </div>
                        </div>

                        <Button
                            variant="default"
                            disabled={!isCoreMarkedOnBoth}
                            className="w-full h-8 text-xs bg-green-600 hover:bg-green-700 text-white shadow-sm disabled:opacity-100 disabled:!bg-gray-200 disabled:!text-gray-500 disabled:cursor-not-allowed transition-all"
                            onClick={async () => {
                                try {
                                    const canvasLeft = getCanvas(CANVAS_ID.LEFT, true);
                                    const canvasRight = getCanvas(CANVAS_ID.RIGHT, true);
                                    const viewportLeft = canvasLeft?.viewport;
                                    const viewportRight = canvasRight?.viewport;

                                    if (!viewportLeft || !viewportRight || !leftCore || !rightCore) return;

                                    const data = (await matchWithSourceafis(viewportLeft, viewportRight, afisLimit)) as any;
                                    if (!data || !data.leftMinutiae || !data.rightMinutiae) {
                                        alert("Brak danych minucji z systemu AFIS");
                                        return;
                                    }

                                    const lCore = leftCore as any;
                                    const rCore = rightCore as any;

                                    const detectCoordinatePath = (obj: any) => {
                                        if (obj.origin && typeof obj.origin.x === 'number') return { x: obj.origin.x, y: obj.origin.y, path: 'origin' };
                                        if (obj.position && typeof obj.position.x === 'number') return { x: obj.position.x, y: obj.position.y, path: 'position' };
                                        if (typeof obj.x === 'number') return { x: obj.x, y: obj.y, path: 'plain' };
                                        return { x: 0, y: 0, path: 'unknown' };
                                    };

                                    const leftCoreCoords = detectCoordinatePath(lCore);
                                    const rightCoreCoords = detectCoordinatePath(rCore);

                                    console.log("Wykryta struktura pozycji Core (Lewy):", leftCoreCoords);
                                    console.log("Wykryta struktura pozycji Core (Prawy):", rightCoreCoords);

                                    const leftWithRadius = data.leftMinutiae.map((l: any) => {
                                        const rx = l.x - leftCoreCoords.x;
                                        const ry = l.y - leftCoreCoords.y;
                                        return {
                                            ...l,
                                            radius: Math.sqrt(rx * rx + ry * ry)
                                        };
                                    });

                                    const rightWithRadius = data.rightMinutiae.map((r: any) => {
                                        const rx = r.x - rightCoreCoords.x;
                                        const ry = r.y - rightCoreCoords.y;
                                        return {
                                            ...r,
                                            radius: Math.sqrt(rx * rx + ry * ry)
                                        };
                                    });

                                    const allPossiblePairs: Array<{left: any, right: any, delta: number}> = [];

                                    leftWithRadius.forEach((l: any) => {
                                        rightWithRadius.forEach((r: any) => {
                                            const delta = Math.abs(l.radius - r.radius);
                                            allPossiblePairs.push({ left: l, right: r, delta: delta });
                                        });
                                    });

                                    allPossiblePairs.sort((a, b) => a.delta - b.delta);

                                    const selectedPairs: any[] = [];
                                    const seenLeftKeys = new Set<string>();
                                    const seenRightPoints = new Set<string>();

                                    for (const pair of allPossiblePairs) {
                                        const leftKey = `${pair.left.x}-${pair.left.y}`;
                                        const rightKey = `${pair.right.x}-${pair.right.y}`;

                                        if (!seenLeftKeys.has(leftKey) && !seenRightPoints.has(rightKey)) {
                                            seenLeftKeys.add(leftKey);
                                            seenRightPoints.add(rightKey);
                                            selectedPairs.push(pair);
                                        }

                                        if (selectedPairs.length >= afisLimit) {
                                            break;
                                        }
                                    }

                                    const newLeftMarkings: any[] = [leftCore]; 
                                    const newRightMarkings: any[] = [rightCore];

                                    selectedPairs.forEach((pair, index) => {
                                        const pairId = index + 2; 

                                        const leftClone = Object.create(Object.getPrototypeOf(leftCore));
                                        Object.keys(lCore).forEach(key => {

                                            if (!key.startsWith('_') && key !== 'transform' && key !== 'parent' && key !== 'children') {
                                                leftClone[key] = lCore[key];
                                            }
                                        });

                                        leftClone.id = crypto.randomUUID();
                                        leftClone.typeId = pair.left.type === "bifurcation" ? rozwidlenieTypeId : zakonczenieTypeId;
                                        leftClone.label = pairId;

                                        if (leftCoreCoords.path === 'origin') {
                                            leftClone.origin = { x: pair.left.x, y: pair.left.y };
                                        } else if (leftCoreCoords.path === 'position') {
                                            leftClone.position = { x: pair.left.x, y: pair.left.y };
                                        } else {
                                            leftClone.x = pair.left.x;
                                            leftClone.y = pair.left.y;
                                        }

                                        const rightClone = Object.create(Object.getPrototypeOf(rightCore));
                                        Object.keys(rCore).forEach(key => {
                                            if (!key.startsWith('_') && key !== 'transform' && key !== 'parent' && key !== 'children') {
                                                rightClone[key] = rCore[key];
                                            }
                                        });

                                        rightClone.id = crypto.randomUUID();
                                        rightClone.typeId = pair.right.type === "bifurcation" ? rozwidlenieTypeId : zakonczenieTypeId;
                                        rightClone.label = pairId;

                                        if (rightCoreCoords.path === 'origin') {
                                            rightClone.origin = { x: pair.right.x, y: pair.right.y };
                                        } else if (rightCoreCoords.path === 'position') {
                                            rightClone.position = { x: pair.right.x, y: pair.right.y };
                                        } else {
                                            rightClone.x = pair.right.x;
                                            rightClone.y = pair.right.y;
                                        }

                                        newLeftMarkings.push(leftClone);
                                        newRightMarkings.push(rightClone);
                                    });

                                    MarkingsStore(CANVAS_ID.LEFT).actions.markings.reset();
                                    MarkingsStore(CANVAS_ID.LEFT).actions.markings.addMany(newLeftMarkings);

                                    MarkingsStore(CANVAS_ID.RIGHT).actions.markings.reset();
                                    MarkingsStore(CANVAS_ID.RIGHT).actions.markings.addMany(newRightMarkings);

                                    alert(`Dopasowanie zakończone! Sparowano ${selectedPairs.length} najlepszych wspólnych cech. Score: ${data.matchScore}`);

                                } catch (error) {
                                        console.error("Błąd podczas parowania cech AFIS:", error);
                                }
                            }}
                        >
                            {isCoreMarkedOnBoth ? "Wyodrębnij i dopasuj" : "Zaznacz CORE na obu zdjęciach"}
                        </Button>
                    </div>
                    {}
                </div>
            </div>
        </div>
    );
}
