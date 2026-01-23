import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { WindowControls } from "@/components/menu/window-controls";
import { Menubar } from "@/components/ui/menubar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/shadcn";
import { ICON } from "@/lib/utils/const";
import { Edit, Save } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { readFile, writeFile, exists } from "@tauri-apps/plugin-fs";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { basename, extname, join, dirname } from "@tauri-apps/api/path";
import { toast } from "sonner";
import { useSettingsSync } from "@/lib/hooks/useSettingsSync";

export function EditWindow() {
    const { t } = useTranslation("tooltip");
    useSettingsSync();

    const [imagePath, setImagePath] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [brightness, setBrightness] = useState<number>(100);
    const [contrast, setContrast] = useState<number>(100);
    const [zoom, setZoom] = useState<number>(1);
    const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [dragStart, setDragStart] = useState<{ x: number; y: number }>({
        x: 0,
        y: 0,
    });

    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Helper function to find a unique file path
    const findUniqueFilePath = async (
        directory: string,
        baseName: string,
        timestamp: string,
        extension: string,
        initialPath: string
    ): Promise<string> => {
        // Check initial path
        let fileExists = false;
        try {
            fileExists = await exists(initialPath);
        } catch {
            // If we can't check, assume it doesn't exist and return the initial path
            return initialPath;
        }

        // If file doesn't exist, return the initial path
        if (!fileExists) {
            return initialPath;
        }

        // Try numbered variants - check multiple paths in parallel
        const maxAttempts = 100; // Prevent infinite loop
        const pathsToCheck: Promise<{ path: string; exists: boolean }>[] = [];

        for (let i = 1; i <= maxAttempts; i += 1) {
            const numberedFilename = `${baseName}_edited_${timestamp}_${i}${extension}`;
            const numberedPathPromise = join(directory, numberedFilename);
            pathsToCheck.push(
                numberedPathPromise.then(path =>
                    exists(path)
                        .then(exists => ({ path, exists }))
                        .catch(() => ({ path, exists: false }))
                )
            );
        }

        const results = await Promise.all(pathsToCheck);
        const firstAvailable = results.find(result => !result.exists);

        if (firstAvailable) {
            return firstAvailable.path;
        }

        // Fallback: return the last attempted path
        return results[results.length - 1]?.path ?? initialPath;
    };

    // Helper function to process image with filters
    const processImageWithFilters = async (
        imagePath: string,
        brightnessValue: number,
        contrastValue: number
    ): Promise<Uint8Array> => {
        const imageBytes = await readFile(imagePath);
        const blob = new Blob([imageBytes]);
        const originalImageUrl = URL.createObjectURL(blob);

        const img = new Image();
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
            img.src = originalImageUrl;
        });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            URL.revokeObjectURL(originalImageUrl);
            throw new Error("Failed to get canvas context");
        }

        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;

        if (brightnessValue !== 100 || contrastValue !== 100) {
            ctx.filter = `brightness(${brightnessValue / 100}) contrast(${contrastValue / 100})`;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.filter = "none";

        URL.revokeObjectURL(originalImageUrl);

        const editedBlob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                blob => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error("Failed to convert canvas to blob"));
                    }
                },
                "image/png",
                1.0
            );
        });

        const arrayBuffer = await editedBlob.arrayBuffer();
        return new Uint8Array(arrayBuffer);
    };

    // Helper function to generate filename
    const generateFilename = async (
        imagePath: string
    ): Promise<{
        nameWithoutExt: string;
        extWithDot: string;
        timestamp: string;
    }> => {
        const originalFilename = await basename(imagePath);
        const extension = await extname(imagePath);

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
    };

    const loadImage = async (path: string) => {
        try {
            setError(null);
            setImageUrl(null);
            const imageBytes = await readFile(path);
            const blob = new Blob([imageBytes]);
            const url = URL.createObjectURL(blob);
            setImageUrl(url);
            // Reset zoom and pan when loading new image
            setZoom(1);
            setPan({ x: 0, y: 0 });
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : "Failed to load image";
            setError(`${errorMessage} (Path: ${path})`);
            setImageUrl(null);
        }
    };

    // Handle mouse wheel for zooming
    const handleWheel = (e: React.WheelEvent<HTMLButtonElement>) => {
        if (!imageUrl || !containerRef.current || !imageRef.current) return;

        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(10, zoom * delta));

        const containerRect = containerRef.current.getBoundingClientRect();

        // Get mouse position relative to container center
        const containerCenterX = containerRect.width / 2;
        const containerCenterY = containerRect.height / 2;
        const mouseX = e.clientX - containerRect.left;
        const mouseY = e.clientY - containerRect.top;

        // Calculate the point under the mouse in image coordinates (before zoom)
        // Account for the current pan and the image's centered position
        const imageX = (mouseX - containerCenterX - pan.x) / zoom;
        const imageY = (mouseY - containerCenterY - pan.y) / zoom;

        // Adjust pan to keep the point under the mouse fixed
        const newPanX = mouseX - containerCenterX - imageX * newZoom;
        const newPanY = mouseY - containerCenterY - imageY * newZoom;

        setZoom(newZoom);
        setPan({ x: newPanX, y: newPanY });
    };

    // Handle mouse down for panning
    const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (e.button !== 0) return; // Only handle left mouse button
        setIsDragging(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    };

    // Handle mouse move for panning
    const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!isDragging) return;
        setPan({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y,
        });
    };

    // Handle mouse up for panning
    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Handle double click to reset zoom and pan
    const handleDoubleClick = () => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };

    // Reset zoom and pan
    const resetZoom = () => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };

    useEffect(() => {
        // Check URL parameters for initial image path
        const urlParams = new URLSearchParams(window.location.search);
        const pathFromUrl = urlParams.get("imagePath");

        if (pathFromUrl) {
            // Decode the path from URL and convert forward slashes back to backslashes on Windows
            const decodedPath = decodeURIComponent(pathFromUrl);
            // On Windows, convert forward slashes back to backslashes for file paths
            const normalizedPath = decodedPath.replace(/\//g, "\\");
            setImagePath(normalizedPath);
            loadImage(normalizedPath);
        }

        // Listen for image path changes from the main window (when window already exists)
        const setupListener = async () => {
            return listen<string>("image-path-changed", event => {
                setImagePath(event.payload);
                loadImage(event.payload);
            });
        };

        let unlistenPromise: Promise<() => void> | null = null;
        setupListener().then(unlisten => {
            unlistenPromise = Promise.resolve(unlisten);
        });

        return () => {
            if (unlistenPromise) {
                unlistenPromise.then(fn => fn());
            }
        };
    }, []);

    // Cleanup object URL on unmount
    useEffect(() => {
        return () => {
            if (imageUrl) {
                URL.revokeObjectURL(imageUrl);
            }
        };
    }, [imageUrl]);

    const saveEditedImage = async () => {
        if (!imageUrl || !imagePath) {
            return;
        }

        try {
            // Process image with filters
            const uint8Array = await processImageWithFilters(
                imagePath,
                brightness,
                contrast
            );

            // Generate filename components
            const { nameWithoutExt, extWithDot, timestamp } =
                await generateFilename(imagePath);
            const newFilename = `${nameWithoutExt}_edited_${timestamp}${extWithDot}`;

            // Get the directory of the original image
            const imageDir = await dirname(imagePath);
            const newImagePath = await join(imageDir, newFilename);

            // Check if file exists and find a unique name if needed
            const finalPath = await findUniqueFilePath(
                imageDir,
                nameWithoutExt,
                timestamp,
                extWithDot,
                newImagePath
            );

            // Save the edited image to Documents folder
            await writeFile(finalPath, uint8Array);

            // Verify the file was written successfully
            const fileWasWritten = await exists(finalPath);
            if (!fileWasWritten) {
                throw new Error(`File was not created at path: ${finalPath}`);
            }

            const appWindow = getCurrentWindow();
            await appWindow.emit("image-reload-requested", {
                originalPath: imagePath,
                newPath: finalPath,
            });

            toast.success(t("Image saved successfully", { ns: "tooltip" }));

            try {
                const newImageBytes = await readFile(finalPath);

                setImagePath(finalPath);

                setError(null);
                const blob = new Blob([newImageBytes]);
                const url = URL.createObjectURL(blob);
                setImageUrl(url);
                setZoom(1);
                setPan({ x: 0, y: 0 });
            } catch (reloadErr) {
                const reloadErrorMessage =
                    reloadErr instanceof Error
                        ? reloadErr.message
                        : String(reloadErr);

                const isForbiddenError =
                    reloadErrorMessage.toLowerCase().includes("forbidden") ||
                    reloadErrorMessage.toLowerCase().includes("not allowed") ||
                    reloadErrorMessage.toLowerCase().includes("permission");

                if (isForbiddenError) {
                    toast.warning(
                        t(
                            "Image saved successfully, but could not be reloaded due to path restrictions"
                        )
                    );
                } else {
                    toast.warning(
                        `${t("Image saved successfully")} (Reload failed: ${reloadErrorMessage})`
                    );
                }
            }
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : String(err);
            toast.error(
                t("Failed to save image: {{error}}", {
                    ns: "tooltip",
                    error: errorMessage,
                })
            );
        }
    };

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
                        Edit Image
                    </span>
                </div>
                <WindowControls />
            </Menubar>

            <div className="flex flex-1 w-full overflow-hidden p-4 flex-col">
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
                    <>
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
                                    filter: `brightness(${brightness / 100}) contrast(${contrast / 100})`,
                                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                                    transformOrigin: "center center",
                                    transition: isDragging
                                        ? "none"
                                        : "transform 0.1s ease-out",
                                }}
                                draggable={false}
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
                        <div className="w-full bg-background/70 backdrop-blur-sm border border-border/30 rounded-lg p-4 space-y-4">
                            <div className="flex justify-center">
                                <Button
                                    onClick={saveEditedImage}
                                    className="w-full max-w-md"
                                    variant="default"
                                    disabled={!imageUrl || !imagePath}
                                >
                                    <Save size={ICON.SIZE} className="mr-2" />
                                    {t("Save", { ns: "tooltip" })}
                                </Button>
                            </div>
                            <div className="space-y-4">
                                <div className="flex flex-col items-center space-y-2">
                                    <Label
                                        htmlFor="brightness"
                                        className="text-sm font-medium"
                                    >
                                        {t("Brightness", { ns: "tooltip" })}
                                    </Label>
                                    <div className="flex items-center gap-3 w-full max-w-md">
                                        <Input
                                            id="brightness"
                                            type="range"
                                            min="0"
                                            max="200"
                                            value={brightness}
                                            onChange={e =>
                                                setBrightness(
                                                    Number(e.target.value)
                                                )
                                            }
                                            className="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                                        />
                                        <span className="text-sm text-muted-foreground min-w-[3rem] text-right">
                                            {brightness}%
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-center space-y-2">
                                    <Label
                                        htmlFor="contrast"
                                        className="text-sm font-medium"
                                    >
                                        {t("Contrast", { ns: "tooltip" })}
                                    </Label>
                                    <div className="flex items-center gap-3 w-full max-w-md">
                                        <Input
                                            id="contrast"
                                            type="range"
                                            min="0"
                                            max="200"
                                            value={contrast}
                                            onChange={e =>
                                                setContrast(
                                                    Number(e.target.value)
                                                )
                                            }
                                            className="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                                        />
                                        <span className="text-sm text-muted-foreground min-w-[3rem] text-right">
                                            {contrast}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
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
        </main>
    );
}
