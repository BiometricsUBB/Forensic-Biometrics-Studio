import { MarkingsStore } from "@/lib/stores/Markings";
import { useCanvasContext } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getOppositeCanvasId } from "@/components/pixi/canvas/utils/get-opposite-canvas-id";
import { MARKING_CLASS } from "@/lib/markings/MARKING_CLASS";
import { MarkingClass } from "@/lib/markings/MarkingClass";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { MarkingMetadataEditDialog } from "@/components/marking-metadata/MarkingMetadataEditDialog";

import { EmptyableMarking, useColumns } from "./markings-info-table-columns";
import { MarkingsInfoTable } from "./markings-info-table";

const fillMissingLabels = (
    markings: EmptyableMarking[]
): EmptyableMarking[] => {
    return markings;
};

export function MarkingsInfo({ tableHeight }: { tableHeight: number }) {
    const { id } = useCanvasContext();

    const calibrationData = MarkingsStore(id).use(state => state.calibration);
    const setStore = MarkingsStore(id).use(state => state.set);

    useEffect(() => {
        if (!calibrationData && typeof setStore === "function") {
            setStore(draft => {
                draft.calibration = { unit: "px", pixelsPerUnit: 1 };
            });
        }
    }, [calibrationData, setStore]);

    const selectedMarking = MarkingsStore(id).use(
        state => state.selectedMarkingLabel
    );

    const { markings: storeMarkings } = MarkingsStore(id).use(
        state => ({
            markings: state.markings || [],
            hash: state.markingsHash,
        }),
        (oldState, newState) => {
            return oldState.hash === newState.hash;
        }
    );

    const { markings: storeOppositeMarkings } = MarkingsStore(
        getOppositeCanvasId(id)
    ).use(
        state => ({
            markings: state.markings || [],
            hash: state.markingsHash,
        }),
        (oldState, newState) => {
            return oldState.hash === newState.hash;
        }
    );

    const [editingLabel, setEditingLabel] = useState<number | null>(null);
    const handleEditMetadata = useCallback((m: MarkingClass) => {
        setEditingLabel(m.label);
    }, []);
    const columns = useColumns(id, {
        onEditMetadata: handleEditMetadata,
        editingLabel,
    });

    const types = MarkingTypesStore.use(state => state.types);
    const editingMarking = useMemo(() => {
        if (editingLabel === null) return undefined;
        return storeMarkings.find(m => m.label === editingLabel);
    }, [editingLabel, storeMarkings]);
    const editingType = editingMarking
        ? types.find(type => type.id === editingMarking.typeId)
        : undefined;

    const markings = useMemo(() => {
        if (!storeMarkings || !Array.isArray(storeMarkings)) return [];

        const filteredMarkings = storeMarkings.filter(
            m => m.markingClass !== MARKING_CLASS.MEASUREMENT
        );
        const filteredOpposite = (
            Array.isArray(storeOppositeMarkings) ? storeOppositeMarkings : []
        ).filter(m => m.markingClass !== MARKING_CLASS.MEASUREMENT);

        const thisIds = new Set(filteredMarkings.flatMap(m => m.ids));
        const thisLabels = new Set(filteredMarkings.map(m => m.label));

        const combinedMarkings = [
            ...filteredMarkings,
            ...filteredOpposite.filter(m => !thisLabels.has(m.label)),
        ]
            .toSorted((a, b) => a.label - b.label)
            .map(m =>
                m.ids.some(markingId => thisIds.has(markingId))
                    ? m
                    : { label: m.label }
            ) as EmptyableMarking[];

        return fillMissingLabels(combinedMarkings);
    }, [storeMarkings, storeOppositeMarkings]);

    return (
        <div className="w-full h-full overflow-hidden">
            <MarkingsInfoTable
                canvasId={id}
                selectedMarking={selectedMarking}
                height={`${tableHeight}px`}
                columns={columns}
                data={markings}
            />
            {editingMarking && editingType && (
                <MarkingMetadataEditDialog
                    key={editingMarking.label}
                    open
                    onOpenChange={open => {
                        if (!open) setEditingLabel(null);
                    }}
                    canvasId={id}
                    marking={editingMarking}
                    markingType={editingType}
                />
            )}
        </div>
    );
}
