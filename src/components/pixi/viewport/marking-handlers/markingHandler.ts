import { FederatedPointerEvent } from "pixi.js";
// eslint-disable-next-line import/no-cycle
import type { MarkingModePlugin } from "@/components/pixi/viewport/plugins/markingModePlugin";
import { MarkingClass } from "@/lib/markings/MarkingClass";
import { GlobalHistoryManager } from "@/lib/stores/History/HistoryManager";
import { AddOrUpdateMarkingCommand } from "@/lib/stores/History/MarkingCommands";

export abstract class MarkingHandler {
    // eslint-disable-next-line no-useless-constructor
    constructor(
        protected plugin: MarkingModePlugin,
        protected typeId: string,
        protected startEvent: FederatedPointerEvent
        // eslint-disable-next-line no-empty-function
    ) {}

    abstract handleMouseMove(e: FederatedPointerEvent): void;

    abstract handleLMBUp(e: FederatedPointerEvent): void;

    abstract handleLMBDown?(e: FederatedPointerEvent): void;

    handleRMBUp?(_e: FederatedPointerEvent): void;

    handleRMBDown?(_e: FederatedPointerEvent): void;

    protected cleanup() {
        this.plugin.cleanup();
    }

    protected addMarkingWithHistory(marking: MarkingClass) {
        GlobalHistoryManager.executeCommand(
            new AddOrUpdateMarkingCommand(
                this.plugin.handlerParams.markingsStore.actions.markings,
                marking
            )
        );
    }
}
