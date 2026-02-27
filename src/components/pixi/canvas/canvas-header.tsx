import { cn } from "@/lib/utils/shadcn";
import { HTMLAttributes } from "react";
import { CanvasToolbarStore } from "@/lib/stores/CanvasToolbar";
import {
    Eye,
    EyeOff,
    MoveDiagonal,
    MoveHorizontal,
    MoveVertical,
    ImageUp,
    Save,
    FileInput,
    Info,
    FileJson,
} from "lucide-react";
import { ICON } from "@/lib/utils/const";
import { Toggle } from "@/components/ui/toggle";

import { SplitButton } from "@/components/ui/split-button";
import { useTranslation } from "react-i18next";
import { loadImageWithDialog } from "@/lib/utils/viewport/loadImage";
import { saveMarkingsDataWithDialog } from "@/lib/utils/viewport/saveMarkingsDataWithDialog";
import { loadMarkingsDataWithDialog } from "@/lib/utils/viewport/loadMarkingsData";
import { saveTracingDataWithDialog } from "@/lib/utils/viewport/saveTracingDataWithDialog";
import { loadTracingDataWithDialog } from "@/lib/utils/viewport/loadTracingDataWithDialog";
import { useGlobalViewport } from "../viewport/hooks/useGlobalViewport";
import { useCanvasContext } from "./hooks/useCanvasContext";
import {
    emitFitEvents,
    fitHeight,
    fitWidth,
    fitWorld,
} from "./utils/fit-viewport";

export type CanvasHeaderProps = HTMLAttributes<HTMLDivElement>;
export function CanvasHeader({ className, ...props }: CanvasHeaderProps) {
    const { t } = useTranslation();

    const { id } = useCanvasContext();
    const store = CanvasToolbarStore(id);

    const { markings: markingsSettings, viewport: viewportSettings } =
        store.use(state => state.settings);

    const { markings: markingsActions, viewport: viewportActions } =
        store.actions.settings;

    const { setShowLabels } = markingsActions;

    const { setShowViewportInformation } = viewportActions;

    const viewport = useGlobalViewport(id, { autoUpdate: true });

    if (viewport === null) return null;

    return (
        <div
            className={cn(
                "flex items-center justify-between gap-2 w-full h-10 px-2",
                "bg-gradient-to-b from-muted/50 to-muted/30",
                "border-b border-border/40",
                "shadow-sm backdrop-blur-sm",
                className
            )}
            {...props}
        >
            <div className="flex items-center gap-1.5">
                <SplitButton
                    mainAction={{
                        label: t("Save markings data to a JSON file", {
                            ns: "tooltip",
                        }),
                        icon: (
                            <Save
                                size={ICON.SIZE}
                                strokeWidth={ICON.STROKE_WIDTH}
                            />
                        ),
                        onClick: () => {
                            saveMarkingsDataWithDialog(viewport);
                        },
                    }}
                    dropdownActions={[
                        {
                            label: t("Save markings data to a JSON file", {
                                ns: "tooltip",
                            }),
                            icon: (
                                <Save
                                    size={ICON.SIZE}
                                    strokeWidth={ICON.STROKE_WIDTH}
                                />
                            ),
                            onClick: () => {
                                saveMarkingsDataWithDialog(viewport);
                            },
                        },
                        {
                            label: t("Save tracing data to a JSON file", {
                                ns: "tooltip",
                            }),
                            icon: (
                                <FileJson
                                    size={ICON.SIZE}
                                    strokeWidth={ICON.STROKE_WIDTH}
                                />
                            ),
                            onClick: () => {
                                saveTracingDataWithDialog(viewport);
                            },
                        },
                    ]}
                    size="icon"
                    variant="outline"
                />

                <SplitButton
                    mainAction={{
                        label: t("Load forensic mark image", {
                            ns: "tooltip",
                        }),
                        icon: (
                            <ImageUp
                                size={ICON.SIZE}
                                strokeWidth={ICON.STROKE_WIDTH}
                            />
                        ),
                        onClick: () => {
                            loadImageWithDialog(viewport);
                        },
                    }}
                    dropdownActions={[
                        {
                            label: t("Load markings data from file", {
                                ns: "tooltip",
                            }),
                            icon: (
                                <FileInput
                                    size={ICON.SIZE}
                                    strokeWidth={ICON.STROKE_WIDTH}
                                />
                            ),
                            onClick: () => {
                                loadMarkingsDataWithDialog(viewport);
                            },
                        },
                        {
                            label: t("Load tracing data from file", {
                                ns: "tooltip",
                            }),
                            icon: (
                                <FileInput
                                    size={ICON.SIZE}
                                    strokeWidth={ICON.STROKE_WIDTH}
                                />
                            ),
                            onClick: () => {
                                loadTracingDataWithDialog(viewport);
                            },
                        },
                    ]}
                    size="icon"
                    variant="outline"
                />

                <div className="h-5 w-px bg-border/40 mx-0.5" />

                <SplitButton
                    mainAction={{
                        label: t("Fit world", { ns: "tooltip" }),
                        icon: (
                            <MoveDiagonal
                                size={ICON.SIZE}
                                strokeWidth={ICON.STROKE_WIDTH}
                            />
                        ),
                        onClick: () => {
                            fitWorld(viewport);
                            emitFitEvents(viewport, "fit-world");
                        },
                    }}
                    dropdownActions={[
                        {
                            label: t("Fit height", { ns: "tooltip" }),
                            icon: (
                                <MoveVertical
                                    size={ICON.SIZE}
                                    strokeWidth={ICON.STROKE_WIDTH}
                                />
                            ),
                            onClick: () => {
                                fitHeight(viewport);
                                emitFitEvents(viewport, "fit-height");
                            },
                        },
                        {
                            label: t("Fit width", { ns: "tooltip" }),
                            icon: (
                                <MoveHorizontal
                                    size={ICON.SIZE}
                                    strokeWidth={ICON.STROKE_WIDTH}
                                />
                            ),
                            onClick: () => {
                                fitWidth(viewport);
                                emitFitEvents(viewport, "fit-width");
                            },
                        },
                    ]}
                    size="icon"
                    variant="outline"
                />
            </div>

            <div className="flex items-center gap-1.5">
                <Toggle
                    variant="outline"
                    title={t("Toggle marking labels", {
                        ns: "tooltip",
                    })}
                    size="icon"
                    pressed={markingsSettings.showLabels}
                    onClick={() => {
                        setShowLabels(!markingsSettings.showLabels);
                    }}
                >
                    {markingsSettings.showLabels ? (
                        <Eye size={ICON.SIZE} strokeWidth={ICON.STROKE_WIDTH} />
                    ) : (
                        <EyeOff
                            size={ICON.SIZE}
                            strokeWidth={ICON.STROKE_WIDTH}
                        />
                    )}
                </Toggle>
                <Toggle
                    variant="outline"
                    title={t("Toggle viewport information", {
                        ns: "tooltip",
                    })}
                    size="icon"
                    pressed={viewportSettings.showInformation}
                    onClick={() => {
                        setShowViewportInformation(
                            !viewportSettings.showInformation
                        );
                    }}
                >
                    <Info size={ICON.SIZE} strokeWidth={ICON.STROKE_WIDTH} />
                </Toggle>
            </div>
        </div>
    );
}
