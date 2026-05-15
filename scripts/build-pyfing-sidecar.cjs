// Build PyInstaller sidecar for pyfing_enhance using uv.
// Works on Windows, macOS (Intel + Apple Silicon) and Linux.
//
// Usage: pnpm sidecar:build:pyfing
//
// Steps:
//  1. Detect Rust target triple via `rustc -vV` (host: ...).
//  2. Ensure uv is available (install hint if missing).
//  3. Create venv at .venv-pyfing with Python 3.11 via `uv venv --python 3.11`.
//  4. Install requirements with `uv pip install -r ...`.
//  5. Strip unused heavy ML deps that PyInstaller would otherwise scan.
//  6. Run PyInstaller using scripts/pyfing_enhance.spec.
//  7. Copy dist/pyfing_enhance(.exe) -> src-tauri/bin/pyfing_enhance-<triple>(.exe)
//     and a generic copy without triple suffix (for Command.sidecar dev fallback).
//  8. Smoke-test with `--check` (exit 0).

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const VENV_DIR = path.join(ROOT, ".venv-pyfing");
const REQUIREMENTS = path.join(ROOT, "scripts", "pyfing-requirements.txt");
const SPEC_FILE = path.join(ROOT, "scripts", "pyfing_enhance.spec");
const DIST_DIR = path.join(ROOT, "dist-pyinstaller");
const WORK_DIR = path.join(ROOT, "build-pyinstaller");
const BIN_DIR = path.join(ROOT, "src-tauri", "bin");
const IS_WINDOWS = process.platform === "win32";
const IS_MAC = process.platform === "darwin";
const EXE_EXT = IS_WINDOWS ? ".exe" : "";
const PYTHON_VERSION = process.env.PYFING_PYTHON_VERSION || "3.11";

function run(cmd, args, opts = {}) {
    const printable = `${cmd} ${args.join(" ")}`;
    console.log(`> ${printable}`);
    const result = spawnSync(cmd, args, {
        stdio: "inherit",
        shell: false,
        ...opts,
    });
    if (result.status !== 0) {
        throw new Error(`Command failed (exit ${result.status}): ${printable}`);
    }
    return result;
}

function captureOutput(cmd, args) {
    const result = spawnSync(cmd, args, { encoding: "utf8", shell: false });
    if (result.status !== 0) {
        throw new Error(
            `Command failed (exit ${result.status}): ${cmd} ${args.join(" ")}\n${result.stderr || ""}`
        );
    }
    return result.stdout || "";
}

function detectTargetTriple() {
    try {
        const out = captureOutput("rustc", ["-vV"]);
        const match = out.match(/host:\s*(\S+)/);
        if (match) return match[1];
    } catch (err) {
        console.warn(
            "WARN: rustc not found, defaulting target triple",
            err.message
        );
    }
    if (IS_WINDOWS) return "x86_64-pc-windows-msvc";
    if (IS_MAC) {
        return process.arch === "arm64"
            ? "aarch64-apple-darwin"
            : "x86_64-apple-darwin";
    }
    return process.arch === "arm64"
        ? "aarch64-unknown-linux-gnu"
        : "x86_64-unknown-linux-gnu";
}

function ensureUv() {
    const probe = spawnSync("uv", ["--version"], {
        encoding: "utf8",
        shell: false,
    });
    if (probe.status === 0) {
        console.log(`uv detected: ${(probe.stdout || "").trim()}`);
        return;
    }
    throw new Error(
        "uv is not installed or not on PATH. Install it first:\n" +
            "  Windows PowerShell:  irm https://astral.sh/uv/install.ps1 | iex\n" +
            "  macOS / Linux:       curl -LsSf https://astral.sh/uv/install.sh | sh\n" +
            "  pip:                 pip install uv\n" +
            "Then re-run this script."
    );
}

function venvPython() {
    if (IS_WINDOWS) {
        return path.join(VENV_DIR, "Scripts", "python.exe");
    }
    return path.join(VENV_DIR, "bin", "python");
}

function ensureVenv() {
    if (fs.existsSync(venvPython())) {
        console.log(`venv exists at ${VENV_DIR}`);
        return;
    }
    console.log(`creating venv at ${VENV_DIR} with Python ${PYTHON_VERSION}`);
    run("uv", ["venv", "--python", PYTHON_VERSION, VENV_DIR]);
}

function installDeps() {
    const py = venvPython();
    run("uv", ["pip", "install", "--python", py, "-r", REQUIREMENTS]);

    // Strip ML deps that may have been pulled transitively but PyInstaller
    // would otherwise try to bytecode-scan them (extra time + occasional bugs).
    const heavyPackages = [
        "torch",
        "torchvision",
        "torchaudio",
        "jax",
        "jaxlib",
    ];
    for (const pkg of heavyPackages) {
        const result = spawnSync(
            "uv",
            ["pip", "uninstall", "--python", py, pkg],
            { stdio: "inherit", shell: false }
        );
        if (result.status !== 0) {
            console.log(`(skipped uninstall: ${pkg} not present)`);
        }
    }
}

function buildExe() {
    const py = venvPython();
    if (fs.existsSync(DIST_DIR)) {
        fs.rmSync(DIST_DIR, { recursive: true, force: true });
    }
    if (fs.existsSync(WORK_DIR)) {
        fs.rmSync(WORK_DIR, { recursive: true, force: true });
    }
    run(py, [
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--distpath",
        DIST_DIR,
        "--workpath",
        WORK_DIR,
        SPEC_FILE,
    ]);
}

function copySidecar(triple) {
    if (!fs.existsSync(BIN_DIR)) {
        fs.mkdirSync(BIN_DIR, { recursive: true });
    }
    const built = path.join(DIST_DIR, `pyfing_enhance${EXE_EXT}`);
    if (!fs.existsSync(built)) {
        throw new Error(`built binary not found: ${built}`);
    }
    const targets = [
        path.join(BIN_DIR, `pyfing_enhance-${triple}${EXE_EXT}`),
        path.join(BIN_DIR, `pyfing_enhance${EXE_EXT}`),
    ];
    for (const target of targets) {
        fs.copyFileSync(built, target);
        if (!IS_WINDOWS) {
            // Tauri requires sidecar binaries to be executable on Unix.
            fs.chmodSync(target, 0o755);
        }
        console.log(`copied -> ${target}`);
    }
}

function smokeTest() {
    const exe = path.join(BIN_DIR, `pyfing_enhance${EXE_EXT}`);
    console.log(`smoke test: ${exe} --check`);
    const result = spawnSync(exe, ["--check"], { stdio: "inherit" });
    if (result.status !== 0) {
        throw new Error(`smoke test failed (exit ${result.status})`);
    }
}

function main() {
    const triple = detectTargetTriple();
    console.log(`target triple: ${triple}`);
    ensureUv();
    ensureVenv();
    installDeps();
    buildExe();
    copySidecar(triple);
    smokeTest();
    console.log("OK: pyfing sidecar built");
}

try {
    main();
} catch (err) {
    console.error(err.message || err);
    process.exit(1);
}
