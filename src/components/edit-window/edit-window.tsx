import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { WindowControls } from "@/components/menu/window-controls";
import { MacOSTitleBarSpacer } from "@/components/menu/macos-titlebar-spacer";
import { IS_MACOS } from "@/lib/utils/platform";
import { Menubar } from "@/components/ui/menubar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/shadcn";
import { ICON } from "@/lib/utils/const";
import { Edit, Save } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
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
    normalize,
    appLocalDataDir,
} from "@tauri-apps/api/path";
import { CustomThemeStore } from "@/lib/stores/CustomTheme";
import { GlobalSettingsStore } from "@/lib/stores/GlobalSettings";
import { applyCustomTheme } from "@/lib/hooks/useCustomTheme";
import { toast } from "sonner";
import { useSettingsSync } from "@/lib/hooks/useSettingsSync";
import ImageDpiControls from "@/components/edit-window/dpi/image-dpi-controls";
import {
    AnyModifier,
    EnhancementModifier,
    EnhancementParams,
    ModifierType,
    isEnhancementModifier,
} from "@/lib/imageModifiers/types";
import {
    MODIFIER_REGISTRY,
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

    const [zoom, setZoom] = useState<number>(1);
    const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [dragStart, setDragStart] = useState<{ x: number; y: number }>({
        x: 0,
        y: 0,
    });

    const [modifiers, setModifiers] = useState<AnyModifier[]>([]);
    const [editingModifierId, setEditingModifierId] = useState<string | null>(
        null
    );

    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const TRANSFORM_ORIGIN = "center center";

    const cssFilter = buildCssFilter(modifiers);

    const activeEnhancement = [...modifiers]
        .toReversed()
        .find(
            (m): m is EnhancementModifier =>
                isEnhancementModifier(m) &&
                m.enabled &&
                m.params.status === "ready" &&
                Boolean(m.params.runtimeOutputUrl)
        );

    const displayUrl =
        activeEnhancement?.params.runtimeOutputUrl ?? originalUrl;

    const loadImage = useCallback(async (path: string) => {
        try {
            setError(null);
            setOriginalUrl(null);
            const url = await pathToBlobUrl(path);
            setOriginalUrl(url);
            setImageName(await basename(path));
            setZoom(1);
            setPan({ x: 0, y: 0 });
        } catch (err) {
            const msg =
                err instanceof Error ? err.message : "Failed to load image";
            setError(`${msg} (Path: ${path})`);
            setOriginalUrl(null);
            setPreviewImageUrl(null);
        }
    }, []);

    useEffect(() => {
        if (!imageRef.current || !originalUrl) return;

        const hasCanvasModifier = modifiers.some(
            m => m.enabled && (m.type === "levels" || m.type === "curves")
        );

        if (!hasCanvasModifier) {
            setPreviewImageUrl(null);
            return;
        }

        let cancelled = false;
        const runPipeline = async () => {
            try {
                const previewModifiers = modifiers.filter(
                    m => m.type !== "fft"
                );
                const uint8Array = await applyPipelineToImage(
                    imageRef.current!,
                    previewModifiers
                );
                if (cancelled) return;
                const blob = new Blob([uint8Array as BlobPart], {
                    type: "image/png",
                });
                const url = URL.createObjectURL(blob);
                setPreviewImageUrl(prev => {
                    if (prev) URL.revokeObjectURL(prev);
                    return url;
                });
            } catch (err) {
                if (!cancelled) console.error("Preview pipeline failed", err);
            }
        };

        const timer = setTimeout(runPipeline, 100);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [modifiers, originalUrl]);

    useEffect(() => {
        return () => {
            if (previewImageUrl) URL.revokeObjectURL(previewImageUrl);
        };
    }, [previewImageUrl]);

    const handleWheel = (e: React.WheelEvent<HTMLButtonElement>) => {
        if (!displayUrl || !containerRef.current || !imageRef.current) return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(10, zoom * delta));
        const containerRect = containerRef.current.getBoundingClientRect();
        const cx = containerRect.width / 2;
        const cy = containerRect.height / 2;
        const mx = e.clientX - containerRect.left;
        const my = e.clientY - containerRect.top;
        const imageX = (mx - cx - pan.x) / zoom;
        const imageY = (my - cy - pan.y) / zoom;
        setZoom(newZoom);
        setPan({
            x: mx - cx - imageX * newZoom,
            y: my - cy - imageY * newZoom,
        });
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (e.button !== 0) return;
        setIsDragging(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!isDragging) return;
        setPan({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y,
        });
    };

    const handleMouseUp = () => setIsDragging(false);

    const handleDoubleClick = () => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };
    const resetZoom = () => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };

    function syncCanvasToImage(img: HTMLImageElement, cvs: HTMLCanvasElement) {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        Object.assign(cvs, { width, height });
        Object.assign(cvs.style, {
            width: `${img.width}px`,
            height: `${img.height}px`,
            position: "absolute",
            zIndex: "10",
        });
        const ctx = cvs.getContext("2d")!;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    useEffect(() => {
        const init = async () => {
            await CustomThemeStore.rehydrate();
            await GlobalSettingsStore.use.persist?.rehydrate?.();
            const activeTheme = CustomThemeStore.getActiveTheme();
            if (activeTheme) {
                applyCustomTheme(activeTheme);
            }
            await new Promise(resolve => setTimeout(resolve, 0));
            await invoke("show_current_window");

            const urlParams = new URLSearchParams(window.location.search);
            const pathFromUrl = urlParams.get("imagePath");

            if (pathFromUrl) {
                const normalizedPath = await normalize(
                    decodeURIComponent(pathFromUrl)
                );
                setImagePath(normalizedPath);
                await loadImage(normalizedPath);
            }
        };
        init();

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

    useEffect(() => {
        const img = imageRef.current;
        const canvas = canvasRef.current;
        if (!img || !canvas) return undefined;

        const sync = () => {
            requestAnimationFrame(() => syncCanvasToImage(img, canvas));
        };

        const resizeObserver = new ResizeObserver(sync);
        resizeObserver.observe(img);

        if (img.complete) sync();
        img.addEventListener("load", sync);

        return () => {
            resizeObserver.disconnect();
            img.removeEventListener("load", sync);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

            // setTimeout so the DropdownMenu close event doesn't immediately dismiss the dialog
            setTimeout(() => setEditingModifierId(newMod.id), 50);
        },
        [runEnhancement]
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
            if (target && isEnhancementModifier(target)) {
                const url = target.params.runtimeOutputUrl;
                if (url) URL.revokeObjectURL(url);
            }
            return prev.filter(m => m.id !== id);
        });
        setEditingModifierId(prev => (prev === id ? null : prev));
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
            className="flex size-full min-h-dvh flex-col items-center justify-between bg-[hsl(var(--background))] relative overflow-hidden"
        >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[75%] h-[85%] brightness-150 rounded-2xl bg-primary/20 blur-[150px]" />
            </div>

            <Menubar
                className={cn(
                    "flex justify-between w-screen items-center",
                    IS_MACOS
                        ? "h-9 pt-3 [&_button]:h-7 [&_button]:px-2"
                        : "min-h-14"
                )}
                data-tauri-drag-region
            >
                <div className="flex grow items-center" data-tauri-drag-region>
                    <MacOSTitleBarSpacer />
                    <div
                        className="flex items-center px-2"
                        data-tauri-drag-region
                    >
                        <Edit
                            size={ICON.SIZE}
                            strokeWidth={ICON.STROKE_WIDTH}
                            className="text-foreground"
                        />
                    </div>
                    <span
                        className="text-sm font-medium text-foreground"
                        data-tauri-drag-region
                    >
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
                        <div
                            ref={containerRef}
                            className="flex-1 w-full flex items-center justify-center overflow-hidden mb-4 relative"
                        >
                            <button
                                type="button"
                                className="absolute inset-0 cursor-grab active:cursor-grabbing bg-transparent border-0 p-0"
                                aria-label="Image viewer with zoom and pan controls"
                                onWheel={handleWheel}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                                onDoubleClick={handleDoubleClick}
                                onKeyDown={e => {
                                    if (e.key === "Escape") {
                                        resetZoom();
                                    }
                                }}
                            />
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                ref={imageRef}
                                src={originalUrl || ""}
                                alt="Original hidden"
                                className="absolute max-w-full max-h-full object-contain select-none pointer-events-none opacity-0"
                                style={{
                                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                                    transformOrigin: TRANSFORM_ORIGIN,
                                    transition: isDragging
                                        ? "none"
                                        : "transform 0.1s ease-out",
                                }}
                                draggable={false}
                            />
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={previewImageUrl || displayUrl || ""}
                                alt={imagePath || "Loaded image"}
                                className="max-w-full max-h-full object-contain select-none pointer-events-none"
                                style={{
                                    filter: previewImageUrl
                                        ? "none"
                                        : cssFilter,
                                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                                    transformOrigin: TRANSFORM_ORIGIN,
                                    transition: isDragging
                                        ? "none"
                                        : "transform 0.1s ease-out",
                                }}
                                draggable={false}
                            />
                            <canvas
                                ref={canvasRef}
                                className="absolute pointer-events-none"
                                style={{
                                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                                    transformOrigin: TRANSFORM_ORIGIN,
                                }}
                            />
                            {zoom !== 1 && (
                                <div className="absolute top-2 right-2">
                                    <Button
                                        onClick={resetZoom}
                                        variant="outline"
                                        size="sm"
                                        className="bg-background/80 backdrop-blur-sm"
                                    >
                                        {t("Reset Zoom", { ns: "tooltip" })}
                                    </Button>
                                </div>
                            )}
                        </div>
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

                <div className="w-64 border-l border-border/30 bg-background/50 backdrop-blur-md flex flex-col h-[calc(100vh-56px)]">
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
                            <ModifierList
                                modifiers={modifiers}
                                onEdit={setEditingModifierId}
                                onToggle={handleToggleModifier}
                                onRemove={handleRemoveModifier}
                                onReorder={handleReorderModifiers}
                            />
                            <AddModifierButton
                                onAdd={handleAddModifier}
                                disabled={!originalUrl}
                            />
                            {enhancing && (
                                <p className="text-xs text-primary animate-pulse text-center">
                                    {t("Enhancing image...", { ns: "tooltip" })}
                                </p>
                            )}
                        </div>

                        <div className="border-t border-border/30" />

                        <div className="flex flex-col gap-2">
                            <h3 className="text-sm font-semibold text-muted-foreground">
                                DPI
                            </h3>
                            <ImageDpiControls
                                imageRef={imageRef}
                                canvasRef={canvasRef}
                            />
                        </div>
                    </div>

                    <div className="p-4 border-t border-border/30 bg-background">
                        <Button
                            onClick={saveEditedImage}
                            className="w-full"
                            size="lg"
                            disabled={!displayUrl || !imagePath}
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
