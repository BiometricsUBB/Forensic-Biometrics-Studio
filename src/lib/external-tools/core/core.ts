export type ExternalExecutionPlan = {
    command: string;
    args: string[];
};

export type ExternalProcessResult = {
    code: number | null;
    stdout: string;
    stderr: string;
    durationMs: number;
};

export type ExternalToolLogger = {
    debug?: (...message: unknown[]) => void;
    info?: (...message: unknown[]) => void;
    warn?: (...message: unknown[]) => void;
    error?: (...message: unknown[]) => void;
};

export type ExternalRunOptions = {
    timeoutMs?: number;
    logger?: ExternalToolLogger;
};

export interface ExternalToolStrategy<TRequest> {
    buildExecutionPlan(request: TRequest): ExternalExecutionPlan;
}

export interface ExternalProcessAdapter {
    execute(
        plan: ExternalExecutionPlan,
        options?: ExternalRunOptions
    ): Promise<ExternalProcessResult>;
}

export interface ExternalTool<TRequest, TResult> {
    run(request: TRequest, options?: ExternalRunOptions): Promise<TResult>;
}
