// Build the bundled R runtime used by the shoeprint comparison feature.
//
// Usage: pnpm r:build
//
// Steps:
//  1. Download the pinned R installer for Windows (cached in .cache-r).
//  2. Silent-install it into src-tauri/r-runtime. R for Windows is relocatable,
//     so the resulting directory works from wherever the app is installed.
//  3. Install the shoeprintr dependencies from a pinned Posit Package Manager
//     snapshot (prebuilt binaries -- no Rtools needed).
//  4. Download the pinned upstream shoeprintr tarball (cached and checksummed)
//     and install it unmodified.
//  5. Prune documentation, translations and other files the app never reads.
//  6. Smoke-test the runner script with --check.
//
// On macOS and Linux this script installs the packages into a bundled library
// using a system R instead; see docs/developer-guide.md.

const { spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.resolve(__dirname, "..");
const RUNTIME_DIR = path.join(ROOT, "src-tauri", "r-runtime");
const LIBRARY_DIR = path.join(RUNTIME_DIR, "library");
const CACHE_DIR = path.join(ROOT, ".cache-r");
const RUNNER_SCRIPT = path.join(ROOT, "r", "shoeprint_compare.R");

const IS_WINDOWS = process.platform === "win32";

const R_VERSION = process.env.FBS_R_VERSION || "4.5.2";
const R_MINOR = R_VERSION.split(".").slice(0, 2).join(".");
const PPM_SNAPSHOT = process.env.FBS_PPM_SNAPSHOT || "2026-06-01";
const PPM_REPO = `https://packagemanager.posit.co/cran/${PPM_SNAPSHOT}`;

const SHOEPRINTR_COMMIT = "269e99f3383ab33869f4d6394d1d17b867e67620";
const SHOEPRINTR_URL = `https://codeload.github.com/CSAFE-ISU/shoeprintr/tar.gz/${SHOEPRINTR_COMMIT}`;
const SHOEPRINTR_SHA256 =
    "8249222526ed24969a565b3ebcbf01393a31cc4c74c99dcfe97488e1851a0763";

const REQUIRED_PACKAGES = [
    "jsonlite",
    "hexbin",
    "vec2dtransf",
    "sp",
    "dplyr",
    "ggplot2",
    "gridExtra",
];

function run(cmd, args, opts = {}) {
    const printable = `${cmd} ${args.join(" ")}`;
    console.log(`> ${printable}`);
    const result = spawnSync(cmd, args, {
        stdio: "inherit",
        shell: false,
        ...opts,
    });
    if (result.error) {
        throw new Error(`Could not run ${cmd}: ${result.error.message}`);
    }
    if (result.status !== 0) {
        throw new Error(`Command failed (exit ${result.status}): ${printable}`);
    }
    return result;
}

function download(url, destination) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destination);
        const cleanup = err => {
            file.close(() => {
                fs.rmSync(destination, { force: true });
                reject(err);
            });
        };
        https
            .get(url, response => {
                if (
                    response.statusCode >= 300 &&
                    response.statusCode < 400 &&
                    response.headers.location
                ) {
                    file.close(() => {
                        fs.rmSync(destination, { force: true });
                        download(response.headers.location, destination).then(
                            resolve,
                            reject
                        );
                    });
                    return;
                }
                if (response.statusCode !== 200) {
                    cleanup(
                        new Error(
                            `Download failed with HTTP ${response.statusCode}: ${url}`
                        )
                    );
                    return;
                }
                const total = Number(response.headers["content-length"] || 0);
                let received = 0;
                let lastReport = 0;
                response.on("data", chunk => {
                    received += chunk.length;
                    if (total && received - lastReport > 8 * 1024 * 1024) {
                        lastReport = received;
                        const pct = ((received / total) * 100).toFixed(0);
                        console.log(`  ...${pct}%`);
                    }
                });
                response.pipe(file);
                file.on("finish", () => file.close(() => resolve(destination)));
            })
            .on("error", cleanup);
    });
}

function rscriptPath() {
    if (IS_WINDOWS) {
        return path.join(RUNTIME_DIR, "bin", "x64", "Rscript.exe");
    }
    return path.join(RUNTIME_DIR, "bin", "Rscript");
}

