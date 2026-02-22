const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const configPath = path.resolve(repoRoot, "src-tauri", "tauri.conf.json");

function fail(message) {
    console.error(message);
    process.exit(1);
}

function runCommand(command, args, options = {}) {
    const resolvedCommand =
        process.platform === "win32" && command === "pnpm"
            ? "pnpm.cmd"
            : command;
    const result = spawnSync(resolvedCommand, args, {
        cwd: repoRoot,
        stdio: "inherit",
        ...options,
    });

    if (result.error) {
        fail(`Failed to run "${command}": ${result.error.message}`);
    }
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

function getRustTargetTriple() {
    const result = spawnSync("rustc", ["-vV"], {
        encoding: "utf8",
    });
    if (result.error || result.status !== 0) {
        fail("Failed to detect Rust target triple. Ensure rustc is on PATH.");
    }

    const hostLine = result.stdout
        .split(/\r?\n/)
        .find(line => line.startsWith("host:"));
    if (!hostLine) {
        fail("Failed to detect Rust target triple. Ensure rustc is on PATH.");
    }

    const targetTriple = hostLine.split(":")[1]?.trim();
    if (!targetTriple) {
        fail("Failed to detect Rust target triple. Ensure rustc is on PATH.");
    }
    return targetTriple;
}

function validateTauriConfig(configFilePath) {
    if (!fs.existsSync(configFilePath)) {
        fail(`Tauri config not found: ${configFilePath}`);
    }

    const raw = fs.readFileSync(configFilePath, "utf8");
    try {
        JSON.parse(raw);
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unknown JSON parse error";
        fail(`Invalid JSON in ${configFilePath}: ${message}`);
    }

    // Keep UTF-8 without BOM, aligned with the old PowerShell script behavior.
    fs.writeFileSync(configFilePath, raw, { encoding: "utf8" });
    console.log(`Tauri config JSON OK: ${configFilePath}`);
}

function checkSidecar(configFilePath) {
    const config = JSON.parse(fs.readFileSync(configFilePath, "utf8"));
    const externalBin = Array.isArray(config?.bundle?.externalBin)
        ? config.bundle.externalBin
        : [];
    console.log(`externalBin: ${externalBin.join(", ")}`);

    const targetTriple = getRustTargetTriple();
    const binDir = path.resolve(repoRoot, "src-tauri", "bin");
    const expected = path.join(binDir, `sourceafis_cli-${targetTriple}.exe`);

    if (!fs.existsSync(expected)) {
        fail(`Missing sidecar: ${expected}\nRun: pnpm run sidecar:sync`);
    }

    console.log(`Sidecar OK: ${expected}`);
}

function runTauriDev(configFilePath) {
    console.log(`TAURI_CONFIG=${configFilePath}`);
    runCommand("pnpm", ["tauri", "dev", "--config", configFilePath], {
        env: {
            ...process.env,
            TAURI_CONFIG: configFilePath,
        },
    });
}

validateTauriConfig(configPath);
checkSidecar(configPath);
runTauriDev(configPath);
