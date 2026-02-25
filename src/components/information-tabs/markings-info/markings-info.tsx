import { MarkingsStore } from "@/lib/stores/Markings";
import { useCanvasContext } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { useEffect, useMemo } from "react";
import { getOppositeCanvasId } from "@/components/pixi/canvas/utils/get-opposite-canvas-id";
import { IS_DEV_ENVIRONMENT } from "@/lib/utils/const";
import invariant from "tiny-invariant";
import { hasDuplicates } from "@/lib/utils/array/hasDuplicates";
import { EmptyableMarking, useColumns } from "./markings-info-table-columns";
import { MarkingsInfoTable } from "./markings-info-table";

const fillMissingLabels = (
    markings: EmptyableMarking[]
): EmptyableMarking[] => {
    return markings;
};

export function MarkingsInfo({ tableHeight }: { tableHeight: number }) {
    const { id } = useCanvasContext();
    const selectedMarking = MarkingsStore(id).use(
        state => state.selectedMarkingLabel
    );

    const { markings: storeMarkings } = MarkingsStore(id).use(
        state => ({
            markings: state.markings,
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
            markings: state.markings,
            hash: state.markingsHash,
        }),
        (oldState, newState) => {
            return oldState.hash === newState.hash;
        }
    );

    useEffect(() => {
        if (IS_DEV_ENVIRONMENT) {
            const markingLabels = storeMarkings.map(m => m.label);

            invariant(
                !hasDuplicates(markingLabels),
                "Markings must have unique labels"
            );
        }
    }, [storeMarkings]);

    const columns = useColumns(id);

    const markings = useMemo(() => {
        const thisIds = new Set(storeMarkings.flatMap(m => m.ids));
        const thisLabels = storeMarkings.map(m => m.label);
        const combinedMarkings = [
            ...storeMarkings,
            ...storeOppositeMarkings.filter(m => !thisLabels.includes(m.label)),
        ]
            .sort((a, b) => a.label - b.label)
            .map(m =>
                // if any id exists on this side - show full object, otherwise placeholder
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
        </div>
    );
}
