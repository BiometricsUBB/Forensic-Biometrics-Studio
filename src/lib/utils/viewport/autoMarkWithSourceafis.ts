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

const TYPE_ID_RIDGE_ENDING = "e6cbde52-5a18-4236-8287-7a1daf941ba9";
const TYPE_ID_BIFURCATION = "f47c4b97-2d62-4959-aa21-edebfa7a756a";

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
    const spriteName: string | null = sprite.name ?? null;

    if (!spriteName) throw new Error("Image filename not available");

    return spritePath ? `${spritePath}/${spriteName}` : spriteName;
}

// eslint-disable-next-line sonarjs/cognitive-complexity
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
        // eslint-disable-next-line no-console
        console.log("exit code:", processResult.code);
        const root: unknown = sourceAfisJson;
        const imageSprite = (() => {
            try {
                return viewport.getChildAt(0) as Sprite;
            } catch {
                return undefined;
            }
        })();
        if (imageSprite) {
            const wStudio = imageSprite.width;
            const hStudio = imageSprite.height;
            const wAfis = sourceAfisJson.width;
            const hAfis = sourceAfisJson.height;
            // eslint-disable-next-line no-console
            console.log({
                wStudio,
                hStudio,
                wAfis,
                hAfis,
                scaleX:
                    typeof wAfis === "number" && wAfis !== 0
                        ? wStudio / wAfis
                        : null,
                scaleY:
                    typeof hAfis === "number" && hAfis !== 0
                        ? hStudio / hAfis
                        : null,
            });
        }
        const canvasId = viewport.name as CanvasMetadata["id"] | null;
        if (canvasId === null) {
            // eslint-disable-next-line no-console
            console.error("Canvas ID not found");
            return;
        }

        const markingsStore = MarkingsStore(canvasId as CANVAS_ID);
        const minutiae = sourceAfisJson.minutiae ?? [];
        const imgW = imageSprite?.texture?.width ?? null;
        const imgH = imageSprite?.texture?.height ?? null;
        let didLogSample = false;
        // eslint-disable-next-line no-restricted-syntax
        for (const minutia of minutiae) {
            const label = markingsStore.actions.labelGenerator.getLabel();
            const typeId = resolveSourceafisTypeId(minutia.type);
            if (!typeId) {
                // eslint-disable-next-line no-console
                console.warn(
                    "Missing marking type for SourceAFIS minutia:",
                    minutia.type
                );
                // eslint-disable-next-line no-continue
                continue;
            }
            const origin = { x: minutia.x, y: minutia.y };
            if (!didLogSample) {
                // eslint-disable-next-line no-console
                console.log({
                    imgW,
                    imgH,
                    samplePx: [minutia.x, minutia.y],
                    sampleOrigin: origin,
                });
                didLogSample = true;
            }
            const angleRad = minutia.direction - Math.PI / 2;
            const m = new RayMarking(label, origin, typeId, angleRad);
            markingsStore.actions.markings.addOne(m);
        }
        // eslint-disable-next-line no-console
        console.log(`Added ${minutiae.length} markings`);

        // eslint-disable-next-line no-console
        console.log("root keys:", Object.keys(root as object));

        const candidate = root as {
            minutiae?: unknown;
            Minutiae?: unknown;
            features?: unknown;
        };
        const minutiaeArray =
            (Array.isArray(candidate.minutiae) && candidate.minutiae) ||
            (Array.isArray(candidate.Minutiae) && candidate.Minutiae) ||
            (Array.isArray(candidate.features) && candidate.features) ||
            null;

        if (!minutiaeArray) {
            // eslint-disable-next-line no-console
            console.error("No minutiae array found");
            // eslint-disable-next-line no-console
            console.log("root:", root);
            return;
        }

        // eslint-disable-next-line no-console
        console.log("minutiae.length:", minutiaeArray.length);
        // eslint-disable-next-line no-console
        console.log("minutiae[0]:", minutiaeArray[0]);
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to run SourceAFIS external tool:", error);
    }
}
