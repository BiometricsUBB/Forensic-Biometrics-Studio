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

function log(
    logger: ExternalToolLogger | undefined,
    level: "info" | "error" | "debug",
    message: string,
    payload?: unknown
) {
    logger?.[level]?.(LOG_PREFIX, message, payload);
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

    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeoutHandle = setTimeout(() => {
            reject(
                new ExternalToolTimeoutError(PYFING_SIDECAR_NAME, timeoutMs)
            );
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
    } finally {
        if (timeoutHandle !== null) {
            clearTimeout(timeoutHandle);
        }
    }
}