function rCmdPath() {
    if (IS_WINDOWS) {
        return path.join(RUNTIME_DIR, "bin", "x64", "R.exe");
    }
    return path.join(RUNTIME_DIR, "bin", "R");
}

async function installWindowsRuntime() {
    if (fs.existsSync(rscriptPath())) {
        console.log(`R runtime already present at ${RUNTIME_DIR}`);
        return;
    }

    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const installer = path.join(CACHE_DIR, `R-${R_VERSION}-win.exe`);

    if (!fs.existsSync(installer)) {
        const url = `https://cran.r-project.org/bin/windows/base/old/${R_VERSION}/R-${R_VERSION}-win.exe`;
        console.log(`downloading ${url}`);
        await download(url, installer);
    } else {
        console.log(`using cached installer ${installer}`);
    }

    console.log(`installing R ${R_VERSION} into ${RUNTIME_DIR}`);
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
    run(installer, [
        "/VERYSILENT",
        "/SUPPRESSMSGBOXES",
        "/NORESTART",
        "/NOICONS",
        `/DIR=${RUNTIME_DIR}`,
    ]);

    if (!fs.existsSync(rscriptPath())) {
        throw new Error(
            `R installation finished but ${rscriptPath()} is missing`
        );
    }
}

function ensureSystemRuntime() {
    // macOS / Linux: reuse the system R and only bundle the library directory.
    const probe = spawnSync("Rscript", ["--version"], {
        encoding: "utf8",
        shell: false,
    });
    if (probe.error || probe.status !== 0) {
        throw new Error(
            "Rscript was not found on PATH.\n" +
                "The shoeprint comparison feature needs R on macOS and Linux:\n" +
                "  macOS:  brew install r\n" +
                "  Debian: sudo apt install r-base\n" +
                "On Windows this script downloads and bundles R automatically."
        );
    }
    console.log(
        `using system R: ${(probe.stdout || probe.stderr || "").trim()}`
    );
    fs.mkdirSync(LIBRARY_DIR, { recursive: true });
}

function rscriptCommand() {
    return IS_WINDOWS ? rscriptPath() : "Rscript";
}

function installPackages() {
    fs.mkdirSync(LIBRARY_DIR, { recursive: true });
    const libArg = LIBRARY_DIR.replace(/\\/g, "/");
    const missing = REQUIRED_PACKAGES.filter(
        pkg => !fs.existsSync(path.join(LIBRARY_DIR, pkg))
    );

    if (missing.length === 0) {
        console.log("all R packages already installed");
        return;
    }

    console.log(`installing R packages: ${missing.join(", ")}`);
    const expression = [
        `.libPaths("${libArg}")`,
        `options(repos = c(CRAN = "${PPM_REPO}"))`,
        `install.packages(c(${missing.map(p => `"${p}"`).join(", ")}), lib = "${libArg}", dependencies = c("Depends", "Imports", "LinkingTo"))`,
        `missing <- setdiff(c(${REQUIRED_PACKAGES.map(p => `"${p}"`).join(", ")}), rownames(installed.packages(lib.loc = "${libArg}")))`,
        `if (length(missing)) { stop(paste("failed to install:", paste(missing, collapse = ", "))) }`,
    ].join("; ");

    run(rscriptCommand(), ["--vanilla", "-e", expression]);
}

function removeIfPresent(target) {
    if (fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
    }
}

function sha256Of(file) {
    return crypto
        .createHash("sha256")
        .update(fs.readFileSync(file))
        .digest("hex");
}

const SHOEPRINTR_MARKER = path.join(LIBRARY_DIR, ".shoeprintr-commit");

function shoeprintrIsCurrent() {
    if (!fs.existsSync(path.join(LIBRARY_DIR, "shoeprintr"))) return false;
    if (!fs.existsSync(SHOEPRINTR_MARKER)) return false;
    return (
        fs.readFileSync(SHOEPRINTR_MARKER, "utf8").trim() === SHOEPRINTR_COMMIT
    );
}

