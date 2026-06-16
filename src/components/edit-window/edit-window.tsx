import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { WindowControls } from "@/components/menu/window-controls";
import { Menubar } from "@/components/ui/menubar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/shadcn";
import { ICON } from "@/lib/utils/const";
import {
    Edit,
    Save,
    RotateCw,
    RotateCcw,
    FlipHorizontal,
    FlipVertical,
} from "lucide-react";
import { listen, emit } from "@tauri-apps/api/event";
import { readFile, writeFile, exists } from "@tauri-apps/plugin-fs";
import { basename, extname, join, dirname } from "@tauri-apps/api/path";
import { toast } from "sonner";
import { useSettingsSync } from "@/lib/hooks/useSettingsSync";
import ImageDpiControls from "@/components/edit-window/dpi/image-dpi-controls";
import { ImageCropControls } from "@/components/edit-window/crop/image-crop-controls";
import { AnyModifier, ModifierType } from "@/lib/imageModifiers/types";
import {
    MODIFIER_REGISTRY,
    buildCssFilter,
    hasCanvasModifiers,
} from "@/lib/imageModifiers/registry";
import { applyPipelineToImage } from "@/lib/imageModifiers/pipeline";
import { AddModifierButton } from "@/components/edit-window/modifiers/AddModifierButton";
import { ModifierList } from "@/components/edit-window/modifiers/ModifierList";
import { ModifierSettingsDialog } from "@/components/edit-window/modifiers/ModifierSettingsDialog";

const CANVAS_CONTEXT_UNAVAILABLE = "Canvas context unavailable";
const FAILED_TO_SAVE_IMAGE_KEY = "Failed to save image: {{error}}";
const FAILED_TO_TRANSFORM_IMAGE_KEY = "Failed to transform image: {{error}}";
const FAILED_TO_CROP_IMAGE_KEY = "Failed to crop image: {{error}}";
const FAILED_TO_SCALE_IMAGE_KEY = "Failed to scale image: {{error}}";

// ─── File helpers (unchanged from old implementation) ─────────────────────────

async function findUniqueFilePath(
    directory: string,
    baseName: string,
    timestamp: string,
    extension: string,
    initialPath: string
): Promise<string> {
    let fileExists = false;
    try {
        fileExists = await exists(initialPath);
    } catch {
        return initialPath;
    }
    if (!fileExists) return initialPath;

    const maxAttempts = 100;
    const pathsToCheck: Promise<{ path: string; exists: boolean }>[] = [];
    for (let i = 1; i <= maxAttempts; i += 1) {
        const numberedFilename = `${baseName}_edited_${timestamp}_${i}${extension}`;
        const numberedPathPromise = join(directory, numberedFilename);
        pathsToCheck.push(
            numberedPathPromise.then(path =>
                exists(path)
                    .then(e => ({ path, exists: e }))
                    .catch(() => ({ path, exists: false }))
            )
        );
    }
    const results = await Promise.all(pathsToCheck);
    const firstAvailable = results.find(r => !r.exists);
    return (
        firstAvailable?.path ?? results[results.length - 1]?.path ?? initialPath
    );
}

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
    // The DOM Blob typings use ArrayBuffer while Tauri returns a typed array.
    const blob = new Blob([bytes as unknown as ArrayBuffer], {
        type: "image/png",
    });
    return URL.createObjectURL(blob);
}

async function canvasToBlobUrl(canvas: HTMLCanvasElement): Promise<string> {
    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            b => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
            "image/png",
            1.0
        );
    });
    return URL.createObjectURL(blob);
}

