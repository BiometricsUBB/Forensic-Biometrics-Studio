import {
    CANVAS_ID,
    CanvasMetadata,
} from "@/components/pixi/canvas/hooks/useCanvasContext";
import { showErrorDialog } from "@/lib/errors/showErrorDialog";
import { MarkingsStore } from "@/lib/stores/Markings";
import { getVersion } from "@tauri-apps/api/app";
import {
    confirm as confirmFileSelectionDialog,
    open as openFileSelectionDialog,
} from "@tauri-apps/plugin-dialog";
import { t } from "i18next";
import { Viewport } from "pixi-viewport";
import { getOppositeCanvasId } from "@/components/pixi/canvas/utils/get-opposite-canvas-id";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { MarkingClass } from "@/lib/markings/MarkingClass";
import { RayMarking } from "@/lib/markings/RayMarking";
import { PointMarking } from "@/lib/markings/PointMarking";
import { LineSegmentMarking } from "@/lib/markings/LineSegmentMarking";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import {
    defaultBackgroundColor,
    defaultSize,
    defaultTextColor,
    MarkingType,
} from "@/lib/markings/MarkingType";
import { WorkingModeStore } from "@/lib/stores/WorkingMode";
import { BoundingBoxMarking } from "@/lib/markings/BoundingBoxMarking";
import { MARKING_CLASS } from "@/lib/markings/MARKING_CLASS";
import { PolygonMarking } from "@/lib/markings/PolygonMarking";
import { RectangleMarking } from "@/lib/markings/RectangleMarking";
import { TriangleMarking } from "@/lib/markings/TriangleMarking";
import { PolylineMarking } from "@/lib/markings/PolylineMarking";
import { Point } from "@/lib/markings/Point";
import { ExportObject } from "./saveMarkingsDataWithDialog";

type PointsMarkingConstructor =
    | typeof PolygonMarking
    | typeof RectangleMarking
    | typeof TriangleMarking
    | typeof PolylineMarking;

const MINIMUM_APP_VERSION = "0.5.0";

function compareVersions(version1: string, version2: string): number {
    const v1parts = version1.split(".").map(Number);
    const v2parts = version2.split(".").map(Number);

    const maxLength = Math.max(v1parts.length, v2parts.length);

    return (
        Array.from({ length: maxLength }, (_, i) => {
            const v1part = v1parts.at(i) ?? 0;
            const v2part = v2parts.at(i) ?? 0;

            if (v1part > v2part) return 1;
            if (v1part < v2part) return -1;
            return 0;
        }).find(result => result !== 0) || 0
    );
}

export function validateFileData(_data: unknown): _data is ExportObject {
    const fileData = _data as ExportObject;
    return (
        typeof fileData === "object" &&
        fileData !== null &&
        "software" in fileData.metadata &&
        "name" in fileData.metadata.software &&
        fileData.metadata.software.name === "biometrics-studio" &&
        "version" in fileData.metadata.software
    );
}

async function validateVersionCompatibility(
    fileVersion: string,
    filePath: string
): Promise<boolean> {
    const appVersion = await getVersion();

    if (compareVersions(fileVersion, appVersion) > 0) {
        showErrorDialog(
            t(
                "You are trying to load markings data created with a newer app version (current app version: {{appVersion}}, but you try to load: {{fileVersion}}). Please update the application.",
                {
                    ns: "dialog",
                    appVersion,
                    fileVersion,
                }
            )
        );
        return false;
    }

    if (compareVersions(fileVersion, MINIMUM_APP_VERSION) < 0) {
        return confirmFileSelectionDialog(
            t(
                "This markings data file was created with an older, unsupported version of the app ({{fileVersion}}, minimum supported: {{minVersion}}). Loading it might not work.\n\nDo you want to proceed?",
                {
                    ns: "dialog",
                    fileVersion,
                    minVersion: MINIMUM_APP_VERSION,
                }
            ),
            {
                kind: "warning",
                title: filePath ?? t("Are you sure?", { ns: "dialog" }),
            }
        );
    }

    return true;
}

