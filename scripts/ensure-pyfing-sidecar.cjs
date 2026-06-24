// Idempotent: ensures src-tauri/bin/pyfing_enhance.exe exists.
// If missing, runs build-pyfing-sidecar.cjs to build it.
//
// Used as a pre-build step so `pnpm tauri build` "just works" on a fresh clone.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const IS_WINDOWS = process.platform === "win32";
const EXE_EXT = IS_WINDOWS ? ".exe" : "";
const SIDECAR = path.join(
    ROOT,
    "src-tauri",
    "bin",
    `pyfing_enhance${EXE_EXT}`
);

if (fs.existsSync(SIDECAR)) {
    console.log(`pyfing sidecar already present: ${SIDECAR}`);
    process.exit(0);
}

console.log("pyfing sidecar missing, building it now...");
const result = spawnSync(
    "node",
    [path.join(__dirname, "build-pyfing-sidecar.cjs")],
    { stdio: "inherit", shell: false }
);
process.exit(result.status === null ? 1 : result.status);
