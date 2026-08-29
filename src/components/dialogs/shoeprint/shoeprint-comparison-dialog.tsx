import { useCallback, useEffect, useState } from "react";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogOverlay,
    DialogPortal,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "react-i18next";
import { useDebouncedCallback } from "use-debounce";
import { ScanSearch, X } from "lucide-react";
import { ICON } from "@/lib/utils/const";
import { toast } from "sonner";
import { cn } from "@/lib/utils/shadcn";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { ShoeprintComparisonStore } from "@/lib/stores/ShoeprintComparison";
import {
    DEFAULT_COMPARISON_SETTINGS,
    extractForCanvas,
    getEngineStatus,
    onComparisonProgress,
    type ShoeprintEngineStatus,
    type ShoeprintExtractionSettings,
} from "@/lib/shoeprint/shoeprint-comparison";
import type { EdgeExtractionResult } from "@/lib/shoeprint/edge-extraction";
import { PointCloudPreview } from "./point-cloud-preview";
import { ComparisonResults } from "./comparison-results";

const PREVIEW_DEBOUNCE_MS = 300;

type ShoeprintComparisonDialogProps = {
    className?: string;
};

type PreviewState = {
    left: EdgeExtractionResult | null;
    right: EdgeExtractionResult | null;
    error: string | null;
    loading: boolean;
};

type NumberFieldProps = {
    id: string;
    label: string;
    value: number | null;
    onChange: (value: number | null) => void;
    placeholder?: string;
    min?: number;
    max?: number;
    step?: number;
};

/** Labelled numeric input; an empty field reads back as null. */
function NumberField({
    id,
    label,
    value,
    onChange,
    placeholder,
    min,
    max,
    step,
}: NumberFieldProps) {
    return (
        <div className="flex flex-col gap-1">
            <label htmlFor={id} className="text-xs text-muted-foreground">
                {label}
            </label>
            <Input
                id={id}
                type="number"
                min={min}
                max={max}
                step={step}
                placeholder={placeholder}
                className="h-9"
                value={value ?? ""}
                onChange={event =>
                    onChange(
                        event.target.value === ""
                            ? null
                            : Number(event.target.value)
                    )
                }
            />
        </div>
    );
}