async function loadImageElement(src: string): Promise<HTMLImageElement> {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    await img.decode();
    return img;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EditWindow() {
    const { t } = useTranslation(["tooltip", "keywords"]);
    useSettingsSync();

    // ── Image state ──────────────────────────────────────────────────────────
    const [imagePath, setImagePath] = useState<string | null>(null);
    const [originalUrl, setOriginalUrl] = useState<string | null>(null);
    const [processedPreviewUrl, setProcessedPreviewUrl] = useState<
        string | null
    >(null);
    const [imageName, setImageName] = useState<string | null>(null);
    const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(
        null
    );
    const [error, setError] = useState<string | null>(null);

    // ── View state ───────────────────────────────────────────────────────────
    const [zoom, setZoom] = useState<number>(1);
    const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [overlayMode, setOverlayMode] = useState<"none" | "crop" | "dpi">(
        "none"
    );
    const [dragStart, setDragStart] = useState<{ x: number; y: number }>({
        x: 0,
        y: 0,
    });

    // ── Modifier pipeline state ──────────────────────────────────────────────
    const [modifiers, setModifiers] = useState<AnyModifier[]>([]);
    const [editingModifierId, setEditingModifierId] = useState<string | null>(
        null
    );

    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const TRANSFORM_ORIGIN = "center center";

    // ── CSS filter fallback (pixel-accurate preview is canvas-rendered) ──────
    const cssFilter = buildCssFilter();

    const baseDisplayUrl = originalUrl;
    const displayUrl = processedPreviewUrl ?? baseDisplayUrl;

    // ── Image loading ────────────────────────────────────────────────────────

    const loadImage = useCallback(async (path: string) => {
        try {
            setError(null);
            setOriginalUrl(null);
            setProcessedPreviewUrl(null);
            setModifiers([]);
            setOverlayMode("none");
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
        }
    }, []);

    // ── Wheel / pan handlers ─────────────────────────────────────────────────

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

    // ── Canvas sync (DPI overlay) ────────────────────────────────────────────

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

    // ── Effects ──────────────────────────────────────────────────────────────

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
    }, [loadImage]);

    useEffect(() => {
        return () => {
            if (originalUrl) {
                URL.revokeObjectURL(originalUrl);
            }
        };
    }, [originalUrl]);

    useEffect(() => {
        return () => {
            if (processedPreviewUrl) {
                URL.revokeObjectURL(processedPreviewUrl);
            }
        };
    }, [processedPreviewUrl]);

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
        let cancelled = false;
        let nextUrl: string | null = null;

        async function renderPreview() {
            if (!baseDisplayUrl || !hasCanvasModifiers(modifiers)) {
                setProcessedPreviewUrl(current => {
                    if (current) URL.revokeObjectURL(current);
                    return null;
                });
                return;
            }

            try {
                const source = await loadImageElement(baseDisplayUrl);
                const bytes = await applyPipelineToImage(source, modifiers);
                const blob = new Blob([bytes as unknown as ArrayBuffer], {
                    type: "image/png",
                });
                nextUrl = URL.createObjectURL(blob);
                if (cancelled) {
                    URL.revokeObjectURL(nextUrl);
                    return;
                }
                setProcessedPreviewUrl(current => {
                    if (current) URL.revokeObjectURL(current);
                    return nextUrl;
                });
            } catch {
                if (nextUrl) URL.revokeObjectURL(nextUrl);
            }
        }

        renderPreview();

        return () => {
            cancelled = true;
        };
    }, [baseDisplayUrl, modifiers]);

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

    // ── Modifier helpers ─────────────────────────────────────────────────────

    const handleAddModifier = useCallback((type: ModifierType) => {
        const def = MODIFIER_REGISTRY.find(d => d.type === type);
        if (!def) return;
        const newMod = def.create() as AnyModifier;
        setModifiers(prev => [...prev, newMod]);
        setEditingModifierId(newMod.id);
    }, []);

    const handleUpdateModifier = useCallback(
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

    const handleToggleModifier = useCallback((id: string) => {
        setModifiers(prev =>
            prev.map(m => (m.id === id ? { ...m, enabled: !m.enabled } : m))
        );
    }, []);

    const handleRemoveModifier = useCallback((id: string) => {
        setModifiers(prev => prev.filter(m => m.id !== id));
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

    const editingModifier =
        modifiers.find(m => m.id === editingModifierId) ?? null;

    // ── Structural edits (commit to current base image) ──────────────────────

    const replaceBaseImageFromCanvas = useCallback(
        async (canvas: HTMLCanvasElement) => {
            const nextUrl = await canvasToBlobUrl(canvas);
            setOriginalUrl(current => {
                if (current) URL.revokeObjectURL(current);
                return nextUrl;
            });
            setProcessedPreviewUrl(current => {
                if (current) URL.revokeObjectURL(current);
                return null;
            });
            const overlayCanvas = canvasRef.current;
            const overlayCtx = overlayCanvas?.getContext("2d");
            if (overlayCanvas && overlayCtx) {
                overlayCtx.clearRect(
                    0,
                    0,
                    overlayCanvas.width,
                    overlayCanvas.height
                );
            }
            setOverlayMode("none");
            setZoom(1);
            setPan({ x: 0, y: 0 });
        },
        []
    );

    const getBaseImage = useCallback(async () => {
        if (!baseDisplayUrl) throw new Error("No image loaded");
        return loadImageElement(baseDisplayUrl);
    }, [baseDisplayUrl]);

    const applyTransform = useCallback(
        async (
            operation:
                | "rotate90cw"
                | "rotate90ccw"
                | "rotate180"
                | "flipHorizontal"
                | "flipVertical"
        ) => {
            try {
                const source = await getBaseImage();
                const rotate90 =
                    operation === "rotate90cw" || operation === "rotate90ccw";
                const canvas = document.createElement("canvas");
                canvas.width = rotate90
                    ? source.naturalHeight
                    : source.naturalWidth;
                canvas.height = rotate90
                    ? source.naturalWidth
                    : source.naturalHeight;
                const ctx = canvas.getContext("2d");
                if (!ctx) throw new Error(CANVAS_CONTEXT_UNAVAILABLE);

                if (operation === "rotate90cw") {
                    ctx.translate(canvas.width, 0);
                    ctx.rotate(Math.PI / 2);
                } else if (operation === "rotate90ccw") {
                    ctx.translate(0, canvas.height);
                    ctx.rotate(-Math.PI / 2);
                } else if (operation === "rotate180") {
                    ctx.translate(canvas.width, canvas.height);
                    ctx.rotate(Math.PI);
                } else if (operation === "flipHorizontal") {
                    ctx.translate(canvas.width, 0);
                    ctx.scale(-1, 1);
                } else if (operation === "flipVertical") {
                    ctx.translate(0, canvas.height);
                    ctx.scale(1, -1);
                }

                ctx.drawImage(source, 0, 0);
                await replaceBaseImageFromCanvas(canvas);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                toast.error(
                    t(FAILED_TO_TRANSFORM_IMAGE_KEY, {
                        ns: "tooltip",
                        error: msg,
                    })
                );
            }
        },
        [getBaseImage, replaceBaseImageFromCanvas, t]
    );

    const applyCrop = useCallback(
        async (rect: {
            x: number;
            y: number;
            width: number;
            height: number;
        }) => {
            try {
                const source = await getBaseImage();
                const x = Math.max(
                    0,
                    Math.min(source.naturalWidth - 1, rect.x)
                );
                const y = Math.max(
                    0,
                    Math.min(source.naturalHeight - 1, rect.y)
                );
                const width = Math.max(
                    1,
                    Math.min(source.naturalWidth - x, rect.width)
                );
                const height = Math.max(
                    1,
                    Math.min(source.naturalHeight - y, rect.height)
                );
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) throw new Error(CANVAS_CONTEXT_UNAVAILABLE);
                ctx.drawImage(source, x, y, width, height, 0, 0, width, height);
                await replaceBaseImageFromCanvas(canvas);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                toast.error(
                    t(FAILED_TO_CROP_IMAGE_KEY, {
                        ns: "tooltip",
                        error: msg,
                    })
                );
            }
        },
        [getBaseImage, replaceBaseImageFromCanvas, t]
    );

    const applyScale = useCallback(
        (scaleFactor: number) => {
            getBaseImage()
                .then(source => {
                    const canvas = document.createElement("canvas");
                    const sourceWidth = source.naturalWidth;
                    const sourceHeight = source.naturalHeight;
                    canvas.width = Math.max(
                        1,
                        Math.round(sourceWidth * scaleFactor)
                    );
                    canvas.height = Math.max(
                        1,
                        Math.round(sourceHeight * scaleFactor)
                    );
                    const ctx = canvas.getContext("2d");
                    if (!ctx) throw new Error(CANVAS_CONTEXT_UNAVAILABLE);
                    ctx.imageSmoothingQuality = "low";
                    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
                    return replaceBaseImageFromCanvas(canvas).then(() => {
                        const scaleText = scaleFactor.toFixed(3);
                        if (
                            canvas.width === sourceWidth &&
                            canvas.height === sourceHeight
                        ) {
                            toast.info(
                                t("DPI scale unchanged", {
                                    ns: "tooltip",
                                    scale: scaleText,
                                    width: canvas.width,
                                    height: canvas.height,
                                })
                            );
                            return;
                        }

                        toast.success(
                            t("DPI scale applied", {
                                ns: "tooltip",
                                scale: scaleText,
                                sourceWidth,
                                sourceHeight,
                                width: canvas.width,
                                height: canvas.height,
                            })
                        );
                    });
                })
                .catch(err => {
                    const msg =
                        err instanceof Error ? err.message : String(err);
                    toast.error(
                        t(FAILED_TO_SCALE_IMAGE_KEY, {
                            ns: "tooltip",
                            error: msg,
                        })
                    );
                });
        },
        [getBaseImage, replaceBaseImageFromCanvas, t]
    );

    // ── Save ─────────────────────────────────────────────────────────────────

    const saveEditedImage = async () => {
        if (!baseDisplayUrl || !imagePath) return;
        try {
            const source = await loadImageElement(baseDisplayUrl);
            const uint8Array = await applyPipelineToImage(source, modifiers);

            const { nameWithoutExt, extWithDot, timestamp } =
                await generateFilename(imagePath);
            const newFilename = `${nameWithoutExt}_edited_${timestamp}${extWithDot}`;
            const imageDir = await dirname(imagePath);
            const newImagePath = await join(imageDir, newFilename);
            const finalPath = await findUniqueFilePath(
                imageDir,
                nameWithoutExt,
                timestamp,
                extWithDot,
                newImagePath
            );

            await writeFile(finalPath, uint8Array);
            const fileWasWritten = await exists(finalPath);
            if (!fileWasWritten)
                throw new Error(`File was not created at path: ${finalPath}`);

            await emit("image-reload-requested", {
                originalPath: imagePath,
                newPath: finalPath,
            });

            toast.success(t("Image saved successfully", { ns: "tooltip" }));
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            toast.error(
                t(FAILED_TO_SAVE_IMAGE_KEY, {
                    ns: "tooltip",
                    error: msg,
                })
            );
        }
    };

    // ─────────────────────────────────────────────────────────────────────────

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
                {/* ── Image viewer ─────────────────────────────────────────── */}
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
                                src={displayUrl}
                                alt={imagePath || "Loaded image"}
                                className="max-w-full max-h-full object-contain select-none pointer-events-none"
                                style={{
                                    filter: cssFilter,
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
                                    pointerEvents:
                                        overlayMode === "none"
                                            ? "none"
                                            : "auto",
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

                {/* ── Sidebar ───────────────────────────────────────────────── */}
                <div className="w-64 border-l border-border/30 bg-background/50 backdrop-blur-md flex flex-col h-[calc(100vh-56px)]">
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                        {/* Image info */}
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

                        {/* Structural operations */}
                        <div className="flex flex-col gap-3">
                            <h3 className="text-sm font-semibold text-muted-foreground">
                                {t("Transformations", { ns: "keywords" })}
                            </h3>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!baseDisplayUrl}
                                    title={t("Rotate 90° left", {
                                        ns: "tooltip",
                                    })}
                                    onClick={() =>
                                        applyTransform("rotate90ccw")
                                    }
                                >
                                    <RotateCcw size={ICON.SIZE} />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!baseDisplayUrl}
                                    title={t("Rotate 90° right", {
                                        ns: "tooltip",
                                    })}
                                    onClick={() => applyTransform("rotate90cw")}
                                >
                                    <RotateCw size={ICON.SIZE} />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!baseDisplayUrl}
                                    title={t("Rotate 180°", {
                                        ns: "tooltip",
                                    })}
                                    onClick={() => applyTransform("rotate180")}
                                >
                                    180°
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!baseDisplayUrl}
                                    title={t("Flip horizontal", {
                                        ns: "tooltip",
                                    })}
                                    onClick={() =>
                                        applyTransform("flipHorizontal")
                                    }
                                >
                                    <FlipHorizontal size={ICON.SIZE} />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!baseDisplayUrl}
                                    title={t("Flip vertical", {
                                        ns: "tooltip",
                                    })}
                                    onClick={() =>
                                        applyTransform("flipVertical")
                                    }
                                    className="col-span-2"
                                >
                                    <FlipVertical
                                        size={ICON.SIZE}
                                        className="mr-1.5"
                                    />
                                    {t("Flip vertical", { ns: "tooltip" })}
                                </Button>
                            </div>
                        </div>

                        <div className="border-t border-border/30" />

                        <div className="flex flex-col gap-2">
                            <h3 className="text-sm font-semibold text-muted-foreground">
                                {t("Crop", { ns: "keywords" })}
                            </h3>
                            <ImageCropControls
                                imageRef={imageRef}
                                canvasRef={canvasRef}
                                active={overlayMode === "crop"}
                                onActiveChange={active =>
                                    setOverlayMode(active ? "crop" : "none")
                                }
                                onApplyCrop={applyCrop}
                            />
                        </div>

                        <div className="border-t border-border/30" />

                        {/* Modifier pipeline */}
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
                        </div>

                        <div className="border-t border-border/30" />

                        {/* DPI controls (unchanged) */}
                        <div className="flex flex-col gap-2">
                            <h3 className="text-sm font-semibold text-muted-foreground">
                                DPI
                            </h3>
                            <ImageDpiControls
                                imageRef={imageRef}
                                canvasRef={canvasRef}
                                active={overlayMode === "dpi"}
                                onActiveChange={active =>
                                    setOverlayMode(active ? "dpi" : "none")
                                }
                                onScaleComputed={applyScale}
                            />
                        </div>
                    </div>

                    {/* Fixed bottom save button */}
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

            {/* Modifier settings dialog (rendered outside the sidebar for correct stacking) */}
            <ModifierSettingsDialog
                modifier={editingModifier}
                imageRef={imageRef}
                open={editingModifierId !== null}
                onClose={() => setEditingModifierId(null)}
                onUpdate={handleUpdateModifier}
            />
        </main>
    );
}
