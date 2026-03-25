/* eslint-disable max-classes-per-file */
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { GlobalStateStore } from "@/lib/stores/GlobalState";
import { MarkingClass } from "@/lib/markings/MarkingClass";
import { PointMarking } from "@/lib/markings/PointMarking";
import { RayMarking } from "@/lib/markings/RayMarking";
import { LineSegmentMarking } from "@/lib/markings/LineSegmentMarking";
import { BoundingBoxMarking } from "@/lib/markings/BoundingBoxMarking";
import { PolygonMarking } from "@/lib/markings/PolygonMarking";
import { RectangleMarking } from "@/lib/markings/RectangleMarking";
import { MeasurementMarking } from "@/lib/markings/MeasurementMarking";
import { Command } from "./Command";
import { MarkingsStore } from "../Markings/Markings";

type MarkingActions = {
    addOne: (marking: MarkingClass) => void;
    removeOneByLabel: (label: number) => void;
    mergePair: (
        localLabel: number,
        otherCanvasId: CANVAS_ID,
        otherLabel: number
    ) => void;
};

type MarkingsSnapshot = {
    left: MarkingClass[];
    right: MarkingClass[];
    leftSelectedMarkingLabel: number | null;
    rightSelectedMarkingLabel: number | null;
};

const cloneMarking = (marking: MarkingClass): MarkingClass => {
    const clonedOrigin = { ...marking.origin };
    const clonedIds = [...marking.ids];

    if (marking instanceof PointMarking) {
        return new PointMarking(
            marking.label,
            clonedOrigin,
            marking.typeId,
            clonedIds
        );
    }

    if (marking instanceof RayMarking) {
        return new RayMarking(
            marking.label,
            clonedOrigin,
            marking.typeId,
            marking.angleRad,
            clonedIds
        );
    }

    if (marking instanceof MeasurementMarking) {
        return new MeasurementMarking(
            marking.label,
            clonedOrigin,
            marking.typeId,
            { ...marking.endpoint },
            clonedIds
        );
    }

    if (marking instanceof LineSegmentMarking) {
        return new LineSegmentMarking(
            marking.label,
            clonedOrigin,
            marking.typeId,
            { ...marking.endpoint },
            clonedIds
        );
    }

    if (marking instanceof BoundingBoxMarking) {
        return new BoundingBoxMarking(
            marking.label,
            clonedOrigin,
            marking.typeId,
            { ...marking.endpoint },
            clonedIds
        );
    }

    if (marking instanceof PolygonMarking) {
        return new PolygonMarking(
            marking.label,
            clonedOrigin,
            marking.typeId,
            marking.points.map(point => ({ ...point })),
            clonedIds
        );
    }

    if (marking instanceof RectangleMarking) {
        return new RectangleMarking(
            marking.label,
            clonedOrigin,
            marking.typeId,
            marking.points.map(point => ({ ...point })),
            clonedIds
        );
    }

    return marking;
};

const cloneMarkings = (markings: MarkingClass[]): MarkingClass[] =>
    markings.map(cloneMarking);

const getSnapshot = (): MarkingsSnapshot => {
    const leftStore = MarkingsStore(CANVAS_ID.LEFT);
    const rightStore = MarkingsStore(CANVAS_ID.RIGHT);

    return {
        left: cloneMarkings(leftStore.state.markings),
        right: cloneMarkings(rightStore.state.markings),
        leftSelectedMarkingLabel: leftStore.state.selectedMarkingLabel,
        rightSelectedMarkingLabel: rightStore.state.selectedMarkingLabel,
    };
};

const syncUnsavedChanges = () => {
    const leftHash = MarkingsStore(CANVAS_ID.LEFT).state.markingsHash;
    const rightHash = MarkingsStore(CANVAS_ID.RIGHT).state.markingsHash;
    GlobalStateStore.actions.unsavedChanges.checkForUnsavedChanges(
        leftHash,
        rightHash
    );
};

const restoreSnapshot = (snapshot: MarkingsSnapshot) => {
    const leftStore = MarkingsStore(CANVAS_ID.LEFT);
    const rightStore = MarkingsStore(CANVAS_ID.RIGHT);

    leftStore.actions.markings.resetForLoading();
    leftStore.actions.markings.addManyForLoading(cloneMarkings(snapshot.left));
    leftStore.actions.selectedMarkingLabel.setSelectedMarkingLabel(
        snapshot.leftSelectedMarkingLabel
    );

    rightStore.actions.markings.resetForLoading();
    rightStore.actions.markings.addManyForLoading(
        cloneMarkings(snapshot.right)
    );
    rightStore.actions.selectedMarkingLabel.setSelectedMarkingLabel(
        snapshot.rightSelectedMarkingLabel
    );

    leftStore.actions.labelGenerator.reset();
    rightStore.actions.labelGenerator.reset();

    syncUnsavedChanges();
};

abstract class SnapshotCommand implements Command {
    private readonly beforeState = getSnapshot();

    private afterState: MarkingsSnapshot | null = null;

    protected abstract run(): void;

    execute(): void {
        if (this.afterState) {
            restoreSnapshot(this.afterState);
            return;
        }

        this.run();
        this.afterState = getSnapshot();
    }

    unExecute(): void {
        restoreSnapshot(this.beforeState);
    }
}

export class AddOrUpdateMarkingCommand extends SnapshotCommand {
    constructor(
        private actions: MarkingActions,
        private marking: MarkingClass
    ) {
        super();
    }

    protected run(): void {
        this.actions.addOne(this.marking);
    }
}

export class RemoveMarkingCommand extends SnapshotCommand {
    constructor(
        private actions: MarkingActions,
        private marking: MarkingClass
    ) {
        super();
    }

    protected run(): void {
        this.actions.removeOneByLabel(this.marking.label);
    }
}

export class MergeMarkingsCommand extends SnapshotCommand {
    constructor(
        private actions: MarkingActions,
        private localLabel: number,
        private otherCanvasId: CANVAS_ID,
        private otherLabel: number
    ) {
        super();
    }

    protected run(): void {
        this.actions.mergePair(
            this.localLabel,
            this.otherCanvasId,
            this.otherLabel
        );
    }
}
