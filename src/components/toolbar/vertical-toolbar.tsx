import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils/shadcn";
import { HTMLAttributes } from "react";
import { invoke } from "@tauri-apps/api/core";

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
    Ruler,
    Eye,
    EyeOff,
} from "lucide-react";
import { ICON } from "@/lib/utils/const";
import { useTranslation } from "react-i18next";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { MARKING_CLASS } from "@/lib/markings/MARKING_CLASS";
import { WorkingModeStore } from "@/lib/stores/WorkingMode";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuPortal,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { RotationPanel } from "./rotation-panel";
import { MeasurementPanel } from "./measurement-panel";
import { ReportDialog } from "@/components/dialogs/report/report-dialog";

export type VerticalToolbarProps = HTMLAttributes<HTMLDivElement>;

export function VerticalToolbar({ className, ...props }: VerticalToolbarProps) {
    const { t } = useTranslation();

    const { mode: cursorMode } = DashboardToolbarStore.use(
        state => state.settings.cursor
    );

    const {
        locked: isViewportLocked,
        scaleSync: isViewportScaleSync,
        rotationSync: isRotationSync,
    } = DashboardToolbarStore.use(state => state.settings.viewport);

    const availableMarkingTypes = MarkingTypesStore.use(state => state.types);
    const hiddenTypes = MarkingTypesStore.use(state => state.hiddenTypes);

    const workingMode = WorkingModeStore.use(state => state.workingMode);

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

    const selectedMarkingType = MarkingTypesStore.use(state =>
        state.types.find(t => t.id === state.selectedTypeId)
    );

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
                </ToggleGroup>

                <div
                    className={cn(
                        "overflow-hidden transition-all duration-300 ease-in-out",
                        cursorMode === CURSOR_MODES.AUTOROTATE
                            ? "max-h-96 opacity-100 mt-2"
                            : "max-h-0 opacity-0"
                    )}
                >
                    <RotationPanel />
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
                        <DropdownMenuContent className="max-h-[50vh] overflow-y-auto z-[9999] min-w-[200px]">
                            {availableMarkingTypes.map(type => (
                                <DropdownMenuItem
                                    key={type.id}
                                    onClick={() => {
                                        MarkingTypesStore.actions.selectedType.set(
                                            type.id
                                        );
                                    }}
                                    className="cursor-pointer"
                                >
                                    <div
                                        className="w-4 h-4 rounded-sm border border-border/40 flex-shrink-0"
                                        style={{
                                            backgroundColor:
                                                type.backgroundColor as string,
                                        }}
                                    />
                                    <span>{type.displayName}</span>
                                </DropdownMenuItem>
                            ))}
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
                            {t("Mode.Measurement", { ns: "cursor" })}
                        </span>
                    </Toggle>

                    <div
                        className={cn(
                            "overflow-hidden transition-all duration-300 ease-in-out",
                            cursorMode === CURSOR_MODES.MEASUREMENT
                                ? "max-h-96 opacity-100 mt-2"
                                : "max-h-0 opacity-0"
                        )}
                    >
                        <MeasurementPanel />
                    </div>
                            {t("Synchronize rotation", {
                                ns: "tooltip",
                            })}
                        </span>
                    </Toggle>
                </div>
            </div>
        </div>
    );
}
