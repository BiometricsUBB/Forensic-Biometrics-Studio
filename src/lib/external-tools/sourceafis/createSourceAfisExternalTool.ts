/* eslint-disable max-classes-per-file */

import { platform } from "@tauri-apps/plugin-os";
import { exists, readTextFile } from "@tauri-apps/plugin-fs";
import { Command } from "@tauri-apps/plugin-shell";
import {
    ExternalExecutionPlan,
    ExternalProcessAdapter,
    ExternalProcessResult,
    ExternalRunOptions,
    ExternalTool,
    ExternalToolLogger,
    ExternalToolStrategy,
} from "@/lib/external-tools/core/core";
import {
    ExternalToolError,
    ExternalToolNotImplementedError,
    ExternalToolProcessError,
    ExternalToolTimeoutError,
} from "@/lib/external-tools/core/errors";

const SOURCE_AFIS_SIDECAR_NAME = "bin/sourceafis_cli";
export const SOURCE_AFIS_TIMEOUT_MS = 30_000;
const SOURCE_AFIS_LOG_PREFIX = "[SourceAFIS ExternalTool]";
const MAX_LOG_TEXT_LENGTH = 500;

export type SourceAfisRunRequest = {
    imagePath: string;
    outTemplatePath: string;
    outJsonPath: string;
};

export type SourceAfisJson = {
    minutiae?: Array<{
        x: number;
        y: number;
        direction: number;
        type: "ending" | "bifurcation";
    }>;
    width?: number;
    height?: number;
};

export type SourceAfisRunResult = {
    processResult: ExternalProcessResult;
    sourceAfisJson: SourceAfisJson;
};

function truncateLogText(text: string) {
    if (text.length <= MAX_LOG_TEXT_LENGTH) {
        return text;
    }
    return `${text.slice(0, MAX_LOG_TEXT_LENGTH)}...(truncated)`;
}

function logDebug(
    logger: ExternalToolLogger | undefined,
    message: string,
    payload?: unknown
) {
    logger?.debug?.(SOURCE_AFIS_LOG_PREFIX, message, payload);
}

function logInfo(
    logger: ExternalToolLogger | undefined,
    message: string,
    payload?: unknown
) {
    logger?.info?.(SOURCE_AFIS_LOG_PREFIX, message, payload);
}

function logError(
    logger: ExternalToolLogger | undefined,
    message: string,
    payload?: unknown
) {
    logger?.error?.(SOURCE_AFIS_LOG_PREFIX, message, payload);
}

class TauriProcessAdapter implements ExternalProcessAdapter {
    public async execute(
        plan: ExternalExecutionPlan,
        options?: ExternalRunOptions
    ): Promise<ExternalProcessResult> {
        const timeoutMs = options?.timeoutMs ?? SOURCE_AFIS_TIMEOUT_MS;
        const logger = options?.logger;

        logInfo(logger, "Starting process", {
            command: plan.command,
            args: plan.args,
            timeoutMs,
        });

        const command = Command.sidecar(plan.command, plan.args);
        const startedAt = Date.now();
        let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
        const timeoutPromise = new Promise<never>((_resolve, reject) => {
            timeoutHandle = setTimeout(() => {
                reject(new ExternalToolTimeoutError(plan.command, timeoutMs));
            }, timeoutMs);
        });

        try {
            const output = (await Promise.race([
                command.execute(),
                timeoutPromise,
            ])) as {
                code: number | null;
                stdout: string;
                stderr: string;
            };
            const durationMs = Date.now() - startedAt;

            logDebug(logger, "Process stdout", truncateLogText(output.stdout));
            logDebug(logger, "Process stderr", truncateLogText(output.stderr));
            logInfo(logger, "Process finished", {
                command: plan.command,
                code: output.code,
                durationMs,
            });

            if (output.code !== 0) {
                throw new ExternalToolProcessError(
                    plan.command,
                    output.code,
                    output.stderr
                );
            }

            return {
                code: output.code,
                stdout: output.stdout,
                stderr: output.stderr,
                durationMs,
            };
        } catch (error) {
            if (error instanceof ExternalToolTimeoutError) {
                logError(
                    logger,
                    "Process timeout reached. Process termination is not implemented yet."
                );
            } else {
                logError(logger, "Process execution failed", error);
            }
            throw error;
        } finally {
            if (timeoutHandle !== null) {
                clearTimeout(timeoutHandle);
            }
        }
    }
}

