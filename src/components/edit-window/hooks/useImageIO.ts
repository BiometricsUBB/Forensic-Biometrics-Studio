import React, { useState, useEffect, RefObject } from "react";
import { listen, emit } from "@tauri-apps/api/event";
import { readFile, writeFile, exists } from "@tauri-apps/plugin-fs";
import { basename, extname, join, dirname } from "@tauri-apps/api/path";
import { toast } from "sonner";

export function useImageIO(
    imageRef: RefObject<HTMLImageElement | null>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any,
    onImageLoad?: () => void
) {
    const [imagePath, setImagePath] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [imageName, setImageName] = useState<string | null>(null);
    const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(
        null
    );
    const [error, setError] = useState<string | null>(null);

    const findUniqueFilePath = async (
        directory: string,
        baseName: string,
        timestamp: string,
        extension: string,
        initialPath: string
    ): Promise<string> => {
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
                        .then(exists => ({ path, exists }))
                        .catch(() => ({ path, exists: false }))
                )
            );
        }

        const results = await Promise.all(pathsToCheck);
        const firstAvailable = results.find(result => !result.exists);
        return (
            firstAvailable?.path ??
            results[results.length - 1]?.path ??
            initialPath
        );
    };

    const processImageWithFilters = async (
        imgRef: React.RefObject<HTMLImageElement | null>,
        brightnessValue: number,
        contrastValue: number
    ): Promise<Uint8Array> => {
        if (!imgRef.current) throw new Error("Image not loaded");
        const img = imgRef.current;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Failed to get canvas context");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        if (brightnessValue !== 100 || contrastValue !== 100) {
            ctx.filter = `brightness(${brightnessValue / 100}) contrast(${contrastValue / 100})`;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.filter = "none";
        const editedBlob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                blob =>
                    blob
                        ? resolve(blob)
                        : reject(new Error("Failed to convert canvas to blob")),
                "image/png",
                1.0
            );
        });
        const arrayBuffer = await editedBlob.arrayBuffer();
        return new Uint8Array(arrayBuffer);
    };

    const generateFilename = async (
        currentPath: string
    ): Promise<{
        nameWithoutExt: string;
        extWithDot: string;
        timestamp: string;
    }> => {
        const originalFilename = await basename(currentPath);
        const extension = await extname(currentPath);
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
            setImageName(await basename(path));
            onImageLoad?.();
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : "Failed to load image";
            setError(`${errorMessage} (Path: ${path})`);
            setImageUrl(null);
        }
    };

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const pathFromUrl = urlParams.get("imagePath");
        if (pathFromUrl) {
            const decodedPath = decodeURIComponent(pathFromUrl);
            const normalizedPath = decodedPath.replace(/\//g, "\\");
            setImagePath(normalizedPath);
            loadImage(normalizedPath);
        }

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
            unlistenPromise?.then(fn => fn());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        return () => {
            if (imageUrl?.startsWith("blob:")) {
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
    }, [imageUrl, imageRef]);

    const saveEditedImage = async (brightness: number, contrast: number) => {
        if (!imageUrl || !imagePath) return;
        try {
            const uint8Array = await processImageWithFilters(
                imageRef,
                brightness,
                contrast
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

    return {
        imagePath,
        imageUrl,
        setImageUrl,
        imageName,
        imageSize,
        error,
        saveEditedImage,
    };
}
