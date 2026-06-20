import * as PIXI from "pixi.js";
import { readFile } from "@tauri-apps/plugin-fs";
import { drawMarking } from "@/components/pixi/overlays/markings/marking.utils";
import { MarkingClass } from "@/lib/markings/MarkingClass";
import { MarkingType } from "@/lib/markings/MarkingType";
import { clamp, toBlobBytes, sha256Bytes } from "../report-utils";
import { ImageMeta, CANVAS_CONTEXT_ERROR } from "./types";

export const getSpritePath = (sprite: PIXI.Sprite): string | null => {
    // @ts-expect-error custom property
    return (sprite.path as string | null) ?? null;
};

export const getImageMeta = async (sprite: PIXI.Sprite): Promise<ImageMeta> => {
    const fullPath = getSpritePath(sprite);
    if (!fullPath) throw new Error("Missing image path for report generation.");
    const bytes = await readFile(fullPath);
    const bitmap = await createImageBitmap(new Blob([toBlobBytes(bytes)]));
    return {
        name: sprite.name ?? "image",
        width: bitmap.width,
        height: bitmap.height,
        sizeBytes: bytes.byteLength,
        checksum: await sha256Bytes(bytes),
        bytes,
    };
};

export const renderImageWithMarkings = async (
    imageBytes: Uint8Array,
    markings: MarkingClass[],
    markingTypes: MarkingType[],
    sizeScale: number,
    options?: { showMarkingLabels?: boolean; markingsAlpha?: number }
) => {
    const bitmap = await createImageBitmap(new Blob([toBlobBytes(imageBytes)]));
    const { width, height } = bitmap;
    const showMarkingLabels = options?.showMarkingLabels ?? true;
    const markingsAlpha = options?.markingsAlpha ?? 1;

    const app = new PIXI.Application({
        width,
        height,
        backgroundAlpha: 0,
        antialias: true,
        preserveDrawingBuffer: true,
    });

    const sprite = new PIXI.Sprite(PIXI.Texture.from(bitmap));
    sprite.position.set(0, 0);
    app.stage.addChild(sprite);

    const g = new PIXI.Graphics();
    g.alpha = markingsAlpha;
    app.stage.addChild(g);

    const scaledTypes = markingTypes.map(type => ({
        ...type,
        size: Math.max(2, type.size * sizeScale),
    }));

    markings.forEach(marking => {
        const type = scaledTypes.find(t => t.id === marking.typeId);
        if (!type) return;
        drawMarking(
            g,
            false,
            marking,
            type,
            1,
            1,
            showMarkingLabels,
            undefined,
            0,
            width / 2,
            height / 2
        );
    });

    const canvas = app.renderer.extract.canvas(app.stage);
    app.destroy(true, { children: true, texture: true, baseTexture: true });
    return canvas as HTMLCanvasElement;
};

export const cropCanvas = (
    source: HTMLCanvasElement,
    centerX: number,
    centerY: number,
    size: number
) => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(CANVAS_CONTEXT_ERROR);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    const half = size / 2;
    const sx = Math.round(centerX - half);
    const sy = Math.round(centerY - half);
    const srcX = clamp(sx, 0, source.width);
    const srcY = clamp(sy, 0, source.height);
    const dstX = Math.max(0, -sx);
    const dstY = Math.max(0, -sy);
    const srcWidth = Math.max(0, Math.min(source.width - srcX, size - dstX));
    const srcHeight = Math.max(0, Math.min(source.height - srcY, size - dstY));
    if (srcWidth > 0 && srcHeight > 0) {
        ctx.drawImage(
            source,
            srcX,
            srcY,
            srcWidth,
            srcHeight,
            dstX,
            dstY,
            srcWidth,
            srcHeight
        );
    }
    return canvas;
};

export const getMarkingCenter = (marking: MarkingClass) => {
    const withEndpoint = marking as MarkingClass & {
        endpoint?: { x: number; y: number };
    };
    if (withEndpoint.endpoint) {
        return {
            x: (marking.origin.x + withEndpoint.endpoint.x) / 2,
            y: (marking.origin.y + withEndpoint.endpoint.y) / 2,
        };
    }
    return { x: marking.origin.x, y: marking.origin.y };
};

export const getMarkingExtent = (marking: MarkingClass): number => {
    const withEndpoint = marking as MarkingClass & {
        endpoint?: { x: number; y: number };
    };
    if (withEndpoint.endpoint) {
        const w = Math.abs(withEndpoint.endpoint.x - marking.origin.x);
        const h = Math.abs(withEndpoint.endpoint.y - marking.origin.y);
        return Math.max(w, h);
    }
    return 20;
};