function extractMarkingIds(
    marking: ExportObject["data"]["markings"][0]
): string[] {
    if (Array.isArray(marking.ids)) {
        return marking.ids.filter((id): id is string => id !== undefined);
    }
    const legacyId = (marking as { id?: string }).id;
    return legacyId ? [legacyId] : [];
}

function createPolygonOrRectangleMarking(
    baseArgs: readonly [number, Point, string],
    marking: ExportObject["data"]["markings"][0],
    ids: string[],
    MarkingConstructor: PointsMarkingConstructor
): MarkingClass {
    const { points } = marking as { points?: Point[] };
    if (!points) {
        throw new Error(
            `Missing points for marking class: ${marking.markingClass}`
        );
    }
    return new MarkingConstructor(...baseArgs, points, ids);
}

function createMarkingFromData(
    marking: ExportObject["data"]["markings"][0]
): MarkingClass {
    const baseArgs = [0, marking.origin, marking.typeId] as const;
    const ids = extractMarkingIds(marking);

    switch (marking.markingClass) {
        case MARKING_CLASS.POINT:
            return new PointMarking(...baseArgs, ids);
        case MARKING_CLASS.RAY:
            return new RayMarking(...baseArgs, marking.angleRad!, ids);
        case MARKING_CLASS.LINE_SEGMENT:
            return new LineSegmentMarking(...baseArgs, marking.endpoint!, ids);
        case MARKING_CLASS.BOUNDING_BOX:
            return new BoundingBoxMarking(...baseArgs, marking.endpoint!, ids);
        case MARKING_CLASS.POLYGON:
            return createPolygonOrRectangleMarking(
                baseArgs,
                marking,
                ids,
                PolygonMarking
            );
        case MARKING_CLASS.RECTANGLE:
            return createPolygonOrRectangleMarking(
                baseArgs,
                marking,
                ids,
                RectangleMarking
            );
        case MARKING_CLASS.TRIANGLE:
            return createPolygonOrRectangleMarking(
                baseArgs,
                marking,
                ids,
                TriangleMarking
            );
        case MARKING_CLASS.POLYLINE:
            return createPolygonOrRectangleMarking(
                baseArgs,
                marking,
                ids,
                PolylineMarking
            );
        default:
            throw new Error(`Unknown marking class: ${marking.markingClass}`);
    }
}

