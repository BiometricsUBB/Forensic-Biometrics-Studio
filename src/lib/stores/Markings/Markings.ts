/* eslint-disable no-use-before-define */
/* eslint-disable no-param-reassign */

import { produce } from "immer";
import {
    CANVAS_ID,
    CanvasMetadata,
} from "@/components/pixi/canvas/hooks/useCanvasContext";
import { getOppositeCanvasId } from "@/components/pixi/canvas/utils/get-opposite-canvas-id";
import { arrayMax } from "@/lib/utils/array/minmax";
// eslint-disable-next-line import/no-cycle
import { MarkingClass } from "@/lib/markings/MarkingClass";
import { LineSegmentMarking } from "@/lib/markings/LineSegmentMarking";
import { RayMarking } from "@/lib/markings/RayMarking";
import { PointMarking } from "@/lib/markings/PointMarking";
import { BoundingBoxMarking } from "@/lib/markings/BoundingBoxMarking";
import { PolygonMarking } from "@/lib/markings/PolygonMarking";
import { RectangleMarking } from "@/lib/markings/RectangleMarking";
import { GlobalStateStore } from "@/lib/stores/GlobalState";
import { ActionProduceCallback } from "../immer.helpers";
import {
    _createMarkingsStore as createStore,
    MarkingsState as State,
} from "./Markings.store";
import { IDGenerator } from "./IdGenerator";

const useLeftStore = createStore(CANVAS_ID.LEFT);
const useRightStore = createStore(CANVAS_ID.RIGHT);

class StoreClass {
    readonly id: CANVAS_ID;

    readonly use: typeof useLeftStore;

    private labelGenerator = new IDGenerator();

    constructor(id: CanvasMetadata["id"]) {
        this.id = id;
        this.use = id === CANVAS_ID.LEFT ? useLeftStore : useRightStore;
    }

    get state() {
        return this.use.getState();
    }

    private updateMarkingsAndHash(
        callback: ActionProduceCallback<State["markings"], State>
    ) {
        this.state.set(draft => {
            const newMarkings = callback(draft.markings, draft);
            draft.markings = newMarkings;
        });

        this.state.set(draft => {
            draft.markingsHash = crypto.randomUUID();
        });

        const leftHash = Store(CANVAS_ID.LEFT).state.markingsHash;
        const rightHash = Store(CANVAS_ID.RIGHT).state.markingsHash;
        GlobalStateStore.actions.unsavedChanges.checkForUnsavedChanges(
            leftHash,
            rightHash
        );
    }

    private setMarkingsAndUpdateHash(
        callback: ActionProduceCallback<State["markings"], State>
    ) {
        this.updateMarkingsAndHash(callback);
    }

    private setMarkingsAndUpdateHashWithoutLastAdded(
        callback: ActionProduceCallback<State["markings"], State>
    ) {
        this.updateMarkingsAndHash(callback);
    }

    private setMarkingsWithoutChangeDetection(
        callback: ActionProduceCallback<State["markings"], State>
    ) {
        this.state.set(draft => {
            const newMarkings = callback(draft.markings, draft);
            draft.markings = newMarkings;

            const lastMarking = newMarkings.at(-1);
            if (lastMarking !== undefined)
                GlobalStateStore.actions.lastAddedMarking.setLastAddedMarking({
                    marking: lastMarking,
                    canvasId: this.id,
                });
        });

        this.state.set(draft => {
            draft.markingsHash = crypto.randomUUID();
        });
    }

    private setTemporaryMarking(
        callback: ActionProduceCallback<State["temporaryMarking"], State>
    ) {
        this.state.set(draft => {
            draft.temporaryMarking = callback(draft.temporaryMarking, draft);
        });
    }

    private setSelectedMarkingLabel(
        callback: ActionProduceCallback<State["selectedMarkingLabel"], State>
    ) {
        this.state.set(draft => {
            draft.selectedMarkingLabel = callback(
                draft.selectedMarkingLabel,
                draft
            );
        });
    }

