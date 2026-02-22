/* eslint-disable max-classes-per-file */

export class ExternalToolError extends Error {
    public override readonly cause: unknown;

    public constructor(message: string, cause?: unknown) {
        super(message);
        this.name = "ExternalToolError";
        this.cause = cause;
    }
}

export class ExternalToolTimeoutError extends ExternalToolError {
    public readonly timeoutMs: number;

    public readonly command: string;

    public constructor(command: string, timeoutMs: number, cause?: unknown) {
        super(
            `External tool "${command}" timed out after ${timeoutMs}ms`,
            cause
        );
        this.name = "ExternalToolTimeoutError";
        this.timeoutMs = timeoutMs;
        this.command = command;
    }
}

export class ExternalToolProcessError extends ExternalToolError {
    public readonly command: string;

    public readonly exitCode: number | null;

    public readonly stderr: string;

    public constructor(
        command: string,
        exitCode: number | null,
        stderr: string,
        cause?: unknown
    ) {
        super(
            `External tool "${command}" failed with exit code ${exitCode}`,
            cause
        );
        this.name = "ExternalToolProcessError";
        this.command = command;
        this.exitCode = exitCode;
        this.stderr = stderr;
    }
}

export class ExternalToolNotImplementedError extends ExternalToolError {
    public constructor(message: string) {
        super(message);
        this.name = "ExternalToolNotImplementedError";
    }
}
