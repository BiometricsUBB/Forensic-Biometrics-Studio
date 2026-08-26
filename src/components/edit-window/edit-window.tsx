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
import { ImageCropControls } from "@/components/edit-window/crop/image-crop-controls";
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
    hasCanvasModifiers,
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

const CANVAS_CONTEXT_UNAVAILABLE = "Canvas context unavailable";
const FAILED_TO_SAVE_IMAGE_KEY = "Failed to save image: {{error}}";
const FAILED_TO_TRANSFORM_IMAGE_KEY = "Failed to transform image: {{error}}";
const FAILED_TO_CROP_IMAGE_KEY = "Failed to crop image: {{error}}";
const FAILED_TO_SCALE_IMAGE_KEY = "Failed to scale image: {{error}}";

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

async function canvasToBlobUrl(canvas: HTMLCanvasElement): Promise<string> {
    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            value =>
                value
                    ? resolve(value)
                    : reject(new Error("Canvas toBlob failed")),
            "image/png",
            1.0
        );
    });
    return URL.createObjectURL(blob);
}

async function loadImageElement(src: string): Promise<HTMLImageElement> {
    const image = new Image();
    image.decoding = "async";
    image.src = src;
    await image.decode();
    return image;
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
    const [overlayMode, setOverlayMode] = useState<"none" | "crop" | "dpi">(
        "none"
    );

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

    const cssFilter = buildCssFilter();

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

    const rasterDisplayUrl =
        (activeRasterModifier && isEnhancementModifier(activeRasterModifier)
            ? activeRasterModifier.params.runtimeOutputUrl
            : activeRasterModifier?.type === "fft"
              ? (activeRasterModifier as FftModifier).params.runtimeOutputUrl
              : null) ?? originalUrl;
    const displayUrl =
        (isFftActive ? null : previewImageUrl) ?? rasterDisplayUrl;

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
        allowUpscale: false,
    });
    useSyncedElement(imageRef, canvasRef, containerRef, {
        displayUrl,
        isFftActive,
        allowUpscale: false,
    });
    useSyncedElement(imageRef, dpiCanvasRef, containerRef, {
        displayUrl,
        isFftActive,
        syncDimensions: true,
        allowUpscale: false,
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
                setPreviewImageUrl(null);
                setModifiers([]);
                setOverlayMode("none");
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
        return () => {
            if (previewImageUrl) {
                URL.revokeObjectURL(previewImageUrl);
            }
        };
    }, [previewImageUrl]);

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
        let cancelled = false;

        async function renderPreview() {
            if (
                isFftActive ||
                !rasterDisplayUrl ||
                !hasCanvasModifiers(modifiers)
            ) {
                setPreviewImageUrl(null);
                return;
            }

            try {
                const source = await loadImageElement(rasterDisplayUrl);
                const previewModifiers = modifiers.filter(
                    modifier =>
                        modifier.type !== "fft" &&
                        !isEnhancementModifier(modifier)
                );
                const bytes = await applyPipelineToImage(
                    source,
                    previewModifiers
                );
                const nextUrl = URL.createObjectURL(
                    new Blob([bytes as unknown as ArrayBuffer], {
                        type: "image/png",
                    })
                );
                if (cancelled) {
                    URL.revokeObjectURL(nextUrl);
                    return;
                }
                setPreviewImageUrl(nextUrl);
            } catch {
                if (!cancelled) setPreviewImageUrl(null);
            }
        }

        renderPreview();
        return () => {
            cancelled = true;
        };
    }, [isFftActive, modifiers, rasterDisplayUrl]);

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

    const replaceBaseImageFromCanvas = useCallback(
        async (canvas: HTMLCanvasElement) => {
            const nextUrl = await canvasToBlobUrl(canvas);
            setOriginalUrl(nextUrl);
            setPreviewImageUrl(null);
            setModifiers(previous => {
                previous.forEach(modifier => {
                    if (isEnhancementModifier(modifier)) {
                        if (modifier.params.runtimeOutputUrl) {
                            URL.revokeObjectURL(
                                modifier.params.runtimeOutputUrl
                            );
                        }
                    } else if (
                        modifier.type === "fft" &&
                        modifier.params.runtimeOutputUrl?.startsWith("blob:")
                    ) {
                        URL.revokeObjectURL(modifier.params.runtimeOutputUrl);
                    }
                });
                return previous.filter(
                    modifier =>
                        modifier.type !== "fft" &&
                        !isEnhancementModifier(modifier)
                );
            });
            setEditingModifierId(null);
            setEditingFftModifierId(null);
            setIsFftActive(false);

            const overlayCanvas = dpiCanvasRef.current;
            const overlayContext = overlayCanvas?.getContext("2d");
            if (overlayCanvas && overlayContext) {
                overlayContext.clearRect(
                    0,
                    0,
                    overlayCanvas.width,
                    overlayCanvas.height
                );
            }
            setOverlayMode("none");
            resetLeft();
            resetRight();
        },
        [resetLeft, resetRight]
    );

    const getBaseImage = useCallback(async () => {
        if (!originalUrl) throw new Error("No image loaded");
        return loadImageElement(originalUrl);
    }, [originalUrl]);

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
                const context = canvas.getContext("2d");
                if (!context) throw new Error(CANVAS_CONTEXT_UNAVAILABLE);

                if (operation === "rotate90cw") {
                    context.translate(canvas.width, 0);
                    context.rotate(Math.PI / 2);
                } else if (operation === "rotate90ccw") {
                    context.translate(0, canvas.height);
                    context.rotate(-Math.PI / 2);
                } else if (operation === "rotate180") {
                    context.translate(canvas.width, canvas.height);
                    context.rotate(Math.PI);
                } else if (operation === "flipHorizontal") {
                    context.translate(canvas.width, 0);
                    context.scale(-1, 1);
                } else if (operation === "flipVertical") {
                    context.translate(0, canvas.height);
                    context.scale(1, -1);
                }

                context.drawImage(source, 0, 0);
                await replaceBaseImageFromCanvas(canvas);
            } catch (caught) {
                const message =
                    caught instanceof Error ? caught.message : String(caught);
                toast.error(
                    t(FAILED_TO_TRANSFORM_IMAGE_KEY, {
                        ns: "tooltip",
                        error: message,
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
                const context = canvas.getContext("2d");
                if (!context) throw new Error(CANVAS_CONTEXT_UNAVAILABLE);
                context.drawImage(
                    source,
                    x,
                    y,
                    width,
                    height,
                    0,
                    0,
                    width,
                    height
                );
                await replaceBaseImageFromCanvas(canvas);
            } catch (caught) {
                const message =
                    caught instanceof Error ? caught.message : String(caught);
                toast.error(
                    t(FAILED_TO_CROP_IMAGE_KEY, {
                        ns: "tooltip",
                        error: message,
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
                    const context = canvas.getContext("2d");
                    if (!context) throw new Error(CANVAS_CONTEXT_UNAVAILABLE);
                    context.imageSmoothingQuality = "low";
                    context.drawImage(
                        source,
                        0,
                        0,
                        canvas.width,
                        canvas.height
                    );
                    return replaceBaseImageFromCanvas(canvas).then(() => {
                        const scale = scaleFactor.toFixed(3);
                        if (
                            canvas.width === sourceWidth &&
                            canvas.height === sourceHeight
                        ) {
                            toast.info(
                                t("DPI scale unchanged", {
                                    ns: "tooltip",
                                    scale,
                                    width: canvas.width,
                                    height: canvas.height,
                                })
                            );
                            return;
                        }
                        toast.success(
                            t("DPI scale applied", {
                                ns: "tooltip",
                                scale,
                                sourceWidth,
                                sourceHeight,
                                width: canvas.width,
                                height: canvas.height,
                            })
                        );
                    });
                })
                .catch(caught => {
                    const message =
                        caught instanceof Error
                            ? caught.message
                            : String(caught);
                    toast.error(
                        t(FAILED_TO_SCALE_IMAGE_KEY, {
                            ns: "tooltip",
                            error: message,
                        })
                    );
                });
        },
        [getBaseImage, replaceBaseImageFromCanvas, t]
    );

    const saveEditedImage = async () => {
        if (!rasterDisplayUrl || !imagePath) return;
        try {
            const source = await loadImageElement(rasterDisplayUrl);
            const uint8Array = await applyPipelineToImage(source, modifiers);

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
                    if (m.type === "invert") return "invert";
                    if (m.type === "desaturate") return "desaturate";
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
                            imageUrl={displayUrl}
                            imagePath={imagePath}
                            isFftActive={isFftActive}
                            fftStatus={fft.status}
                            containerRef={containerRef}
                            imageRef={imageRef}
                            spectrumCanvasRef={canvasRef}
                            dpiCanvasRef={dpiCanvasRef}
                            overlayActive={overlayMode !== "none"}
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

                        {!isFftActive && (
                            <>
                                <div className="flex flex-col gap-3">
                                    <h3 className="text-sm font-semibold text-muted-foreground">
                                        {t("Transformations", {
                                            ns: "keywords",
                                        })}
                                    </h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={!originalUrl}
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
                                            disabled={!originalUrl}
                                            title={t("Rotate 90° right", {
                                                ns: "tooltip",
                                            })}
                                            onClick={() =>
                                                applyTransform("rotate90cw")
                                            }
                                        >
                                            <RotateCw size={ICON.SIZE} />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={!originalUrl}
                                            title={t("Rotate 180°", {
                                                ns: "tooltip",
                                            })}
                                            onClick={() =>
                                                applyTransform("rotate180")
                                            }
                                        >
                                            180°
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={!originalUrl}
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
                                            disabled={!originalUrl}
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
                                            {t("Flip vertical", {
                                                ns: "tooltip",
                                            })}
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
                                        canvasRef={dpiCanvasRef}
                                        active={overlayMode === "crop"}
                                        onActiveChange={active =>
                                            setOverlayMode(
                                                active ? "crop" : "none"
                                            )
                                        }
                                        onApplyCrop={applyCrop}
                                    />
                                </div>

                                <div className="border-t border-border/30" />
                            </>
                        )}

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
                                active={overlayMode === "dpi"}
                                onActiveChange={active =>
                                    setOverlayMode(active ? "dpi" : "none")
                                }
                                onScaleComputed={applyScale}
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
