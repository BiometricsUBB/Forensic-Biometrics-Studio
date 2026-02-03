import { MarkingsStore } from "@/lib/stores/Markings";
import { useCanvasContext } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { useEffect, useMemo } from "react";
import { getOppositeCanvasId } from "@/components/pixi/canvas/utils/get-opposite-canvas-id";

import { EmptyableMarking, useColumns } from "./markings-info-table-columns";
import { MarkingsInfoTable } from "./markings-info-table";



const fillMissingLabels = (
    markings: EmptyableMarking[]
): EmptyableMarking[] => {
    return markings;
};

export function MarkingsInfo({ tableHeight }: { tableHeight: number }) {
    const { id } = useCanvasContext();

    // 1. Bezpieczne pobieranie danych
    const calibrationData = MarkingsStore(id).use(state => state.calibration);
    const setStore = MarkingsStore(id).use(state => state.set);

    // Fallback dla UI


    // 2. Auto-naprawa (Tylko jeśli setStore jest dostępny)
    useEffect(() => {
        if (!calibrationData && typeof setStore === "function") {
            setStore((draft) => {
                draft.calibration = { unit: "px", pixelsPerUnit: 1 };
            });
        }
    }, [calibrationData, setStore]);

    const selectedMarking = MarkingsStore(id).use(
        state => state.selectedMarkingLabel
    );

    // 3. Pobieranie markingów z zabezpieczeniem przed null/undefined
    const { markings: storeMarkings } = MarkingsStore(id).use(
        state => ({
            markings: state.markings || [], // ZABEZPIECZENIE: Zawsze tablica
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
            markings: state.markings || [], // ZABEZPIECZENIE
            hash: state.markingsHash,
        }),
        (oldState, newState) => {
            return oldState.hash === newState.hash;
        }
    );

    // USUNIĘTO BLOKADĘ INVARIANT - pozwala aplikacji działać nawet przy duplikatach
    /*
    useEffect(() => {
        if (IS_DEV_ENVIRONMENT) {
             // invariant(...) - usunięte
        }
    }, [storeMarkings]);
    */

    const columns = useColumns(id);

    const markings = useMemo(() => {
        // Dodatkowe zabezpieczenie przed crashem w pętli
        if (!storeMarkings || !Array.isArray(storeMarkings)) return [];

        const thisIds = new Set(storeMarkings.flatMap(m => m.ids));
        const thisLabels = storeMarkings.map(m => m.label);
        
        const oppositeSafe = Array.isArray(storeOppositeMarkings) ? storeOppositeMarkings : [];

        const combinedMarkings = [
            ...storeMarkings,
            ...oppositeSafe.filter(m => !thisLabels.includes(m.label)),
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