    readonly actions = {
        labelGenerator: {
            getLabel: () => {
                // If user has selected marking and wants to overwrite - use its label
                if (this.state.selectedMarkingLabel) {
                    return this.state.selectedMarkingLabel;
                }
                // Calculate global max label across both canvases
                const oppositeCanvasId = getOppositeCanvasId(this.id);
                const oppositeCanvasLabels = Store(
                    oppositeCanvasId
                ).state.markings.map(m => m.label);
                const thisCanvasLabels = this.state.markings.map(m => m.label);
                const maxLabelBoth = arrayMax([
                    ...oppositeCanvasLabels,
                    ...thisCanvasLabels,
                ]);
                const target = maxLabelBoth ?? IDGenerator.initialValue; // when no markings - start from 1

                this.labelGenerator.setId(target);

                const isTakenHere = this.state.markings.some(
                    x => x.label === target
                );
                return isTakenHere
                    ? this.labelGenerator.generateId()
                    : this.labelGenerator.getCurrentId();
            },
            getMaxLabel: () => this.labelGenerator.getCurrentId(),
            reset: () => {
                this.labelGenerator = new IDGenerator();
                const oppositeCanvasId = getOppositeCanvasId(this.id);
                const oppositeCanvasLabels = Store(
                    oppositeCanvasId
                ).state.markings.map(m => m.label);
                const thisCanvasLabels = this.state.markings.map(m => m.label);
                const maxLabel =
                    arrayMax([...oppositeCanvasLabels, ...thisCanvasLabels]) ??
                    IDGenerator.initialValue;
                this.labelGenerator.setId(maxLabel);
            },
        },
        markings: {
            reset: () => {
                this.setMarkingsAndUpdateHash(() => []);

                const oppositeStore = Store(getOppositeCanvasId(this.id));
                const bothEmpty =
                    this.state.markings.length === 0 &&
                    oppositeStore.state.markings.length === 0;

                if (bothEmpty) {
                    this.actions.labelGenerator.reset();
                    oppositeStore.actions.labelGenerator.reset();
                } else {
                    this.actions.labelGenerator.reset();
                }
            },
            addOne: (marking: MarkingClass) => {
                const existingIds = this.actions.markings.findIdsByLabel(
                    marking.label
                );
                const idsToUse =
                    existingIds && existingIds.length > 0
                        ? Array.from(new Set(existingIds))
                        : marking.ids;

                if (this.state.markings.find(m => m.label === marking.label)) {
                    this.setMarkingsAndUpdateHash(markings =>
                        markings.filter(m => m.label !== marking.label)
                    );
                }
                this.setMarkingsAndUpdateHash(
                    produce(state => {
                        let mToPush: MarkingClass = marking;
                        if (marking instanceof PointMarking) {
                            mToPush = new PointMarking(
                                marking.label,
                                marking.origin,
                                marking.typeId,
                                idsToUse
                            );
                        } else if (marking instanceof RayMarking) {
                            mToPush = new RayMarking(
                                marking.label,
                                marking.origin,
                                marking.typeId,
                                (marking as RayMarking).angleRad,
                                idsToUse
                            );
                        } else if (marking instanceof LineSegmentMarking) {
                            mToPush = new LineSegmentMarking(
                                marking.label,
                                marking.origin,
                                marking.typeId,
                                (marking as LineSegmentMarking).endpoint,
                                idsToUse
                            );
                        } else if (marking instanceof BoundingBoxMarking) {
                            mToPush = new BoundingBoxMarking(
                                marking.label,
                                marking.origin,
                                marking.typeId,
                                (marking as BoundingBoxMarking).endpoint,
                                idsToUse
                            );
                        } else if (marking instanceof PolygonMarking) {
                            mToPush = new PolygonMarking(
                                marking.label,
                                marking.origin,
                                marking.typeId,
                                (marking as PolygonMarking).points,
                                idsToUse
                            );
                        } else if (marking instanceof RectangleMarking) {
                            mToPush = new RectangleMarking(
                                marking.label,
                                marking.origin,
                                marking.typeId,
                                (marking as RectangleMarking).points,
                                idsToUse
                            );
                        }
                        state.push(mToPush);
                    })
                );
                this.setSelectedMarkingLabel(() => null);
            },
            addMany: (markings: MarkingClass[]) =>
                this.setMarkingsAndUpdateHash(
                    produce(state => {
                        const prepared = markings.map(m => {
                            const existingIds =
                                this.actions.markings.findIdsByLabel(m.label);
                            const idsToUse =
                                existingIds && existingIds.length > 0
                                    ? Array.from(new Set(existingIds))
                                    : m.ids;
                            if (m instanceof PointMarking) {
                                return new PointMarking(
                                    m.label,
                                    m.origin,
                                    m.typeId,
                                    idsToUse
                                );
                            }
                            if (m instanceof RayMarking) {
                                return new RayMarking(
                                    m.label,
                                    m.origin,
                                    m.typeId,
                                    (m as RayMarking).angleRad,
                                    idsToUse
                                );
                            }
                            if (m instanceof LineSegmentMarking) {
                                return new LineSegmentMarking(
                                    m.label,
                                    m.origin,
                                    m.typeId,
                                    (m as LineSegmentMarking).endpoint,
                                    idsToUse
                                );
                            }
                            if (m instanceof BoundingBoxMarking) {
                                return new BoundingBoxMarking(
                                    m.label,
                                    m.origin,
                                    m.typeId,
                                    (m as BoundingBoxMarking).endpoint,
                                    idsToUse
                                );
                            }
                            if (m instanceof PolygonMarking) {
                                return new PolygonMarking(
                                    m.label,
                                    m.origin,
                                    m.typeId,
                                    (m as PolygonMarking).points,
                                    idsToUse
                                );
                            }
                            if (m instanceof RectangleMarking) {
                                return new RectangleMarking(
                                    m.label,
                                    m.origin,
                                    m.typeId,
                                    (m as RectangleMarking).points,
                                    idsToUse
                                );
                            }
                            return m;
                        });
                        state.push(...prepared);
                    })
                ),
            removeOneByLabel: (label: MarkingClass["label"]) => {
                if (this.state.selectedMarkingLabel === label) {
                    this.setSelectedMarkingLabel(() => null);
                }

                GlobalStateStore.actions.lastAddedMarking.setLastAddedMarking(
                    null
                );

                // Calculate new list after removal and apply
                const filtered = this.state.markings.filter(
                    marking => marking.label !== label
                );
                this.setMarkingsAndUpdateHashWithoutLastAdded(() => filtered);

                const oppositeStore = Store(getOppositeCanvasId(this.id));
                const existsOpposite = oppositeStore.state.markings.some(
                    m => m.label === label
                );
                if (!existsOpposite) {
                    this.actions.markings.compactLabelsAcrossBoth();
                } else {
                    const bothEmpty =
                        filtered.length === 0 &&
                        oppositeStore.state.markings.length === 0;

                    if (bothEmpty) {
                        this.actions.labelGenerator.reset();
                        oppositeStore.actions.labelGenerator.reset();
                    } else {
                        this.actions.labelGenerator.reset();
                    }
                }
            },
            findIdsByLabel: (label: MarkingClass["label"]) => {
                const own = this.state.markings.find(m => m.label === label);
                if (own) return own.ids;
                const opposite = Store(
                    getOppositeCanvasId(this.id)
                ).state.markings.find(m => m.label === label);
                return opposite?.ids;
            },
            mergePair: (
                localLabel: number,
                otherCanvasId: CANVAS_ID,
                otherLabel: number
            ) => {
                const a = this.state.markings.find(m => m.label === localLabel);
                const otherStore = Store(otherCanvasId);
                const b = otherStore.state.markings.find(
                    m => m.label === otherLabel
                );
                if (!a || !b) return;

                const unionIds = Array.from(
                    new Set([...(a.ids ?? []), ...(b.ids ?? [])])
                );

                this.setMarkingsAndUpdateHash(markings => {
                    const m = markings.find(x => x.label === localLabel);
                    if (m) m.ids = unionIds;
                    return markings;
                });

                otherStore.setMarkingsAndUpdateHash(markings => {
                    const m = markings.find(x => x.label === otherLabel);
                    if (m) {
                        m.label = localLabel;
                        m.ids = unionIds;
                    }
                    return markings;
                });

                // After merging - clear selection on both canvases
                this.setSelectedMarkingLabel(() => null);
                otherStore.actions.selectedMarkingLabel.setSelectedMarkingLabel(
                    null
                );

                this.actions.markings.compactLabelsAcrossBoth();
            },
            compactLabelsAcrossBoth: () => {
                const leftStore = Store(CANVAS_ID.LEFT);
                const rightStore = Store(CANVAS_ID.RIGHT);
                const all = [
                    ...leftStore.state.markings,
                    ...rightStore.state.markings,
                ];
                const uniqueSorted = Array.from(
                    new Set(all.map(m => m.label))
                ).sort((a, b) => a - b);
                const mapping = new Map<number, number>();
                uniqueSorted.forEach((lbl, idx) => mapping.set(lbl, idx + 1));

                const remap = (store: StoreClass) => {
                    store.setMarkingsAndUpdateHash(markings => {
                        markings.forEach(m => {
                            const newLabel = mapping.get(m.label);
                            if (newLabel && newLabel !== m.label)
                                m.label = newLabel;
                        });
                        return markings;
                    });
                    const sel = store.state.selectedMarkingLabel;
                    if (sel) {
                        const newSel = mapping.get(sel) ?? null;
                        store.setSelectedMarkingLabel(() => newSel);
                    }
                    store.actions.labelGenerator.reset();
                };

                remap(leftStore);
                remap(rightStore);
            },
            resetForLoading: () => {
                this.setMarkingsWithoutChangeDetection(() => []);
            },
            addManyForLoading: (markings: MarkingClass[]) =>
                this.setMarkingsWithoutChangeDetection(
                    produce(state => {
                        state.push(...markings);
                    })
                ),
        },
        temporaryMarking: {
            setTemporaryMarking: (marking: MarkingClass | null) =>
                this.setTemporaryMarking(produce(() => marking)),
            updateTemporaryMarking: (
                props: Partial<
                    | PointMarking
                    | RayMarking
                    | LineSegmentMarking
                    | BoundingBoxMarking
                    | PolygonMarking
                    | RectangleMarking
                >
            ) =>
                this.setTemporaryMarking(
                    produce(marking => {
                        if (marking !== null) {
                            Object.assign(marking, props);
                        }
                    })
                ),
        },
        selectedMarkingLabel: {
            setSelectedMarkingLabel: (label: MarkingClass["label"] | null) =>
                this.setSelectedMarkingLabel(() => label),
        },
    };
}

const LeftStore = new StoreClass(CANVAS_ID.LEFT);
const RightStore = new StoreClass(CANVAS_ID.RIGHT);

export const Store = (id: CanvasMetadata["id"]) => {
    switch (id) {
        case CANVAS_ID.LEFT:
            return LeftStore;
        case CANVAS_ID.RIGHT:
            return RightStore;
        default:
            throw new Error(id satisfies never);
    }
};

export { Store as MarkingsStore };
export { StoreClass as MarkingsStoreClass };
