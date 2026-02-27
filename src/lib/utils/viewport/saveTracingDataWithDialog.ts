/* eslint-disable no-throw-literal */

import { CanvasMetadata } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { save } from "@tauri-apps/plugin-dialog";
import { getVersion } from "@tauri-apps/api/app";
import { t } from "i18next";
import { Viewport } from "pixi-viewport";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { showErrorDialog } from "@/lib/errors/showErrorDialog";
import { TracingStore, TracingPath } from "@/lib/stores/Tracing/Tracing.store";
import { toast } from "sonner";
import { Sprite } from "pixi.js";
import { basename } from "@tauri-apps/api/path";

export type TracingExportObject = {
    metadata: {
        software: { name: string; version: string };
    };
    data: {
        paths: TracingPath[];
    };
};

async function getTracingData(viewport: Viewport): Promise<string> {
    const id = viewport.name as CanvasMetadata["id"] | null;
    if (id === null) throw new Error("Canvas ID not found");

    const { paths } = TracingStore(id).getState();

    const exportObject: TracingExportObject = {
        metadata: {
            software: {
                name: "biometrics-studio",
                version: await getVersion(),
            },
        },
        data: {
            paths,
        },
    };

    return JSON.stringify(exportObject, null, 2);
}

function validateViewport(viewport: Viewport | null) {
    if (viewport === null) throw new Error(`Viewport is not loaded`);
}

export async function saveTracingDataWithDialog(viewport: Viewport) {
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

    try {
        const filepath = await save({
            title: t("Save tracing data to a JSON file", {
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
                    ? "tracing"
                    : `${await basename(picture.name)}.paint`
            }.json`,
        });

        if (filepath === null) return;

        const data = await getTracingData(viewport);
        await writeTextFile(filepath, data);

        toast.success(t("Tracing data saved", { ns: "tooltip" }));
    } catch {
        toast.error(t("Failed to save tracing data", { ns: "tooltip" }));
    }
}
