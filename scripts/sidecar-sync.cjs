const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");

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

function findCliRoot() {
    const candidates = [
        path.resolve(repoRoot, "..", "sourceafis-net", "SourceAFIS.Cli"),
        path.resolve(repoRoot, "..", "SourceAFIS", "SourceAFIS.Cli"),
    ];

    const cliRoot = candidates.find(candidate => fs.existsSync(candidate));
    if (!cliRoot) {
        fail(
            `SourceAFIS.Cli project not found at: ${candidates
                .map(candidate => `"${candidate}"`)
                .join(" or ")}`
        );
    }

    return cliRoot;
}

function findFirstMatchingFile(rootDir, matcher) {
    const stack = [rootDir];
    while (stack.length > 0) {
        const current = stack.pop();
        if (!current || !fs.existsSync(current)) {
            continue;
        }

        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(fullPath);
                continue;
            }
            if (matcher(fullPath)) {
                return fullPath;
            }
        }
    }
    return null;
}

function publishSourceAfisCli(csprojPath) {
    runCommand("dotnet", [
        "publish",
        csprojPath,
        "-c",
        "Release",
        "-r",
        "win-x64",
        "-p:PublishSingleFile=true",
        "-p:SelfContained=false",
    ]);
}

function copySidecar(cliRoot, targetTriple) {
    const releaseRoot = path.join(cliRoot, "bin", "Release");
    const sourceExe = findFirstMatchingFile(releaseRoot, fullPath => {
        const normalized = fullPath.replace(/\\/g, "/");
        return normalized.endsWith("/win-x64/publish/SourceAFIS.Cli.exe");
    });

    if (!sourceExe) {
        fail(
            `SourceAFIS.Cli.exe publish output not found under: ${cliRoot}\n` +
                "Build it with: dotnet publish ..\\SourceAFIS\\SourceAFIS.Cli\\SourceAFIS.Cli.csproj -c Release -r win-x64 -p:PublishSingleFile=true -p:SelfContained=false"
        );
    }

    console.log(`Found publish output: ${sourceExe}`);

    const destinationDir = path.resolve(repoRoot, "src-tauri", "bin");
    fs.mkdirSync(destinationDir, { recursive: true });
    const destinationName = `sourceafis_cli-${targetTriple}.exe`;
    const destinationPath = path.join(destinationDir, destinationName);
    fs.copyFileSync(sourceExe, destinationPath);
    console.log(`Copied sidecar to: ${destinationPath}`);
}

const cliRoot = findCliRoot();
const csprojPath = path.join(cliRoot, "SourceAFIS.Cli.csproj");
publishSourceAfisCli(csprojPath);
const targetTriple = getRustTargetTriple();
copySidecar(cliRoot, targetTriple);
