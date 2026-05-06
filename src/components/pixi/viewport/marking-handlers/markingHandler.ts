import { FederatedPointerEvent } from "pixi.js";
import type { MarkingModePlugin } from "@/components/pixi/viewport/plugins/markingModePlugin";
import { MarkingClass } from "@/lib/markings/MarkingClass";
import { GlobalHistoryManager } from "@/lib/stores/History/HistoryManager";
import { AddOrUpdateMarkingCommand } from "@/lib/stores/History/MarkingCommands";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { MetadataEntryStore } from "@/lib/stores/MetadataEntry";

export abstract class MarkingHandler {
    constructor(
        protected plugin: MarkingModePlugin,
        protected typeId: string,
        protected startEvent: FederatedPointerEvent
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

        const type = MarkingTypesStore.state.types.find(
            t => t.id === marking.typeId
        );
        if (type?.attributes && type.attributes.length > 0) {
            MetadataEntryStore.actions.start(
                this.plugin.handlerParams.id,
                marking.label
            );
        }
    }
}
