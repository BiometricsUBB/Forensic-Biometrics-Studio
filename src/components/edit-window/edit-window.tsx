import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { WindowControls } from "@/components/menu/window-controls";
import { Menubar } from "@/components/ui/menubar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/shadcn";
import { ICON } from "@/lib/utils/const";
import { Edit, Save } from "lucide-react";
import { listen, emit } from "@tauri-apps/api/event";
import { readFile, writeFile, exists } from "@tauri-apps/plugin-fs";
import { basename, extname, join, dirname } from "@tauri-apps/api/path";
import { toast } from "sonner";
import { useSettingsSync } from "@/lib/hooks/useSettingsSync";
import ImageDpiControls from "@/components/edit-window/dpi/image-dpi-controls";
import { AnyModifier, ModifierType } from "@/lib/imageModifiers/types";
import {
    MODIFIER_REGISTRY,
    buildCssFilter,
} from "@/lib/imageModifiers/registry";
import { applyPipelineToImage } from "@/lib/imageModifiers/pipeline";
import { AddModifierButton } from "@/components/edit-window/modifiers/AddModifierButton";
import { ModifierList } from "@/components/edit-window/modifiers/ModifierList";
import { ModifierSettingsDialog } from "@/components/edit-window/modifiers/ModifierSettingsDialog";

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

// ─── Component ────────────────────────────────────────────────────────────────

export function EditWindow() {
    const { t } = useTranslation(["tooltip", "keywords"]);
    useSettingsSync();

    // ── Image state ──────────────────────────────────────────────────────────
    const [imagePath, setImagePath] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [imageName, setImageName] = useState<string | null>(null);
    const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(
        null
    );
    const [error, setError] = useState<string | null>(null);

    // ── View state ───────────────────────────────────────────────────────────
    const [zoom, setZoom] = useState<number>(1);
    const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState<boolean>(false);
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

    // ── CSS filter (live, lightweight) ───────────────────────────────────────
    const cssFilter = buildCssFilter(modifiers);

    // ── Image loading ────────────────────────────────────────────────────────

    const loadImage = async (path: string) => {
        try {
            setError(null);
            setImageUrl(null);
            const imageBytes = await readFile(path);
            const blob = new Blob([imageBytes]);
            const url = URL.createObjectURL(blob);
            setImageUrl(url);
            setImageName(await basename(path));
            setZoom(1);
            setPan({ x: 0, y: 0 });
        } catch (err) {
            const msg =
                err instanceof Error ? err.message : "Failed to load image";
            setError(`${msg} (Path: ${path})`);
            setImageUrl(null);
        }
    };

    // ── Wheel / pan handlers ─────────────────────────────────────────────────

    const handleWheel = (e: React.WheelEvent<HTMLButtonElement>) => {
        if (!imageUrl || !containerRef.current || !imageRef.current) return;
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
    }, []);

    useEffect(() => {
        return () => {
            if (imageUrl) {
                URL.revokeObjectURL(imageUrl);
            }
        };
    }, [imageUrl]);

    useEffect(() => {
        const img = imageRef.current;
        if (!img) return undefined;
        const updateSize = () => {
            setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
        };
        if (img.complete && img.naturalWidth) updateSize();
        img.addEventListener("load", updateSize);
        return () => img.removeEventListener("load", updateSize);
    }, [imageUrl]);

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
    }, [imageUrl]);

    // ── Modifier helpers ─────────────────────────────────────────────────────

    const handleAddModifier = useCallback((type: ModifierType) => {
        const def = MODIFIER_REGISTRY.find(d => d.type === type);
        if (!def) return;
        const newMod = def.create() as AnyModifier;
        setModifiers(prev => [...prev, newMod]);
        // Automatically open edit dialog for the new modifier
        // Use timeout so Radix DropdownMenu doesn't intercept the click-outside and immediately dismiss the dialog
        setTimeout(() => setEditingModifierId(newMod.id), 50);
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

    // ── Save ─────────────────────────────────────────────────────────────────

    const saveEditedImage = async () => {
        if (!imageUrl || !imagePath || !imageRef.current) return;
        try {
            const uint8Array = await applyPipelineToImage(
                imageRef.current,
                modifiers
            );

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

            setImagePath(finalPath);
            setImageName(await basename(finalPath));
            const blob = new Blob([uint8Array], { type: "image/png" });
            const url = URL.createObjectURL(blob);
            setImageUrl(url);

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
                    ) : imageUrl ? (
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
                                src={imageUrl}
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
                                disabled={!imageUrl}
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
                            />
                        </div>
                    </div>

                    {/* Fixed bottom save button */}
                    <div className="p-4 border-t border-border/30 bg-background">
                        <Button
                            onClick={saveEditedImage}
                            className="w-full"
                            size="lg"
                            disabled={!imageUrl || !imagePath}
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
