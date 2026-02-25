import { MarkingsStore } from "@/lib/stores/Markings";
import { useCanvasContext } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { useEffect, useMemo } from "react";
import { getOppositeCanvasId } from "@/components/pixi/canvas/utils/get-opposite-canvas-id";
import { MARKING_CLASS } from "@/lib/markings/MARKING_CLASS";

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
                // eslint-disable-next-line no-param-reassign
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

    const columns = useColumns(id);

    const markings = useMemo(() => {
        if (!storeMarkings || !Array.isArray(storeMarkings)) return [];

        const filteredMarkings = storeMarkings.filter(
            m => m.markingClass !== MARKING_CLASS.MEASUREMENT
        );
        const filteredOpposite = (
            Array.isArray(storeOppositeMarkings) ? storeOppositeMarkings : []
        ).filter(m => m.markingClass !== MARKING_CLASS.MEASUREMENT);

        const thisIds = new Set(filteredMarkings.flatMap(m => m.ids));
        const thisLabels = filteredMarkings.map(m => m.label);

        const combinedMarkings = [
            ...filteredMarkings,
            ...filteredOpposite.filter(m => !thisLabels.includes(m.label)),
        ]
            .sort((a, b) => a.label - b.label)
            .map(m =>
                m.ids.some(markingId => thisIds.has(markingId))
                    ? m
                    : { label: m.label }
            ) as EmptyableMarking[];

        return fillMissingLabels(combinedMarkings);
    }, [storeMarkings, storeOppositeMarkings]);

    return (
        <div className="flex-1 overflow-hidden">
            <MarkingsInfoTable
                canvasId={id}
                selectedMarking={selectedMarking}
                height={`calc(${tableHeight}px - 70px)`}
                columns={columns}
                data={markings}
            />
        </div>
    );
}
