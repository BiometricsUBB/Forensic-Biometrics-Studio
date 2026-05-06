import { CanvasUpdaterOptions } from "@/lib/types/types";
import { CanvasUpdater } from "@/lib/stores/CanvasUpdater";
import { getCanvas } from "../../canvas/hooks/useCanvas";
import { CanvasMetadata } from "../../canvas/hooks/useCanvasContext";

export const useGlobalViewport = (
    id: CanvasMetadata["id"],
    options?: Omit<CanvasUpdaterOptions, "throttledUpdate">
) => {
    if (options?.autoUpdate === true) {
        // oxlint-disable-next-line react-hooks/rules-of-hooks
        CanvasUpdater.use(id, "viewport");
    }
    const { viewport } = getCanvas(id, true);
    return viewport;
};