async function installShoeprintr() {
    const shortCommit = SHOEPRINTR_COMMIT.slice(0, 7);
    if (shoeprintrIsCurrent()) {
        console.log(`shoeprintr ${shortCommit} already installed`);
        return;
    }

    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const tarball = path.join(
        CACHE_DIR,
        `shoeprintr-${SHOEPRINTR_COMMIT}.tar.gz`
    );

    if (!fs.existsSync(tarball)) {
        console.log(`downloading ${SHOEPRINTR_URL}`);
        await download(SHOEPRINTR_URL, tarball);
    } else {
        console.log(`using cached tarball ${tarball}`);
    }

    const digest = sha256Of(tarball);
    if (digest !== SHOEPRINTR_SHA256) {
        fs.rmSync(tarball, { force: true });
        throw new Error(
            `shoeprintr tarball checksum mismatch\n` +
                `  expected ${SHOEPRINTR_SHA256}\n` +
                `  actual   ${digest}\n` +
                "The cached copy has been discarded. If the pin was changed on " +
                "purpose, update SHOEPRINTR_SHA256 in this script."
        );
    }

    const sources = path.join(CACHE_DIR, `shoeprintr-${SHOEPRINTR_COMMIT}`);
    removeIfPresent(sources);
    run("tar", ["-xzf", path.basename(tarball)], { cwd: CACHE_DIR });
    if (!fs.existsSync(sources)) {
        throw new Error(`extracting ${tarball} did not produce ${sources}`);
    }

    console.log(`installing shoeprintr ${shortCommit}`);
    const rCmd = IS_WINDOWS ? rCmdPath() : "R";
    run(rCmd, [
        "--vanilla",
        "CMD",
        "INSTALL",
        "--no-docs",
        "--no-multiarch",
        `--library=${LIBRARY_DIR}`,
        sources,
    ]);

    fs.writeFileSync(SHOEPRINTR_MARKER, `${SHOEPRINTR_COMMIT}\n`);

    // R CMD INSTALL copies inst/bin verbatim; on Unix the solver loses its
    // executable bit when the repo is checked out from a zip.
    if (!IS_WINDOWS) {
        for (const os of ["lin64", "mac64"]) {
            const binary = path.join(
                LIBRARY_DIR,
                "shoeprintr",
                "bin",
                os,
                "pmc"
            );
            if (fs.existsSync(binary)) fs.chmodSync(binary, 0o755);
        }
    }
}

// R ships a lot the app never touches
function prune() {
    console.log("pruning runtime");

    for (const relative of [
        "doc",
        "Tcl",
        "share/zoneinfo",
        "src",
        "unins000.dat",
        "unins000.exe",
    ]) {
        removeIfPresent(path.join(RUNTIME_DIR, relative));
    }

    // 32-bit tree, if an older R version installed one.
    removeIfPresent(path.join(RUNTIME_DIR, "bin", "i386"));

    const libraryRoots = [
        path.join(RUNTIME_DIR, "library"),
        LIBRARY_DIR,
    ].filter((value, index, all) => all.indexOf(value) === index);

    for (const root of libraryRoots) {
        if (!fs.existsSync(root)) continue;
        for (const pkg of fs.readdirSync(root)) {
            for (const junk of ["doc", "html", "help/figures", "tests", "po"]) {
                removeIfPresent(path.join(root, pkg, junk));
            }
        }
    }

    removeIfPresent(path.join(RUNTIME_DIR, "library", "translations"));
}

function smokeTest() {
    console.log("smoke test: shoeprint_compare.R --check");
    const env = {
        ...process.env,
        R_LIBS_USER: LIBRARY_DIR,
        R_LIBS_SITE: LIBRARY_DIR,
    };
    run(rscriptCommand(), ["--vanilla", RUNNER_SCRIPT, "--check"], { env });
}

async function main() {
    if (IS_WINDOWS) {
        await installWindowsRuntime();
    } else {
        ensureSystemRuntime();
    }
    installPackages();
    await installShoeprintr();
    prune();
    smokeTest();
    console.log("OK: R runtime ready");
}

main().catch(err => {
    console.error(err.message || err);
    process.exit(1);
});