export async function loadMarkingsData(filePath: string, canvasId: CANVAS_ID) {
    const fileContentString = await readTextFile(filePath);
    const fileContentJson: unknown = JSON.parse(fileContentString);
    if (!validateFileData(fileContentJson)) {
        showErrorDialog(t("Invalid markings data file", { ns: "dialog" }));
        return;
    }

    if (
        fileContentJson.metadata.workingMode !==
        WorkingModeStore.state.workingMode
    ) {
        showErrorDialog(
            t(
                "The markings data was created with a different working mode ({{mode}}). Change the working mode to ({{mode}}) to load the data.",
                {
                    ns: "dialog",
                    mode: fileContentJson.metadata.workingMode,
                }
            )
        );
        return;
    }

    const fileVersion = fileContentJson.metadata.software.version;
    const versionValid = await validateVersionCompatibility(
        fileVersion,
        filePath
    );
    if (!versionValid) return;

    if (MarkingsStore(canvasId).state.markings.length !== 0) {
        const confirmed = await confirmFileSelectionDialog(
            t(
                "Are you sure you want to load markings data?\n\nIt will remove all existing forensic marks.",
                { ns: "dialog" }
            ),
            {
                kind: "warning",
                title: filePath ?? t("Are you sure?", { ns: "dialog" }),
            }
        );
        if (!confirmed) return;
    }

    const importedMarkings: MarkingClass[] = fileContentJson.data.markings.map(
        (marking: ExportObject["data"]["markings"][0]) =>
            createMarkingFromData(marking)
    );

    const oppositeId = getOppositeCanvasId(canvasId);
    const oppositeMarkings = MarkingsStore(oppositeId).state.markings;
    const isFirstCanvas = oppositeMarkings.length === 0;

    const oppositeIdToLabel = new Map<string, number>();
    oppositeMarkings.forEach(m =>
        m.ids.forEach(id => oppositeIdToLabel.set(id, m.label))
    );

    const maxLabelBoth = Math.max(
        0,
        ...MarkingsStore(canvasId).state.markings.map(m => m.label),
        ...oppositeMarkings.map(m => m.label)
    );
    let nextLabel = isFirstCanvas ? 1 : maxLabelBoth + 1;

    const markingLabels = new Map<MarkingClass, number>();

    if (isFirstCanvas) {
        importedMarkings.forEach((marking, idx) => {
            markingLabels.set(marking, idx + 1); // 1..N
        });
    } else {
        importedMarkings.forEach(marking => {
            const matchedLabel = marking.ids
                .map((id: string) => oppositeIdToLabel.get(id))
                .find(l => l !== undefined);
            if (matchedLabel !== undefined) {
                markingLabels.set(marking, matchedLabel);
            } else {
                markingLabels.set(marking, nextLabel);
                nextLabel += 1;
            }
        });
    }

    // Assign labels to markings
    importedMarkings.forEach(marking => {
        const label = markingLabels.get(marking);
        if (label !== undefined) {
            Object.assign(marking, { label });
        }
    });

    // --- Types ---
    const existingTypes = MarkingTypesStore.state.types;
    const requiredTypes = new Map<MarkingType["id"], MARKING_CLASS>(
        importedMarkings.map(marking => [marking.typeId, marking.markingClass])
    );
    const missingTypesIds: string[] = requiredTypes
        .keys()
        .filter(id => !existingTypes.some(c => c.id === id))
        .toArray();

    // If type exists in markings but not in the store
    if (missingTypesIds.length > 0) {
        const confirmed = await confirmFileSelectionDialog(
            t(
                "The imported markings data contains types that are not present in the application. Would you like to:\n1. Automatically create default types for the missing ones?\n2. Cancel and manually import the types from a file?",
                { ns: "dialog" }
            ),
            {
                kind: "warning",
                title: t("Missing marking types detected", { ns: "dialog" }),
            }
        );
        if (!confirmed) return;
        const metadataTypes = fileContentJson.metadata?.types;

        const typesToAdd: MarkingType[] = Array.from(requiredTypes.keys())
            .filter(id => missingTypesIds.includes(id))
            .map(id => {
                const markingClass = requiredTypes.get(id)!;
                const metadataTypeName = metadataTypes?.find(
                    (o: { id: string; name?: string }) => o.id === id
                )?.name;

                // set names according to metadata if non-existent use slice of id
                return {
                    id,
                    name: metadataTypeName ?? id.slice(0, 6),
                    displayName: metadataTypeName ?? id.slice(0, 6),
                    markingClass,
                    backgroundColor: defaultBackgroundColor,
                    textColor: defaultTextColor,
                    size: defaultSize,
                    category: fileContentJson.metadata.workingMode,
                };
            });
        MarkingTypesStore.actions.types.addMany(typesToAdd);
    }

    MarkingsStore(canvasId).actions.markings.resetForLoading();
    MarkingsStore(canvasId).actions.markings.addManyForLoading(
        importedMarkings
    );
    MarkingsStore(canvasId).actions.labelGenerator.reset();
    MarkingsStore(oppositeId).actions.labelGenerator.reset();
}

export async function loadMarkingsDataWithDialog(viewport: Viewport) {
    try {
        const filePath = await openFileSelectionDialog({
            title: t("Load markings data from file", { ns: "tooltip" }),
            filters: [{ name: "Markings data file", extensions: ["json"] }],
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
        await loadMarkingsData(filePath, canvasId as CANVAS_ID);
    } catch (error) {
        showErrorDialog(error);
    }
}
