import { Command } from "@tauri-apps/plugin-shell";
import { exists } from "@tauri-apps/plugin-fs";
import {
    ExternalRunOptions,
    ExternalToolLogger,
} from "@/lib/external-tools/core/core";
import {
    ExternalToolError,
    ExternalToolTimeoutError,
} from "@/lib/external-tools/core/errors";

const PYFING_SIDECAR_NAME = "bin/pyfing_enhance";
const PYFING_TIMEOUT_MS = 120_000; // 2 min — enhancement can be slow
const LOG_PREFIX = "[Pyfing ExternalTool]";

export type PyfingMethod = "GBFEN" | "SNFEN";

export type PyfingRunRequest = {
    imagePath: string;
    outputPath: string;
    method: PyfingMethod;
    dpi?: number;
};

export type PyfingRunResult = {
    outputPath: string;
    durationMs: number;
    stderr: string;
};

type ProcessOutcome = {
    code: number | null;
    stdout: string;
    stderr: string;
};

function log(
    logger: ExternalToolLogger | undefined,
    level: "info" | "error" | "debug",
    message: string,
    payload?: unknown
) {
    logger?.[level]?.(LOG_PREFIX, message, payload);
}

/**
 * Spawn the sidecar and resolve when it exits naturally.
 *
 * If the timeout fires we kill the child process (so the OS reaps it
 * immediately) and reject with `ExternalToolTimeoutError`. This is the key
 * difference from `Command.execute()` racing a `setTimeout`: that pattern
 * leaks the child process because the JS promise rejects but the native
 * process keeps running.
 */
async function spawnWithTimeout(
    command: Command<string>,
    timeoutMs: number,
    logger: ExternalToolLogger | undefined
): Promise<ProcessOutcome> {
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    command.stdout.on("data", line => {
        stdoutChunks.push(line);
    });
    command.stderr.on("data", line => {
        stderrChunks.push(line);
    });

    const child = await command.spawn();

    return new Promise<ProcessOutcome>((resolve, reject) => {
        let settled = false;
        let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

        const finish = (outcome: ProcessOutcome | Error) => {
            if (settled) return;
            settled = true;
            if (timeoutHandle !== null) {
                clearTimeout(timeoutHandle);
                timeoutHandle = null;
            }
            if (outcome instanceof Error) {
                reject(outcome);
            } else {
                resolve(outcome);
            }
        };

        command.on("close", payload => {
            const code =
                typeof payload === "object" &&
                payload !== null &&
                "code" in payload
                    ? (payload as { code: number | null }).code ?? null
                    : null;
            finish({
                code,
                stdout: stdoutChunks.join("\n"),
                stderr: stderrChunks.join("\n"),
            });
        });

        command.on("error", err => {
            finish(
                new ExternalToolError(
                    `pyfing process error: ${typeof err === "string" ? err : JSON.stringify(err)}`
                )
            );
        });

        timeoutHandle = setTimeout(() => {
            log(logger, "error", "Process timed out, killing child", {
                timeoutMs,
            });
            child.kill().catch(killErr => {
                log(logger, "error", "Failed to kill child after timeout", {
                    error: killErr,
                });
            });
            finish(
                new ExternalToolTimeoutError(PYFING_SIDECAR_NAME, timeoutMs)
            );
        }, timeoutMs);
    });
}

export async function runPyfingEnhancement(
    request: PyfingRunRequest,
    options?: ExternalRunOptions
): Promise<PyfingRunResult> {
    const timeoutMs = options?.timeoutMs ?? PYFING_TIMEOUT_MS;
    const logger = options?.logger;
    const dpi = request.dpi ?? 500;

    const args = [
        "--input",
        request.imagePath,
        "--output",
        request.outputPath,
        "--method",
        request.method,
        "--dpi",
        String(dpi),
    ];

    log(logger, "info", "Starting pyfing enhancement", {
        method: request.method,
        imagePath: request.imagePath,
        outputPath: request.outputPath,
        dpi,
        timeoutMs,
    });

    const command = Command.sidecar(PYFING_SIDECAR_NAME, args);
    const startedAt = Date.now();

    try {
        const output = await spawnWithTimeout(command, timeoutMs, logger);
        const durationMs = Date.now() - startedAt;

        log(logger, "debug", "stderr", output.stderr);
        log(logger, "info", "Process finished", {
            code: output.code,
            durationMs,
        });

        if (output.code !== 0) {
            throw new ExternalToolError(
                `pyfing enhancement failed (exit ${output.code}): ${output.stderr}`
            );
        }

        const outputExists = await exists(request.outputPath);
        if (!outputExists) {
            throw new ExternalToolError(
                `pyfing output file missing: ${request.outputPath}`
            );
        }

        return {
            outputPath: request.outputPath,
            durationMs,
            stderr: output.stderr,
        };
    } catch (error) {
        if (error instanceof ExternalToolTimeoutError) {
            log(logger, "error", "Process timed out");
        } else {
            log(logger, "error", "Process failed", error);
        }
        throw error;
    }
}
