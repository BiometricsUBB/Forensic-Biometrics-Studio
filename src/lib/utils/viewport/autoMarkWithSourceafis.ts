import { join, tempDir } from "@tauri-apps/api/path";
import { Sprite } from "pixi.js";
import { Viewport } from "pixi-viewport";
import {
    CANVAS_ID,
    CanvasMetadata,
} from "@/components/pixi/canvas/hooks/useCanvasContext";
import {
    createSourceAfisExternalTool,
    SOURCE_AFIS_TIMEOUT_MS,
} from "@/lib/external-tools/sourceafis/createSourceAfisExternalTool";
import { RayMarking } from "@/lib/markings/RayMarking";
import { MarkingsStore } from "@/lib/stores/Markings";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { GlobalHistoryManager } from "@/lib/stores/History/HistoryManager";
import { AddOrUpdateMarkingCommand } from "@/lib/stores/History/MarkingCommands";

export const TYPE_ID_RIDGE_ENDING = "e6cbde52-5a18-4236-8287-7a1daf941ba9";
export const TYPE_ID_BIFURCATION = "f47c4b97-2d62-4959-aa21-edebfa7a756a";

function normalizeTypeName(value: string | undefined) {
    return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function resolveSourceafisTypeId(kind: string) {
    const existingTypes = MarkingTypesStore.state.types;
    let desiredId = TYPE_ID_RIDGE_ENDING;
    let desiredName = "ridgeending";

    if (kind === "ending") {
        desiredId = TYPE_ID_RIDGE_ENDING;
        desiredName = "ridgeending";
    } else if (kind === "bifurcation") {
        desiredId = TYPE_ID_BIFURCATION;
        desiredName = "bifurcation";
    }

    const match =
        existingTypes.find(t => t.id === desiredId) ||
        existingTypes.find(
            t =>
                normalizeTypeName(t.name) === desiredName ||
                normalizeTypeName(t.displayName) === desiredName
        );

    return match?.id ?? null;
}

function getImagePathFromViewport(viewport: Viewport): string {
    const sprite = (() => {
        try {
            return viewport.getChildAt(0) as Sprite;
        } catch {
            return undefined;
        }
    })();

    if (!sprite) throw new Error("No image loaded in viewport");

    // @ts-expect-error custom property should exist
    const spritePath: string | null = sprite.path ?? null;

    if (!spritePath) throw new Error("Image filename not available");

    return spritePath;
}

export async function autoMarkWithSourceafis(viewport: Viewport) {
    try {
        const imagePath = getImagePathFromViewport(viewport);
        const baseDir = await tempDir();
        const stamp = Date.now();
        const outTemplatePath = await join(baseDir, `sourceafis_${stamp}.dat`);
        const outJsonPath = await join(baseDir, `sourceafis_${stamp}.json`);

        const sourceAfisTool = await createSourceAfisExternalTool();
        const { processResult, sourceAfisJson } = await sourceAfisTool.run(
            {
                imagePath,
                outTemplatePath,
                outJsonPath,
            },
            {
                timeoutMs: SOURCE_AFIS_TIMEOUT_MS,
                logger: console,
            }
        );
        if (processResult.code !== 0) {
            console.error("SourceAFIS exited with code:", processResult.code);
        }
        const canvasId = viewport.name as CanvasMetadata["id"] | null;
        if (canvasId === null) {
            console.error("Canvas ID not found");
            return;
        }

        const markingsStore = MarkingsStore(canvasId as CANVAS_ID);
        const minutiae = sourceAfisJson.minutiae ?? [];
        for (const minutia of minutiae) {
            const label = markingsStore.actions.labelGenerator.getLabel();
            const typeId = resolveSourceafisTypeId(minutia.type);
            if (!typeId) {
                console.warn(
                    "Missing marking type for SourceAFIS minutia:",
                    minutia.type
                );
                continue;
            }
            const origin = { x: minutia.x, y: minutia.y };
            const angleRad = minutia.direction - Math.PI / 2;
            const m = new RayMarking(label, origin, typeId, angleRad);
            GlobalHistoryManager.executeCommand(
                new AddOrUpdateMarkingCommand(markingsStore.actions.markings, m)
            );
        }
    } catch (error) {
        console.error("Failed to run SourceAFIS external tool:", error);
    }
}
