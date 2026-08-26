// Idempotent: ensures both Tauri's target-specific sidecar and the generic
// development fallback exist.
// If missing, runs build-pyfing-sidecar.cjs to build it.
//
// Used as a pre-build step so `pnpm tauri build` "just works" on a fresh clone.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const IS_WINDOWS = process.platform === "win32";
const EXE_EXT = IS_WINDOWS ? ".exe" : "";
const rustc = spawnSync("rustc", ["-vV"], { encoding: "utf8", shell: false });
const detectedTriple = rustc.stdout?.match(/host:\s*(\S+)/)?.[1];
const targetTriple =
    detectedTriple ||
    (IS_WINDOWS
        ? "x86_64-pc-windows-msvc"
        : process.platform === "darwin"
          ? `${process.arch === "arm64" ? "aarch64" : "x86_64"}-apple-darwin`
          : `${process.arch === "arm64" ? "aarch64" : "x86_64"}-unknown-linux-gnu`);
const BIN_DIR = path.join(ROOT, "src-tauri", "bin");
const SIDECARS = [
    path.join(BIN_DIR, `pyfing_enhance-${targetTriple}${EXE_EXT}`),
    path.join(BIN_DIR, `pyfing_enhance${EXE_EXT}`),
];

if (SIDECARS.every(sidecar => fs.existsSync(sidecar))) {
    console.log(`pyfing sidecars already present for ${targetTriple}`);
    process.exit(0);
}

console.log("pyfing sidecar missing, building it now...");
const result = spawnSync(
    "node",
    [path.join(__dirname, "build-pyfing-sidecar.cjs")],
    { stdio: "inherit", shell: false }
);
process.exit(result.status === null ? 1 : result.status);
