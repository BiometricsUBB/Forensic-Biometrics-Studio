/* eslint-disable no-throw-literal */

import {
    CANVAS_ID,
    CanvasMetadata,
} from "@/components/pixi/canvas/hooks/useCanvasContext";
import { save } from "@tauri-apps/plugin-dialog";
import { getVersion } from "@tauri-apps/api/app";
import { t } from "i18next";
import { Viewport } from "pixi-viewport";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { showErrorDialog } from "@/lib/errors/showErrorDialog";
import { MarkingsStore } from "@/lib/stores/Markings";
import { BaseTexture, Sprite } from "pixi.js";
import { getOppositeCanvasId } from "@/components/pixi/canvas/utils/get-opposite-canvas-id";
import { getCanvas } from "@/components/pixi/canvas/hooks/useCanvas";
import { basename } from "@tauri-apps/api/path";
import { MarkingClass } from "@/lib/markings/MarkingClass";
import { RayMarking } from "@/lib/markings/RayMarking";
import { LineSegmentMarking } from "@/lib/markings/LineSegmentMarking";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { WorkingModeStore } from "@/lib/stores/WorkingMode";
import { WORKING_MODE } from "@/views/selectMode";
import { BoundingBoxMarking } from "@/lib/markings/BoundingBoxMarking";
import { toast } from "sonner";
import { GlobalStateStore } from "@/lib/stores/GlobalState";
import { PolygonMarking } from "@/lib/markings/PolygonMarking";
import { RectangleMarking } from "@/lib/markings/RectangleMarking";

type ImageInfo = {
    name: string | null;
    path: string | null;
    sha256: string;
    size: {
        width: number;
        height: number;
    };
};

export type ExportObject = {
    metadata: {
        software: { name: string; version: string };
        image: ImageInfo | null;
        compared_image: ImageInfo | null;
        workingMode: WORKING_MODE;
        types: { id: string; name: string }[];
    };
    data: {
        markings: {
            ids: MarkingClass["ids"];
            markingClass: MarkingClass["markingClass"];
            origin: MarkingClass["origin"];
            typeId: MarkingClass["typeId"];
            angleRad?: RayMarking["angleRad"];
            endpoint?:
                | LineSegmentMarking["endpoint"]
                | BoundingBoxMarking["endpoint"];
            points?: PolygonMarking["points"];
        }[];
    };
};

function getImageData(picture: Sprite | undefined): ImageInfo | null {
    if (picture === undefined) return null;

    // eslint-disable-next-line no-underscore-dangle
    const texture: BaseTexture | undefined = picture?._texture.baseTexture;

    if (texture === undefined)
        throw new Error("Could not find texture for image");

    return {
        name: picture.name,
        // @ts-expect-error custom property should exist
        path: picture.path,
        // @ts-expect-error custom property should exist
        sha256: picture.hash,
        size: {
            width: texture.width,
            height: texture.height,
        },
    };
}

async function getData(
    viewport: Viewport,
    picture?: Sprite,
    oppositePicture?: Sprite
): Promise<string> {
    const id = viewport.name as CanvasMetadata["id"] | null;
    if (id === null) throw new Error("Canvas ID not found");

    const { workingMode } = WorkingModeStore.state;
    const { markings } = MarkingsStore(id).state;

    const exportObject: ExportObject = {
        metadata: {
            software: {
                name: "biometrics-studio",
                version: await getVersion(),
            },
            image: getImageData(picture),
            compared_image: getImageData(oppositePicture),
            workingMode: workingMode!,
            types: MarkingTypesStore.state.types
                .filter(
                    t =>
                        MarkingTypesStore.actions.types.checkIfTypeIsInUse(
                            t.id,
                            CANVAS_ID.LEFT
                        ) ||
                        MarkingTypesStore.actions.types.checkIfTypeIsInUse(
                            t.id,
                            CANVAS_ID.RIGHT
                        )
                )
                .map(c => ({ id: c.id, name: c.name })),
        },
        data: {
            markings: markings.map(m => ({
                ids: m.ids,
                markingClass: m.markingClass,
                origin: m.origin,
                typeId: m.typeId,
                ...("angleRad" in m
                    ? { angleRad: (m as RayMarking).angleRad }
                    : {}),
                ...("endpoint" in m
                    ? {
                          endpoint: (
                              m as LineSegmentMarking | BoundingBoxMarking
                          ).endpoint,
                      }
                    : {}),
                ...("points" in m
                    ? {
                          points: (m as PolygonMarking | RectangleMarking)
                              .points,
                      }
                    : {}),
            })),
        },
    };

    return JSON.stringify(exportObject, null, 2);
}

