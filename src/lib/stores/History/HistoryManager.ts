import { Command } from "./Command";

class HistoryManagerClass {
    private undoStack: Command[] = [];
    private redoStack: Command[] = [];

    executeCommand(command: Command): void {
        command.execute();
        this.undoStack.push(command);
        this.redoStack = [];
    }

    undo(): void {
        const command = this.undoStack.pop();
        if (command) {
            command.unExecute();
            this.redoStack.push(command);
        }
    }

    redo(): void {
        const command = this.redoStack.pop();
        if (command) {
            command.execute();
            this.undoStack.push(command);
        }
    }

    clear(): void {
        this.undoStack = [];
        this.redoStack = [];
    }
}


const GlobalHistoryManager = new HistoryManagerClass();

export { GlobalHistoryManager };