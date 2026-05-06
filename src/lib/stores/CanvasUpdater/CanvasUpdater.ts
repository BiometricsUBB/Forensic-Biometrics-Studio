import {
    useCanvasUpdater,
    useDryCanvasUpdater,
    useThrottledCanvasUpdater,
} from "./CanvasUpdater.store";

class CanvasUpdaterClass {
    /** Default updater that re-renders when state changes */
    readonly use = useCanvasUpdater;

    /** Updater that mutates state without triggering re-renders */
    readonly useDry = useDryCanvasUpdater;

    /** Updater that re-renders at a fixed rate (e.g. 60Hz). Used for things like debug info */
    readonly useThrottled = useThrottledCanvasUpdater;
}

const CanvasUpdater = new CanvasUpdaterClass();
export { CanvasUpdater };
export { type CanvasUpdaterClass };