function validateViewport(viewport: Viewport | null) {
    if (viewport === null) throw new Error(`Viewport is not loaded`);

    const childrenCount = viewport.children.length;
    if (childrenCount > 1)
        throw new Error(
            `Expected to only have one image loaded, but found ${childrenCount} images in viewport '${viewport.name}'`
        );
}

export async function saveMarkingsDataToPath(
    viewport: Viewport,
    filePath: string
) {
    try {
        validateViewport(viewport);
    } catch (error) {
        showErrorDialog(error);
        return;
    }

    const picture = viewport.children.find(x => x instanceof Sprite) as
        | Sprite
        | undefined;

    const oppositePicture = (() => {
        const canvasId = viewport.name as CanvasMetadata["id"] | null;
        if (canvasId === null) return undefined;

        const oppositeId = getOppositeCanvasId(canvasId);
        const oppositeCanvas = getCanvas(oppositeId, true);
        if (oppositeCanvas.viewport === null) return undefined;

        const sprite = oppositeCanvas.viewport.children.find(
            x => x instanceof Sprite
        ) as Sprite | undefined;

        if (sprite) {
            return sprite;
        }
        return undefined;
    })();

    const data = await getData(viewport, picture, oppositePicture);
    await writeTextFile(filePath, data);

    const canvasId = viewport.name as CanvasMetadata["id"];
    const leftHash = MarkingsStore(CANVAS_ID.LEFT).state.markingsHash;
    const rightHash = MarkingsStore(CANVAS_ID.RIGHT).state.markingsHash;
    GlobalStateStore.actions.unsavedChanges.markCanvasAsSaved(
        canvasId,
        leftHash,
        rightHash
    );
}

export async function saveMarkingsDataWithDialog(viewport: Viewport) {
    try {
        validateViewport(viewport);
    } catch (error) {
        showErrorDialog(error);
        return;
    }

    const picture = (() => {
        try {
            return viewport.getChildAt(0) as Sprite;
        } catch {
            return undefined;
        }
    })();

    const id = viewport.name as CanvasMetadata["id"] | null;
    const oppositePicture = (() => {
        if (id !== null) {
            const oppositeId = getOppositeCanvasId(id);
            const { viewport: oppositeViewport } = getCanvas(oppositeId, true);
            try {
                validateViewport(oppositeViewport);

                return oppositeViewport?.getChildAt(0) as Sprite | undefined;
            } catch {
                return undefined;
            }
        } else {
            return undefined;
        }
    })();

    try {
        const filepath = await save({
            title: t("Save markings data to a JSON file", {
                ns: "tooltip",
            }),
            filters: [
                {
                    name: "JSON",
                    extensions: ["json"],
                },
            ],
            canCreateDirectories: true,
            defaultPath: `${
                picture === undefined || picture.name === null
                    ? "marking"
                    : await basename(picture.name)
            }.json`,
        });

        if (filepath === null) return;

        const data = await getData(viewport, picture, oppositePicture);
        await writeTextFile(filepath, data);

        const canvasId = viewport.name as CanvasMetadata["id"];
        const leftHash = MarkingsStore(CANVAS_ID.LEFT).state.markingsHash;
        const rightHash = MarkingsStore(CANVAS_ID.RIGHT).state.markingsHash;
        GlobalStateStore.actions.unsavedChanges.markCanvasAsSaved(
            canvasId,
            leftHash,
            rightHash
        );

        toast.success(t("Markings data saved", { ns: "tooltip" }));
    } catch {
        toast.error(t("Failed to save markings data", { ns: "tooltip" }));
    }
}
