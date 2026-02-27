import {
    CANVAS_ID,
    CanvasMetadata,
} from "@/components/pixi/canvas/hooks/useCanvasContext";
import { showErrorDialog } from "@/lib/errors/showErrorDialog";
import { TracingStore } from "@/lib/stores/Tracing/Tracing.store";
import {
    confirm as confirmFileSelectionDialog,
    open as openFileSelectionDialog,
} from "@tauri-apps/plugin-dialog";
import { t } from "i18next";
import { Viewport } from "pixi-viewport";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";
import { TracingExportObject } from "./saveTracingDataWithDialog";

function validateFileData(_data: unknown): _data is TracingExportObject {
    const fileData = _data as TracingExportObject;
    return (
        typeof fileData === "object" &&
        fileData !== null &&
        "metadata" in fileData &&
        "software" in fileData.metadata &&
        "name" in fileData.metadata.software &&
        fileData.metadata.software.name === "biometrics-studio" &&
        "data" in fileData &&
        "paths" in fileData.data &&
        Array.isArray(fileData.data.paths)
    );
}

export async function loadTracingData(filePath: string, canvasId: CANVAS_ID) {
    try {
        const fileContentString = await readTextFile(filePath);
        const fileContentJson: unknown = JSON.parse(fileContentString);

        if (!validateFileData(fileContentJson)) {
            showErrorDialog(t("Invalid tracing data file", { ns: "dialog" }));
            return;
        }

        const currentPaths = TracingStore(canvasId).getState().paths;

        if (currentPaths.length > 0) {
            const confirmed = await confirmFileSelectionDialog(
                t(
                    "Are you sure you want to load tracing data?\n\nIt will replace current drawing.",
                    { ns: "dialog" }
                ),
                {
                    kind: "warning",
                    title: t("Are you sure?", { ns: "dialog" }),
                }
            );
            if (!confirmed) return;
        }

        TracingStore(canvasId).getState().loadPaths(fileContentJson.data.paths);
        toast.success(t("Tracing data loaded", { ns: "tooltip" }));
    } catch (error) {
        console.error(error);
        showErrorDialog(t("Failed to load tracing data", { ns: "tooltip" }));
    }
}

export async function loadTracingDataWithDialog(viewport: Viewport) {
    try {
        const filePath = await openFileSelectionDialog({
            title: t("Load tracing data from file", { ns: "tooltip" }),
            filters: [{ name: "Tracing data file", extensions: ["json"] }],
            directory: false,
            canCreateDirectories: false,
            multiple: false,
        });

        if (filePath === null) return;

        const canvasId = viewport.name as CanvasMetadata["id"] | null;
        if (canvasId === null) {
            showErrorDialog(`Canvas ID: ${canvasId} not found`);
            return;
        }

        await loadTracingData(filePath, canvasId as CANVAS_ID);
    } catch (error) {
        showErrorDialog(error);
    }
}
