import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { WindowControls } from "@/components/menu/window-controls";
import { Menubar } from "@/components/ui/menubar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/shadcn";
import { ICON } from "@/lib/utils/const";
import { Edit, Save } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import {
    readFile,
    writeFile,
    exists,
    mkdir,
    stat,
} from "@tauri-apps/plugin-fs";
import {
    basename,
    extname,
    join,
    dirname,
    appLocalDataDir,
} from "@tauri-apps/api/path";
import { toast } from "sonner";
import { useSettingsSync } from "@/lib/hooks/useSettingsSync";
import ImageDpiControls from "@/components/edit-window/dpi/image-dpi-controls";
import {
    AnyModifier,
    EnhancementParams,
    FftModifier,
    FftParams,
    ModifierType,
    isEnhancementModifier,
} from "@/lib/imageModifiers/types";
import {
    MODIFIER_REGISTRY,
    createFftModifier,
    buildCssFilter,
} from "@/lib/imageModifiers/registry";
import { applyPipelineToImage } from "@/lib/imageModifiers/pipeline";
import { AddModifierButton } from "@/components/edit-window/modifiers/AddModifierButton";
import { ModifierList } from "@/components/edit-window/modifiers/ModifierList";
import { ModifierSettingsDialog } from "@/components/edit-window/modifiers/ModifierSettingsDialog";
import {
    runPyfingEnhancement,
    PyfingMethod,
} from "@/lib/external-tools/pyfing/runPyfingEnhancement";
import ImagePanes from "./fft/ImagePanes";
import { SidebarFFT } from "./components/SidebarFFT";
import { useFftWorkspace } from "./hooks/useFftWorkspace";
import { useImagePanZoom } from "./hooks/useImagePanZoom";
import { useSyncedElement } from "./hooks/useElementSync";

async function generateFilename(p: string) {
    const originalFilename = await basename(p);
    const extension = await extname(p);
    const extWithDot = extension
        ? extension.startsWith(".")
            ? extension
            : `.${extension}`
        : ".png";
    const lastDotIndex = originalFilename.lastIndexOf(".");
    const nameWithoutExt =
        lastDotIndex > 0
            ? originalFilename.slice(0, lastDotIndex)
            : originalFilename;
    const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, -5);
    return { nameWithoutExt, extWithDot, timestamp };
}

async function pathToBlobUrl(path: string): Promise<string> {
    const bytes = await readFile(path);
    // The TS DOM lib types Blob's BlobPart with ArrayBuffer (not ArrayBufferLike)
    // which conflicts with Tauri's Uint8Array<ArrayBufferLike>. The cast through
    // unknown is safe because Blob accepts any TypedArray at runtime.
    const blob = new Blob([bytes as unknown as ArrayBuffer], {
        type: "image/png",
    });
    return URL.createObjectURL(blob);
}

function pyfingMethodFromType(type: "gbfen" | "snfen"): PyfingMethod {
    return type === "gbfen" ? "GBFEN" : "SNFEN";
}

function cacheKeyHash(s: string): string {
    let h = 0;
    for (let i = 0; i < s.length; i += 1) {
        h = (h * 31 + s.charCodeAt(i)) % 2147483647;
    }
    return Math.abs(h).toString(16).padStart(8, "0");
}

async function buildEnhancementOutputPath(
    imagePath: string,
    nameWithoutExt: string,
    method: string,
    dpi: number
): Promise<string> {
    const fileSize = await stat(imagePath)
        .then(s => String(s.size))
        .catch(() => "0");
    const key = cacheKeyHash(imagePath + fileSize);
    const base = await appLocalDataDir();
    const cacheDir = await join(base, "pyfing-cache");
    return join(cacheDir, `${nameWithoutExt}_${key}_${method}_${dpi}dpi.png`);
}

