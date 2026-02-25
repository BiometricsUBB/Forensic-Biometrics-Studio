/* eslint-disable max-classes-per-file */
import { MarkingClass } from "@/lib/markings/MarkingClass";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { getOppositeCanvasId } from "@/components/pixi/canvas/utils/get-opposite-canvas-id";
import { Command } from "./Command";
import { MarkingsStore } from "../Markings/Markings"; // ???????????????

interface MarkingActions {
    addOne: (marking: MarkingClass) => void;
    removeOneByLabel: (label: number) => void;
    mergePair: (
        localLabel: number,
        otherCanvasId: CANVAS_ID,
        otherLabel: number
    ) => void;
    unmergePair: (
        localLabel: number,
        localIds: string[],
        otherCanvasId: CANVAS_ID,
        otherLabel: number,
        otherIds: string[]
    ) => void;
}

export class AddOrUpdateMarkingCommand implements Command {
    // eslint-disable-next-line no-useless-constructor, @typescript-eslint/no-empty-function
    constructor(
        private actions: MarkingActions,
        private marking: MarkingClass,
        private oldMarking?: MarkingClass
    ) {
        // empty
    }

    execute() {
        this.actions.addOne(this.marking);
    }

    unExecute() {
        if (this.oldMarking) {
            this.actions.addOne(this.oldMarking);
        } else {
            this.actions.removeOneByLabel(this.marking.label);
        }
    }
}

type LabelSnapshot = {
    canvasId: CANVAS_ID;
    markingId: string;
    label: number;
};

export class RemoveMarkingCommand {
    private readonly marking: MarkingClass;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly storeActions: any;

    private labelsBackup: LabelSnapshot[] | null = null;

    constructor(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        storeActions: any,
        marking: MarkingClass,
        canvasId: CANVAS_ID
    ) {
        this.storeActions = storeActions;
        this.marking = marking;

        const oppositeId = getOppositeCanvasId(canvasId);
        const oppositeStore = MarkingsStore(oppositeId);

        const existsOnOpposite = oppositeStore.state.markings.some(
            m => m.label === marking.label
        );

        if (!existsOnOpposite) {
            this.labelsBackup = [];

            const leftStore = MarkingsStore(CANVAS_ID.LEFT);
            const rightStore = MarkingsStore(CANVAS_ID.RIGHT);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const saveState = (store: any, cId: CANVAS_ID) => {
                store.state.markings.forEach((m: MarkingClass) => {
                    if (
                        m.label !== marking.label &&
                        m.ids &&
                        m.ids.length > 0
                    ) {
                        this.labelsBackup?.push({
                            canvasId: cId,
                            markingId: m.ids[0]!,
                            label: m.label,
                        });
                    }
                });
            };

            saveState(leftStore, CANVAS_ID.LEFT);
            saveState(rightStore, CANVAS_ID.RIGHT);
        }
    }

    execute() {
        this.storeActions.removeOneByLabel(this.marking.label);
    }

    unExecute() {
        if (this.labelsBackup && this.labelsBackup.length > 0) {
            const leftStore = MarkingsStore(CANVAS_ID.LEFT);
            const rightStore = MarkingsStore(CANVAS_ID.RIGHT);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const restore = (store: any, cId: CANVAS_ID) => {
                store.setMarkingsAndUpdateHash((markings: MarkingClass[]) => {
                    markings.forEach(m => {
                        const backup = this.labelsBackup?.find(
                            b => b.canvasId === cId && b.markingId === m.ids[0]
                        );

                        if (backup) {
                            // eslint-disable-next-line no-param-reassign
                            m.label = backup.label;
                        }
                    });
                    return markings;
                });
            };

            restore(leftStore, CANVAS_ID.LEFT);
            restore(rightStore, CANVAS_ID.RIGHT);

            leftStore.actions.labelGenerator.reset();
            rightStore.actions.labelGenerator.reset();
        }

        this.storeActions.addOne(this.marking);
    }
}

export class MergeMarkingsCommand implements Command {
    private labelsBackup: LabelSnapshot[] | null = null;

    constructor(
        private actions: MarkingActions,
        private localLabel: number,
        private localOldIds: string[],
        private otherCanvasId: CANVAS_ID,
        private otherLabel: number,
        private otherOldIds: string[]
    ) {
        this.labelsBackup = [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const saveState = (store: any, cId: CANVAS_ID) => {
            store.state.markings.forEach((m: MarkingClass) => {
                const isSourceItem =
                    cId === this.otherCanvasId && m.label === this.otherLabel;

                if (m.ids && m.ids.length > 0) {
                    const labelToSave = isSourceItem
                        ? this.localLabel
                        : m.label;

                    this.labelsBackup?.push({
                        canvasId: cId,
                        markingId: m.ids[0]!,
                        label: labelToSave,
                    });
                }
            });
        };

        saveState(MarkingsStore(CANVAS_ID.LEFT), CANVAS_ID.LEFT);
        saveState(MarkingsStore(CANVAS_ID.RIGHT), CANVAS_ID.RIGHT);
    }

    execute() {
        this.actions.mergePair(
            this.localLabel,
            this.otherCanvasId,
            this.otherLabel
        );
    }

    unExecute() {
        if (this.labelsBackup && this.labelsBackup.length > 0) {
            const leftStore = MarkingsStore(CANVAS_ID.LEFT);
            const rightStore = MarkingsStore(CANVAS_ID.RIGHT);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const restore = (store: any, cId: CANVAS_ID) => {
                store.setMarkingsAndUpdateHash((markings: MarkingClass[]) => {
                    markings.forEach(m => {
                        const backup = this.labelsBackup?.find(
                            b =>
                                b.canvasId === cId &&
                                m.ids.includes(b.markingId)
                        );

                        if (backup) {
                            // eslint-disable-next-line no-param-reassign
                            m.label = backup.label;
                        }
                    });
                    return markings;
                });
            };

            restore(leftStore, CANVAS_ID.LEFT);
            restore(rightStore, CANVAS_ID.RIGHT);

            leftStore.actions.labelGenerator.reset();
            rightStore.actions.labelGenerator.reset();
        }

        this.actions.unmergePair(
            this.localLabel,
            this.localOldIds,
            this.otherCanvasId,
            this.otherLabel,
            this.otherOldIds
        );
    }
}
