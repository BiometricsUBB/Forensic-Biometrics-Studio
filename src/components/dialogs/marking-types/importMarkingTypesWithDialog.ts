import { showErrorDialog } from "@/lib/errors/showErrorDialog";
import { getVersion } from "@tauri-apps/api/app";
import { resourceDir } from "@tauri-apps/api/path";
import {
    confirm as confirmFileSelectionDialog,
    open as openFileSelectionDialog,
} from "@tauri-apps/plugin-dialog";
import { t } from "i18next";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { KeybindingsStore } from "@/lib/stores/Keybindings";
import { validateFileData } from "@/lib/utils/viewport/loadMarkingsData";
import { WORKING_MODE } from "@/views/selectMode";
import { WorkingModeStore } from "@/lib/stores/WorkingMode";
import { MarkingTypesExportObject } from "@/components/dialogs/marking-types/exportMarkingTypesWithDialog";
import { toast } from "sonner";

export async function loadMarkingTypesData(filePath: string) {
    const fileContentString = await readTextFile(filePath);
    const fileContentJson = JSON.parse(
        fileContentString
    ) as MarkingTypesExportObject;
    if (!validateFileData(fileContentJson)) {
        showErrorDialog("Invalid markings data file");
        return;
    }

    const appVersion = await getVersion();

    if (fileContentJson.metadata.software.version !== appVersion) {
        const confirmed = await confirmFileSelectionDialog(
            t(
                "Marking types were exported from a different version of the application ({{version}}). Loading it might not work.\n\nAre you sure you want to load it?",
                {
                    ns: "dialog",
                    version: fileContentJson.metadata.software.version,
                }
            ),
            {
                kind: "warning",
                title: filePath ?? "Are you sure?",
            }
        );
        if (!confirmed) return;
    }

    // TODO: fix this - create a working mode when we allow the creation of new ones
    const workingModesFromData =
        Array.from(
            new Set(
                fileContentJson.data.markingTypes
                    ?.map(item => item.category)
                    .flat()
            )
        ) || [];
    const supportedWorkingModes = Object.keys(WORKING_MODE);

    if (
        workingModesFromData.filter(
            mode => !supportedWorkingModes.includes(mode)
        ).length
    ) {
        showErrorDialog(
            t(
                "You are trying to load marking types for a non-existing working mode.",
                { ns: "dialog" }
            )
        );
        return;
    }

    const types = fileContentJson.data.markingTypes;
    if (!types.length) {
        toast.warning(
            t("No marking types found in the file", { ns: "dialog" })
        );
    }

    const conflicts = MarkingTypesStore.actions.types
        .getConflicts(types)
        .map(conflict => conflict.displayName)
        .join(", ");

    if (conflicts.length > 0) {
        const confirmed = await confirmFileSelectionDialog(
            t(
                "The imported marking types have conflicts with the existing ones:\n{{conflicts}}\n\nDo you want to overwrite them?",
                { ns: "dialog", conflicts }
            ),
            {
                kind: "warning",
                title: t("Overwrite marking types?", {
                    ns: "dialog",
                }),
            }
        );
        if (!confirmed) return;
    }

    if (workingModesFromData.length === 1 && workingModesFromData[0]) {
        WorkingModeStore.actions.setWorkingMode(workingModesFromData[0]);
    }

    MarkingTypesStore.actions.types.addMany(types);
    KeybindingsStore.actions.typesKeybindings.cleanupOrphans(
        MarkingTypesStore.state.types.map(t => t.id)
    );
    toast.success(t("Marking types imported successfully", { ns: "dialog" }));
}

export async function importMarkingTypesWithDialog() {
    try {
        const appInstallDir = await resourceDir();
        const presetsPath = `${appInstallDir}/presets/`;

        const filePath = await openFileSelectionDialog({
            title: t("Import marking types", {
                ns: "tooltip",
            }),
            filters: [
                {
                    name: "Markings data file",
                    extensions: ["json"],
                },
            ],
            directory: false,
            canCreateDirectories: false,
            multiple: false,
            defaultPath: presetsPath,
        });

        if (filePath === null) return;

        await loadMarkingTypesData(filePath);
    } catch {
        toast.error(t("Error importing marking types", { ns: "dialog" }));
    }
}