export function ShoeprintComparisonDialog({
    className,
}: ShoeprintComparisonDialogProps) {
    const { t } = useTranslation(["keywords", "description", "tooltip"]);
    const [isOpen, setIsOpen] = useState(false);
    const [engine, setEngine] = useState<ShoeprintEngineStatus | null>(null);
    const [preview, setPreview] = useState<PreviewState>({
        left: null,
        right: null,
        error: null,
        loading: false,
    });

    const settings = ShoeprintComparisonStore.use(state => state.settings);
    const isRunning = ShoeprintComparisonStore.use(state => state.isRunning);
    const progress = ShoeprintComparisonStore.use(state => state.progress);
    const run = ShoeprintComparisonStore.use(state => state.run);
    const error = ShoeprintComparisonStore.use(state => state.error);

    useEffect(() => {
        const unlisten = onComparisonProgress(next => {
            ShoeprintComparisonStore.actions.setProgress(next);
        });
        return () => {
            unlisten.then(dispose => dispose()).catch(() => {});
        };
    }, []);

    useEffect(() => {
        if (!isOpen) return undefined;
        let cancelled = false;
        getEngineStatus()
            .then(status => {
                if (!cancelled) setEngine(status);
            })
            .catch(() => {
                if (!cancelled) {
                    setEngine({
                        available: false,
                        rscriptPath: null,
                        libraryPath: null,
                        scriptPath: null,
                        detail: "unreachable",
                    });
                }
            });
        return () => {
            cancelled = true;
        };
    }, [isOpen]);

    const refreshPreview = useCallback(async () => {
        setPreview(current => ({ ...current, loading: true, error: null }));
        try {
            const left = await extractForCanvas(
                CANVAS_ID.LEFT,
                settings.left,
                settings.seed
            );
            const right = await extractForCanvas(
                CANVAS_ID.RIGHT,
                settings.right,
                settings.seed
            );
            setPreview({ left, right, error: null, loading: false });
        } catch (err) {
            setPreview({
                left: null,
                right: null,
                error: err instanceof Error ? err.message : String(err),
                loading: false,
            });
        }
    }, [settings]);

    const debouncedRefreshPreview = useDebouncedCallback(() => {
        refreshPreview().catch(() => {
            /* surfaced through preview.error */
        });
    }, PREVIEW_DEBOUNCE_MS);

    useEffect(() => {
        if (!isOpen) return undefined;
        debouncedRefreshPreview();
        return () => debouncedRefreshPreview.cancel();
    }, [isOpen, settings, debouncedRefreshPreview]);

    const updateSide = (
        side: "left" | "right",
        update: Partial<ShoeprintExtractionSettings>
    ) => {
        ShoeprintComparisonStore.actions.updateSettings({
            [side]: { ...settings[side], ...update },
        } as Parameters<
            typeof ShoeprintComparisonStore.actions.updateSettings
        >[0]);
    };

    const onRun = async () => {
        const result = await ShoeprintComparisonStore.actions.run();
        if (result) {
            toast.success(
                t("Comparison finished in {{seconds}}s", {
                    ns: "tooltip",
                    seconds: (result.durationMs / 1000).toFixed(0),
                })
            );
        } else {
            const message = ShoeprintComparisonStore.state.error;
            if (message) {
                toast.error(
                    t("Comparison failed: {{error}}", {
                        ns: "tooltip",
                        error: message,
                    })
                );
            } else {
                toast.info(t("Comparison cancelled", { ns: "tooltip" }));
            }
        }
    };

    const onCancel = async () => {
        await ShoeprintComparisonStore.actions.cancel();
    };

    const label = t("Shoeprint comparison", { ns: "keywords" });
    const engineReady = engine?.available ?? false;

    const sides: Array<{
        key: "left" | "right";
        title: string;
        extraction: EdgeExtractionResult | null;
    }> = [
        { key: "left", title: "A (Q)", extraction: preview.left },
        { key: "right", title: "B (K)", extraction: preview.right },
    ];

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                title={label}
                className={cn(
                    "w-full justify-start gap-2 h-auto min-h-[40px] py-2 px-3 border border-input rounded-md",
                    "hover:bg-accent hover:text-accent-foreground transition-colors",
                    "flex items-center",
                    className
                )}
            >
                <ScanSearch
                    className="flex-shrink-0"
                    size={ICON.SIZE}
                    strokeWidth={ICON.STROKE_WIDTH}
                />
                <span className="text-sm text-left leading-tight">{label}</span>
            </button>

            <DialogPortal>
                <DialogOverlay />
                <DialogContent className="w-[780px] max-w-[94vw] max-h-[92vh] flex flex-col">
                    <DialogTitle className="text-lg font-semibold">
                        {label}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                        {t("Comparison method description", {
                            ns: "description",
                        })}
                    </DialogDescription>

                    <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1 flex flex-col gap-5">
                        {engine && !engineReady && (
                            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
                                <strong>
                                    {t("The analysis engine is unavailable", {
                                        ns: "keywords",
                                    })}
                                </strong>
                                <p className="mt-1 text-xs text-muted-foreground break-words">
                                    {engine.detail}
                                </p>
                            </div>
                        )}

                        <section className="grid gap-4 sm:grid-cols-2">
                            {sides.map(side => (
                                <div
                                    key={side.key}
                                    className="flex flex-col gap-2 rounded-md border border-border/60 p-3"
                                >
                                    <h3 className="text-sm font-semibold">
                                        {side.title}
                                    </h3>

                                    <div className="flex items-start gap-3">
                                        <PointCloudPreview
                                            points={
                                                side.extraction?.points ?? []
                                            }
                                            width={110}
                                            height={200}
                                        />
                                        <div className="flex flex-1 flex-col gap-2">
                                            <NumberField
                                                id={`shoeprint-dpi-${side.key}`}
                                                label={t(
                                                    "Image resolution (DPI)",
                                                    { ns: "keywords" }
                                                )}
                                                min={1}
                                                placeholder={t("Automatic", {
                                                    ns: "keywords",
                                                })}
                                                value={settings[side.key].dpi}
                                                onChange={dpi =>
                                                    updateSide(side.key, {
                                                        dpi,
                                                    })
                                                }
                                            />

                                            <NumberField
                                                id={`shoeprint-threshold-${side.key}`}
                                                label={t("Threshold", {
                                                    ns: "keywords",
                                                })}
                                                min={0}
                                                max={255}
                                                placeholder={t("Automatic", {
                                                    ns: "keywords",
                                                })}
                                                value={
                                                    settings[side.key].threshold
                                                }
                                                onChange={threshold =>
                                                    updateSide(side.key, {
                                                        threshold,
                                                    })
                                                }
                                            />

                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs text-muted-foreground">
                                                    {t(
                                                        "Invert print and background",
                                                        { ns: "keywords" }
                                                    )}
                                                </span>
                                                <Switch
                                                    checked={
                                                        settings[side.key]
                                                            .invert === true
                                                    }
                                                    onCheckedChange={checked =>
                                                        updateSide(side.key, {
                                                            invert: checked
                                                                ? true
                                                                : "auto",
                                                        })
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-xs text-muted-foreground tabular-nums">
                                        {t("Edge points", { ns: "keywords" })}:{" "}
                                        {side.extraction
                                            ? side.extraction.points.length.toLocaleString()
                                            : "—"}
                                    </p>
                                </div>
                            ))}
                        </section>

                        {preview.error && (
                            <p className="text-xs text-rose-600 dark:text-rose-400">
                                {preview.error}
                            </p>
                        )}

                        <section className="grid gap-3 sm:grid-cols-3">
                            <NumberField
                                id="shoeprint-region-radius"
                                label={`${t("Region radius", { ns: "keywords" })} (mm)`}
                                min={5}
                                step={0.5}
                                value={settings.regionRadiusMm}
                                onChange={value =>
                                    ShoeprintComparisonStore.actions.updateSettings(
                                        {
                                            regionRadiusMm:
                                                value ??
                                                DEFAULT_COMPARISON_SETTINGS.regionRadiusMm,
                                        }
                                    )
                                }
                            />
                            <NumberField
                                id="shoeprint-max-rotation"
                                label={`${t("Maximum rotation angle", { ns: "keywords" })} (°)`}
                                min={1}
                                max={180}
                                value={settings.maxRotationAngle}
                                onChange={value =>
                                    ShoeprintComparisonStore.actions.updateSettings(
                                        {
                                            maxRotationAngle:
                                                value ??
                                                DEFAULT_COMPARISON_SETTINGS.maxRotationAngle,
                                        }
                                    )
                                }
                            />
                            <NumberField
                                id="shoeprint-seed"
                                label={t("Random seed", { ns: "keywords" })}
                                min={1}
                                value={settings.seed}
                                onChange={value =>
                                    ShoeprintComparisonStore.actions.updateSettings(
                                        {
                                            seed:
                                                value ??
                                                DEFAULT_COMPARISON_SETTINGS.seed,
                                        }
                                    )
                                }
                            />
                        </section>

                        {isRunning && (
                            <div className="rounded-md border border-border/60 p-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span>
                                        {t("Running comparison", {
                                            ns: "keywords",
                                        })}
                                        {progress?.message
                                            ? ` — ${progress.message}`
                                            : "…"}
                                    </span>
                                    <span className="tabular-nums text-muted-foreground">
                                        {progress?.percent ?? 0}%
                                    </span>
                                </div>
                                <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-muted">
                                    <div
                                        className="h-full bg-primary transition-all"
                                        style={{
                                            width: `${progress?.percent ?? 0}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {error && (
                            <p className="text-sm text-rose-600 dark:text-rose-400">
                                {error}
                            </p>
                        )}

                        {run && !isRunning && <ComparisonResults run={run} />}

                        {!run && !isRunning && !error && (
                            <p className="text-sm text-muted-foreground">
                                {t("No comparison has been run yet", {
                                    ns: "keywords",
                                })}
                            </p>
                        )}
                    </div>

                    <div className="mt-5 flex shrink-0 justify-end gap-2">
                        {/* While a comparison runs, Cancel stops it rather than
                            closing the dialog. */}
                        {isRunning ? (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onCancel}
                            >
                                {t("Cancel", { ns: "keywords" })}
                            </Button>
                        ) : (
                            <>
                                <DialogClose asChild>
                                    <Button type="button" variant="outline">
                                        {t("Cancel", { ns: "keywords" })}
                                    </Button>
                                </DialogClose>
                                <Button
                                    type="button"
                                    onClick={onRun}
                                    disabled={
                                        !engineReady ||
                                        preview.loading ||
                                        !preview.left ||
                                        !preview.right
                                    }
                                >
                                    {t("Run comparison", { ns: "keywords" })}
                                </Button>
                            </>
                        )}
                    </div>

                    <DialogClose className="absolute top-3 right-3">
                        <X size={ICON.SIZE} strokeWidth={ICON.STROKE_WIDTH} />
                    </DialogClose>
                </DialogContent>
            </DialogPortal>
        </Dialog>
    );
}
