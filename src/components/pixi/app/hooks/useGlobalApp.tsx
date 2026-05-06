import { CanvasUpdaterOptions } from "@/lib/types/types";
import { CanvasUpdater } from "@/lib/stores/CanvasUpdater";
import { getCanvas } from "../../canvas/hooks/useCanvas";
import { CanvasMetadata } from "../../canvas/hooks/useCanvasContext";

export const useGlobalApp = (
    id: CanvasMetadata["id"],
    options?: CanvasUpdaterOptions
) => {
    if (options?.autoUpdate === true) {
        if (options.throttledUpdate === true) {
            // oxlint-disable-next-line react-hooks/rules-of-hooks
            CanvasUpdater.useThrottled(30);
        } else {
            // oxlint-disable-next-line react-hooks/rules-of-hooks
            CanvasUpdater.use(id, "app");
        }
    }
    const { app } = getCanvas(id, true);
    return app;
};