export function EditWindow() {
    const { t } = useTranslation(["tooltip", "keywords"]);
    useSettingsSync();

    const [imagePath, setImagePath] = useState<string | null>(null);
    const [originalUrl, setOriginalUrl] = useState<string | null>(null);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [imageName, setImageName] = useState<string | null>(null);
    const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(
        null
    );
    const [error, setError] = useState<string | null>(null);

    const [modifiers, setModifiers] = useState<AnyModifier[]>([]);
    const [editingModifierId, setEditingModifierId] = useState<string | null>(
        null
    );
    const [editingFftModifierId, setEditingFftModifierId] = useState<
        string | null
    >(null);
    const [isFftActive, setIsFftActive] = useState<boolean>(false);

    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const fftContainerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const fftCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const dpiCanvasRef = useRef<HTMLCanvasElement | null>(null);

    const left = useImagePanZoom(containerRef, imageRef, true);
    const right = useImagePanZoom(fftContainerRef, fftCanvasRef, isFftActive);
    const resetLeft = left.reset;
    const resetRight = right.reset;

    useEffect(() => {
        resetLeft();
        resetRight();
    }, [isFftActive, resetLeft, resetRight]);

    const cssFilter = buildCssFilter(modifiers);

    const activeFftModifier = modifiers.find(
        (m): m is FftModifier =>
            m.id === editingFftModifierId && m.type === "fft"
    );

    // Find the active raster modifier providing the current base image
    const activeRasterModifier = [...modifiers]
        .reverse()
        .find(
            m =>
                m.enabled &&
                (!isFftActive || m.id !== editingFftModifierId) &&
                ((isEnhancementModifier(m) &&
                    m.params.status === "ready" &&
                    Boolean(m.params.runtimeOutputUrl)) ||
                    (m.type === "fft" &&
                        (!isFftActive || m.id !== editingFftModifierId) &&
                        Boolean(m.params.runtimeOutputUrl)))
        );

    const displayUrl =
        (activeRasterModifier && isEnhancementModifier(activeRasterModifier)
            ? activeRasterModifier.params.runtimeOutputUrl
            : activeRasterModifier?.type === "fft"
              ? (activeRasterModifier as FftModifier).params.runtimeOutputUrl
              : null) ?? originalUrl;

    const handleFftApply = useCallback(
        (dataUrl: string, params?: Partial<FftParams>) => {
            if (editingFftModifierId) {
                setModifiers(prev =>
                    prev.map(m =>
                        m.id === editingFftModifierId
                            ? ({
                                  ...m,
                                  enabled: true,
                                  params: {
                                      ...m.params,
                                      ...params,
                                      runtimeOutputUrl: dataUrl,
                                  },
                              } as FftModifier)
                            : m
                    )
                );
            } else {
                const newMod = createFftModifier();
                newMod.params = {
                    ...newMod.params,
                    ...params,
                    runtimeOutputUrl: dataUrl,
                };
                setModifiers(prev => [...prev, newMod]);
            }
            setEditingFftModifierId(null);
            setIsFftActive(false);
            setPreviewImageUrl(null);
            resetLeft();
            resetRight();
            toast.success(
                t("FFT Filter applied", {
                    ns: "tooltip",
                    defaultValue: "FFT filter applied",
                })
            );
        },
        [editingFftModifierId, resetLeft, resetRight, t]
    );

    const handleCancelFft = useCallback(() => {
        if (editingFftModifierId) {
            const mod = modifiers.find(m => m.id === editingFftModifierId);
            if (mod && mod.type === "fft" && !mod.params.runtimeOutputUrl) {
                setModifiers(prev =>
                    prev.filter(m => m.id !== editingFftModifierId)
                );
            }
        }
        setEditingFftModifierId(null);
        setIsFftActive(false);
        resetLeft();
        resetRight();
    }, [editingFftModifierId, modifiers, resetLeft, resetRight]);

    const fft = useFftWorkspace({
        imageRef,
        spectrumCanvasRef: canvasRef,
        previewCanvasRef: fftCanvasRef,
        isActive: isFftActive,
        initialParams: activeFftModifier?.params,
        onToggleActive: setIsFftActive,
        onApply: handleFftApply,
        onWheel: left.handleWheel,
        onMiddleDrag: left.handleMiddleDrag,
    });

    useSyncedElement(imageRef, imageRef, containerRef, {
        displayUrl,
        isFftActive,
    });
    useSyncedElement(imageRef, canvasRef, containerRef, {
        displayUrl,
        isFftActive,
    });
    useSyncedElement(imageRef, dpiCanvasRef, containerRef, {
        displayUrl,
        isFftActive,
        syncDimensions: true,
    });
    useSyncedElement(imageRef, fftCanvasRef, fftContainerRef, {
        displayUrl,
        isFftActive,
        extraStyles: { zIndex: "11" },
    });

    const loadImage = useCallback(
        async (path: string) => {
            try {
                setError(null);
                setOriginalUrl(null);
                const url = await pathToBlobUrl(path);
                setOriginalUrl(url);
                setImageName(await basename(path));
                resetLeft();
                resetRight();
            } catch (err) {
                const msg =
                    err instanceof Error ? err.message : "Failed to load image";
                setError(`${msg} (Path: ${path})`);
                setOriginalUrl(null);
                setPreviewImageUrl(null);
            }
        },
        [resetLeft, resetRight]
    );

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const pathFromUrl = urlParams.get("imagePath");

        if (pathFromUrl) {
            const decodedPath = decodeURIComponent(pathFromUrl);
            const normalizedPath = decodedPath.replace(/\//g, "\\");
            setImagePath(normalizedPath);
            loadImage(normalizedPath);
        }

        let unlistenPromise: Promise<() => void> | null = null;
        listen<string>("image-path-changed", event => {
            setModifiers(prev => {
                prev.filter(isEnhancementModifier).forEach(m => {
                    if (m.params.runtimeOutputUrl) {
                        URL.revokeObjectURL(m.params.runtimeOutputUrl);
                    }
                });
                return [];
            });
            setImagePath(event.payload);
            loadImage(event.payload);
        }).then(u => {
            unlistenPromise = Promise.resolve(u);
        });

        return () => {
            if (unlistenPromise) {
                unlistenPromise.then(fn => fn());
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        return () => {
            if (originalUrl) {
                URL.revokeObjectURL(originalUrl);
            }
        };
    }, [originalUrl]);

    useEffect(() => {
        const liveUrls = new Set(
            modifiers
                .filter(isEnhancementModifier)
                .map(m => m.params.runtimeOutputUrl)
                .filter((u): u is string => Boolean(u))
        );
        return () => {
            liveUrls.forEach(u => URL.revokeObjectURL(u));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const img = imageRef.current;
        if (!img) return undefined;
        const updateSize = () => {
            setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
        };
        if (img.complete && img.naturalWidth) updateSize();
        img.addEventListener("load", updateSize);
        return () => img.removeEventListener("load", updateSize);
    }, [displayUrl]);

    const updateModifierParams = useCallback(
        (id: string, params: Partial<AnyModifier["params"]>) => {
            setModifiers(prev =>
                prev.map(m =>
                    m.id === id
                        ? ({
                              ...m,
                              params: { ...m.params, ...params },
                          } as AnyModifier)
                        : m
                )
            );
        },
        []
    );

    const runEnhancement = useCallback(
        async (
            modifierId: string,
            type: "gbfen" | "snfen",
            dpi: number,
            forceRerun = false
        ) => {
            if (!imagePath) {
                toast.error("No source image loaded");
                return;
            }

            const method = pyfingMethodFromType(type);

            updateModifierParams(modifierId, {
                status: "processing",
                errorMessage: null,
            } satisfies Partial<EnhancementParams> as Partial<
                AnyModifier["params"]
            >);

            try {
                const { nameWithoutExt } = await generateFilename(imagePath);

                const outputPath = await buildEnhancementOutputPath(
                    imagePath,
                    nameWithoutExt,
                    method,
                    dpi
                );
                const alreadyDone =
                    !forceRerun &&
                    (await exists(outputPath).catch(() => false));

                let finalOutputPath: string;
                let durationMs: number;

                if (alreadyDone) {
                    finalOutputPath = outputPath;
                    durationMs = 0;
                } else {
                    const cacheDir = await join(
                        await appLocalDataDir(),
                        "pyfing-cache"
                    );
                    await mkdir(cacheDir, { recursive: true });

                    const result = await runPyfingEnhancement({
                        imagePath,
                        outputPath,
                        method,
                        dpi,
                    });
                    finalOutputPath = result.outputPath;
                    durationMs = result.durationMs;
                }

                const url = await pathToBlobUrl(finalOutputPath);

                updateModifierParams(modifierId, {
                    status: "ready",
                    outputPath: finalOutputPath,
                    durationMs,
                    errorMessage: null,
                    runtimeOutputUrl: url,
                } satisfies Partial<EnhancementParams> as Partial<
                    AnyModifier["params"]
                >);

                if (alreadyDone) {
                    toast.info(
                        t("Enhancement: using existing output", {
                            ns: "tooltip",
                        })
                    );
                } else {
                    const toastKey =
                        type === "gbfen"
                            ? "Enhancement: GBFEN done in {{seconds}}s"
                            : "Enhancement: SNFEN done in {{seconds}}s";
                    toast.success(
                        t(toastKey, {
                            ns: "tooltip",
                            seconds: (durationMs / 1000).toFixed(1),
                        })
                    );
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                updateModifierParams(modifierId, {
                    status: "failed",
                    errorMessage: msg,
                    outputPath: null,
                    runtimeOutputUrl: null,
                } satisfies Partial<EnhancementParams> as Partial<
                    AnyModifier["params"]
                >);
                toast.error(
                    t("Enhancement failed: {{error}}", {
                        ns: "tooltip",
                        error: msg,
                    })
                );
            }
        },
        [imagePath, t, updateModifierParams]
    );

    const handleAddModifier = useCallback(
        (type: ModifierType) => {
            const def = MODIFIER_REGISTRY.find(d => d.type === type);
            if (!def) return;
            const newMod = def.create() as AnyModifier;
            setModifiers(prev => [...prev, newMod]);

            if (type === "gbfen" || type === "snfen") {
                const { dpi } = newMod.params as EnhancementParams;
                runEnhancement(newMod.id, type, dpi).catch(() => {});
                return;
            }

            if (type === "fft") {
                setEditingFftModifierId(newMod.id);
                setIsFftActive(true);
                return;
            }

            // setTimeout so the DropdownMenu close event doesn't immediately dismiss the dialog
            setTimeout(() => setEditingModifierId(newMod.id), 50);
        },
        [runEnhancement]
    );

    const handleEditModifier = useCallback(
        (id: string) => {
            const target = modifiers.find(m => m.id === id);
            if (!target) return;
            if (target.type === "fft") {
                setEditingFftModifierId(id);
                setIsFftActive(true);
                return;
            }
            setEditingModifierId(id);
        },
        [modifiers]
    );

    const handleUpdateModifier = useCallback(
        (id: string, params: Partial<AnyModifier["params"]>) => {
            updateModifierParams(id, params);
        },
        [updateModifierParams]
    );

    const handleToggleModifier = useCallback((id: string) => {
        setModifiers(prev =>
            prev.map(m => (m.id === id ? { ...m, enabled: !m.enabled } : m))
        );
    }, []);

    const handleRemoveModifier = useCallback((id: string) => {
        setModifiers(prev => {
            const target = prev.find(m => m.id === id);
            if (target) {
                if (isEnhancementModifier(target)) {
                    const url = target.params.runtimeOutputUrl;
                    if (url) URL.revokeObjectURL(url);
                } else if (
                    target.type === "fft" &&
                    target.params.runtimeOutputUrl?.startsWith("blob:")
                ) {
                    URL.revokeObjectURL(target.params.runtimeOutputUrl);
                }
            }
            return prev.filter(m => m.id !== id);
        });
        setEditingModifierId(prev => (prev === id ? null : prev));
        setEditingFftModifierId(prev => {
            if (prev === id) {
                setIsFftActive(false);
                return null;
            }
            return prev;
        });
    }, []);

    const handleReorderModifiers = useCallback(
        (fromIndex: number, toIndex: number) => {
            setModifiers(prev => {
                const next = [...prev];
                const [removed] = next.splice(fromIndex, 1);
                next.splice(toIndex, 0, removed!);
                return next;
            });
        },
        []
    );

    const handleRerunEnhancement = useCallback(
        (id: string) => {
            const target = modifiers.find(m => m.id === id);
            if (!target || !isEnhancementModifier(target)) return;
            if (target.params.runtimeOutputUrl) {
                URL.revokeObjectURL(target.params.runtimeOutputUrl);
                updateModifierParams(id, {
                    runtimeOutputUrl: null,
                } satisfies Partial<EnhancementParams> as Partial<
                    AnyModifier["params"]
                >);
            }
            runEnhancement(id, target.type, target.params.dpi, true).catch(
                () => {}
            );
        },
        [modifiers, runEnhancement, updateModifierParams]
    );

    const editingModifier =
        modifiers.find(m => m.id === editingModifierId) ?? null;

    const saveEditedImage = async () => {
        if (!displayUrl || !imagePath || !imageRef.current) return;
        try {
            const uint8Array = await applyPipelineToImage(
                imageRef.current,
                modifiers
            );

            const { nameWithoutExt, extWithDot } =
                await generateFilename(imagePath);
            const imageDir = await dirname(imagePath);

            const modifierSuffix = modifiers
                .filter(m => m.enabled)
                .map(m => {
                    if (m.type === "gbfen") return "GBFEN";
                    if (m.type === "snfen") return "SNFEN";
                    if (m.type === "brightness") return "brightness";
                    if (m.type === "contrast") return "contrast";
                    if (m.type === "levels") return "levels";
                    if (m.type === "curves") return "curves";
                    return "fft";
                })
                .join("_");

            const suffix = modifierSuffix ? `_${modifierSuffix}` : "_edited";
            const finalPath = await join(
                imageDir,
                `${nameWithoutExt}${suffix}${extWithDot}`
            );

            await writeFile(finalPath, uint8Array);
            const fileWasWritten = await exists(finalPath);
            if (!fileWasWritten)
                throw new Error(`File was not created at path: ${finalPath}`);

            toast.success(t("Image saved successfully", { ns: "tooltip" }));
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            toast.error(
                t("Failed to save image: {{error}}", {
                    ns: "tooltip",
                    error: msg,
                })
            );
        }
    };

    const enhancing = modifiers.some(
        m =>
            isEnhancementModifier(m) &&
            (m.params.status === "processing" || m.params.status === "pending")
    );

    return (
        <main
            data-testid="edit-window"
            className="flex w-full min-h-dvh h-full flex-col items-center justify-between bg-[hsl(var(--background))] relative overflow-hidden"
        >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[75%] h-[85%] brightness-150 rounded-2xl bg-primary/20 blur-[150px]" />
            </div>

            <Menubar
                className={cn(
                    "flex justify-between w-screen items-center min-h-[56px]"
                )}
                data-tauri-drag-region
            >
                <div className="flex grow-1 items-center">
                    <div className="flex items-center px-2">
                        <Edit
                            size={ICON.SIZE}
                            strokeWidth={ICON.STROKE_WIDTH}
                            className="text-foreground"
                        />
                    </div>
                    <span className="text-sm font-medium text-foreground">
                        {t("Edit Image", { ns: "keywords" })}
                    </span>
                </div>
                <WindowControls />
            </Menubar>

            <div className="flex flex-1 w-full overflow-hidden flex-row">
                <div className="flex flex-1 overflow-hidden p-4 flex-col">
                    {error ? (
                        <div className="text-center flex-1 flex items-center justify-center">
                            <div>
                                <p className="text-destructive text-lg font-medium mb-2">
                                    Error loading image
                                </p>
                                <p className="text-muted-foreground text-sm">
                                    {error}
                                </p>
                            </div>
                        </div>
                    ) : displayUrl ? (
                        <ImagePanes
                            imageUrl={previewImageUrl || displayUrl}
                            imagePath={imagePath}
                            isFftActive={isFftActive}
                            fftStatus={fft.status}
                            containerRef={containerRef}
                            imageRef={imageRef}
                            spectrumCanvasRef={canvasRef}
                            dpiCanvasRef={dpiCanvasRef}
                            brightness={100}
                            contrast={100}
                            cssFilter={previewImageUrl ? "none" : cssFilter}
                            zoom={left.zoom}
                            pan={left.pan}
                            isDragging={left.isDragging}
                            onWheel={left.handleWheel}
                            onMouseDown={left.handleMouseDown}
                            onMouseMove={left.handleMouseMove}
                            onMouseUp={left.handleMouseUp}
                            onDoubleClick={left.reset}
                            onResetZoom={left.reset}
                            fftContainerRef={fftContainerRef}
                            previewCanvasRef={fftCanvasRef}
                            rightPanZoom={right.zoom}
                            rightPan={right.pan}
                            isRightDragging={right.isDragging}
                            onRightWheel={right.handleWheel}
                            onRightMouseDown={e =>
                                right.handleMouseDown(e, [0, 1])
                            }
                            onRightMouseMove={right.handleMouseMove}
                            onRightMouseUp={right.handleMouseUp}
                            onRightDoubleClick={right.reset}
                            onResetRightZoom={right.reset}
                        />
                    ) : (
                        <div className="text-center flex-1 flex items-center justify-center">
                            <div>
                                <p className="text-muted-foreground text-lg font-medium">
                                    No image
                                </p>
                                <p className="text-muted-foreground/70 text-sm mt-2">
                                    Load an image in the main window to edit it
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="w-72 border-l border-border/30 bg-background/50 backdrop-blur-md flex flex-col h-[calc(100vh-56px)]">
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                        {imageName && (
                            <div className="flex flex-col gap-1">
                                <h3 className="text-sm font-semibold text-muted-foreground">
                                    Info
                                </h3>
                                <p
                                    className="text-xs text-foreground truncate"
                                    title={imageName}
                                >
                                    {imageName}
                                </p>
                                {imageSize && (
                                    <p className="text-xs text-muted-foreground">
                                        {imageSize.w} × {imageSize.h} px
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="border-t border-border/30" />

                        <div className="flex flex-col gap-3">
                            <h3 className="text-sm font-semibold text-muted-foreground">
                                {t("Adjustments", { ns: "keywords" })}
                            </h3>
                            {!isFftActive ? (
                                <>
                                    <ModifierList
                                        modifiers={modifiers}
                                        onEdit={handleEditModifier}
                                        onToggle={handleToggleModifier}
                                        onRemove={handleRemoveModifier}
                                        onReorder={handleReorderModifiers}
                                    />
                                    <AddModifierButton
                                        onAdd={handleAddModifier}
                                        disabled={!originalUrl || isFftActive}
                                    />
                                    {enhancing && (
                                        <p className="text-xs text-primary animate-pulse text-center">
                                            {t("Enhancing image...", {
                                                ns: "tooltip",
                                            })}
                                        </p>
                                    )}
                                </>
                            ) : (
                                <SidebarFFT
                                    fft={fft}
                                    onCancel={handleCancelFft}
                                />
                            )}
                        </div>

                        <div className="border-t border-border/30" />

                        <div className="flex flex-col gap-2">
                            <h3 className="text-sm font-semibold text-muted-foreground">
                                DPI
                            </h3>
                            <ImageDpiControls
                                imageRef={imageRef}
                                canvasRef={dpiCanvasRef}
                                disabled={isFftActive}
                            />
                        </div>
                    </div>

                    <div className="p-4 border-t border-border/30 bg-background">
                        <Button
                            onClick={saveEditedImage}
                            className="w-full"
                            size="lg"
                            disabled={!displayUrl || !imagePath || isFftActive}
                            id="save-edited-image-button"
                        >
                            <Save size={ICON.SIZE} className="mr-2" />
                            {t("Save", { ns: "tooltip" })}
                        </Button>
                    </div>
                </div>
            </div>

            <ModifierSettingsDialog
                modifier={editingModifier}
                imageRef={imageRef}
                open={editingModifierId !== null}
                onClose={() => setEditingModifierId(null)}
                onUpdate={handleUpdateModifier}
                onRerunEnhancement={handleRerunEnhancement}
            />
        </main>
    );
}
