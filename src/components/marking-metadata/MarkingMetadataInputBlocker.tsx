import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { MetadataEntryStore } from "@/lib/stores/MetadataEntry";

type Props = {
    panelCanvasId: CANVAS_ID;
};

/**
 * Transparent overlay that swallows pointer events on the canvas where a
 * marking is awaiting metadata. The user can see the freshly placed marking
 * but cannot interact with the viewport until they Submit/Cancel the form
 * that lives on the opposite canvas.
 */
export function MarkingMetadataInputBlocker({ panelCanvasId }: Props) {
    const activeEntry = MetadataEntryStore.use(state => state.activeEntry);

    if (!activeEntry || activeEntry.canvasId !== panelCanvasId) return null;

    return (
        <div
            className="absolute inset-0 z-30 cursor-not-allowed"
            aria-hidden="true"
        />
    );
}