class WindowsSourceAfisStrategy
    implements ExternalToolStrategy<SourceAfisRunRequest>
{
    public buildExecutionPlan(
        request: SourceAfisRunRequest
    ): ExternalExecutionPlan {
        return {
            command: SOURCE_AFIS_SIDECAR_NAME,
            args: [
                "--image",
                request.imagePath,
                "--out-template",
                request.outTemplatePath,
                "--out-json",
                request.outJsonPath,
            ],
        };
    }
}

class NotImplementedSourceAfisStrategy
    implements ExternalToolStrategy<SourceAfisRunRequest>
{
    private readonly currentOs: string;

    public constructor(currentOs: string) {
        this.currentOs = currentOs;
    }

    public buildExecutionPlan(
        _request: SourceAfisRunRequest
    ): ExternalExecutionPlan {
        // eslint-disable-next-line no-void
        void _request;
        throw new ExternalToolNotImplementedError(
            `SourceAFIS external tool for "${this.currentOs}" not implemented yet`
        );
    }
}

class SourceAfisJsonOutputAdapter {
    public async read(
        outJsonPath: string,
        logger?: ExternalToolLogger
    ): Promise<SourceAfisJson> {
        const jsonExists = await exists(outJsonPath);
        if (!jsonExists) {
            throw new ExternalToolError(
                `SourceAFIS output JSON missing: ${outJsonPath}`
            );
        }

        const jsonText = await readTextFile(outJsonPath);
        logDebug(logger, "JSON output length", jsonText.length);
        logDebug(logger, "JSON output head", jsonText.slice(0, 200));

        let parsed: unknown;
        try {
            parsed = JSON.parse(jsonText);
        } catch (error) {
            throw new ExternalToolError(
                "SourceAFIS output JSON parse failed",
                error
            );
        }

        if (!parsed || typeof parsed !== "object") {
            throw new ExternalToolError(
                "SourceAFIS output JSON root is not an object"
            );
        }

        const candidate = parsed as SourceAfisJson;
        if (
            candidate.minutiae !== undefined &&
            !Array.isArray(candidate.minutiae)
        ) {
            throw new ExternalToolError(
                'SourceAFIS output JSON field "minutiae" is not an array'
            );
        }

        return candidate;
    }
}

class SourceAfisExternalTool
    implements ExternalTool<SourceAfisRunRequest, SourceAfisRunResult>
{
    private readonly strategy: ExternalToolStrategy<SourceAfisRunRequest>;

    private readonly processAdapter: ExternalProcessAdapter;

    private readonly jsonAdapter: SourceAfisJsonOutputAdapter;

    public constructor(
        strategy: ExternalToolStrategy<SourceAfisRunRequest>,
        processAdapter: ExternalProcessAdapter,
        jsonAdapter: SourceAfisJsonOutputAdapter
    ) {
        this.strategy = strategy;
        this.processAdapter = processAdapter;
        this.jsonAdapter = jsonAdapter;
    }

    public async run(
        request: SourceAfisRunRequest,
        options?: ExternalRunOptions
    ): Promise<SourceAfisRunResult> {
        const plan = this.strategy.buildExecutionPlan(request);
        const processResult = await this.processAdapter.execute(plan, options);

        const templateExists = await exists(request.outTemplatePath);
        if (!templateExists) {
            throw new ExternalToolError(
                `SourceAFIS output template missing: ${request.outTemplatePath}`
            );
        }

        const sourceAfisJson = await this.jsonAdapter.read(
            request.outJsonPath,
            options?.logger
        );
        return {
            processResult,
            sourceAfisJson,
        };
    }
}

async function resolveSourceAfisStrategy(): Promise<
    ExternalToolStrategy<SourceAfisRunRequest>
> {
    const currentOs = await Promise.resolve(platform());
    if (currentOs === "windows") {
        return new WindowsSourceAfisStrategy();
    }
    return new NotImplementedSourceAfisStrategy(currentOs);
}

export async function createSourceAfisExternalTool(): Promise<
    ExternalTool<SourceAfisRunRequest, SourceAfisRunResult>
> {
    const strategy = await resolveSourceAfisStrategy();
    return new SourceAfisExternalTool(
        strategy,
        new TauriProcessAdapter(),
        new SourceAfisJsonOutputAdapter()
    );
}
