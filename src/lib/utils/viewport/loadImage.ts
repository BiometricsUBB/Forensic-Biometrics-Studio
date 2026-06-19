import { showErrorDialog } from "@/lib/errors/showErrorDialog";
import {
    confirm as confirmFileSelectionDialog,
    open as openFileSelectionDialog,
} from "@tauri-apps/plugin-dialog";
import { Viewport } from "pixi-viewport";
import { MarkingsStore } from "@/lib/stores/Markings";
import {
    CanvasMetadata,
    CANVAS_ID,
} from "@/components/pixi/canvas/hooks/useCanvasContext";
import {
    emitFitEvents,
    fitWorld,
} from "@/components/pixi/canvas/utils/fit-viewport";
import { ShallowViewportStore } from "@/lib/stores/ShallowViewport";
import { CanvasToolbarStore } from "@/lib/stores/CanvasToolbar";
import { CachedViewportStore } from "@/lib/stores/CachedViewport";
import { getOppositeCanvasId } from "@/components/pixi/canvas/utils/get-opposite-canvas-id";
import { DashboardToolbarStore } from "@/lib/stores/DashboardToolbar";
import { t } from "i18next";
import { loadMarkingsData } from "@/lib/utils/viewport/loadMarkingsData";
import { exists } from "@tauri-apps/plugin-fs";
import { Sprite } from "pixi.js";
import { GlobalStateStore } from "@/lib/stores/GlobalState";
import { RotationStore } from "@/lib/stores/Rotation/Rotation";
import { GlobalHistoryManager } from "@/lib/stores/History/HistoryManager";
import { loadSprite } from "./loadSprite";

export async function loadImage(filePath: string, viewport: Viewport) {
    DashboardToolbarStore.actions.settings.viewport.setLockScaleSync(false);
    DashboardToolbarStore.actions.settings.viewport.setLockedViewport(false);

    const canvasId = viewport.name as CanvasMetadata["id"] | null;
    if (canvasId === null) {
        showErrorDialog(`Canvas ID: ${canvasId} not found`);
        return;
    }

    const leftHash = MarkingsStore(CANVAS_ID.LEFT).state.markingsHash;
    const rightHash = MarkingsStore(CANVAS_ID.RIGHT).state.markingsHash;
    const hasUnsavedChangesOnThisCanvas =
        GlobalStateStore.actions.unsavedChanges.checkForUnsavedChangesOnCanvas(
            canvasId,
            leftHash,
            rightHash
        );

    if (hasUnsavedChangesOnThisCanvas) {
        const confirmed = await confirmFileSelectionDialog(
            t(
                "You have unsaved changes!\nOpening this file will cause the loss of unsaved annotations.\nAre you sure you want to load this image?",
                { ns: "dialog" }
            ),
            {
                kind: "warning",
                title: t("Unsaved Changes", { ns: "dialog" }),
            }
        );
        if (!confirmed) return;
    }

    // Destroy current image sprite
    viewport.children
        .find(x => x instanceof Sprite)
        ?.destroy({
            children: true,
            texture: true,
            baseTexture: true,
        });

    const sprite = await loadSprite(filePath);
    sprite.anchor.set(0, 0);
    sprite.pivot.set(sprite.width / 2, sprite.height / 2);
    sprite.position.set(sprite.width / 2, sprite.height / 2);
    viewport.addChild(sprite);

    GlobalHistoryManager.clear();
    ShallowViewportStore(canvasId).state.reset();
    CanvasToolbarStore(canvasId).state.reset();
    CachedViewportStore(canvasId).state.reset();
    RotationStore(canvasId).actions.setRotation(0);
    fitWorld(viewport);
    emitFitEvents(viewport, "fit-world");

    const defaultMarkingsFilePath = `${filePath}.json`;
    if (await exists(defaultMarkingsFilePath)) {
        await loadMarkingsData(defaultMarkingsFilePath, canvasId);
    } else {
        MarkingsStore(canvasId).actions.markings.reset();
        MarkingsStore(canvasId).actions.labelGenerator.reset();
        MarkingsStore(
            getOppositeCanvasId(canvasId)
        ).actions.labelGenerator.reset();
    }

    const newLeftHash = MarkingsStore(CANVAS_ID.LEFT).state.markingsHash;
    const newRightHash = MarkingsStore(CANVAS_ID.RIGHT).state.markingsHash;
    GlobalStateStore.actions.unsavedChanges.establishBaseline(
        canvasId,
        newLeftHash,
        newRightHash
    );
}

export async function loadImageWithDialog(viewport: Viewport) {
    try {
        const filePath = await openFileSelectionDialog({
            title: t("Load forensic mark image", {
                ns: "tooltip",
            }),
            filters: [
                {
                    name: "Images",
                    extensions: ["png", "jpg", "jpeg", "gif", "bmp", "webp"],
                },
            ],
            directory: false,
            canCreateDirectories: false,
            multiple: false,
        });

        if (filePath === null) return;

        await loadImage(filePath, viewport);
    } catch (error) {
        showErrorDialog(error);
    }
}
