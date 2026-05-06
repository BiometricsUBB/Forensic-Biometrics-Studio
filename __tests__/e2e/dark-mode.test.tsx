import os from "os";
import path from "path";
import { ChildProcessByStdio, spawn, spawnSync } from "child_process";
import { Builder, By, Capabilities, WebDriver } from "selenium-webdriver";
import { Writable } from "stream";
import find from "find-process";

// Tauri-driver supports Linux (webkit2gtk-driver) and Windows (msedgedriver).
// macOS has no WebDriver for WKWebView — skip there.
const PLATFORM = process.platform;
const SUPPORTED = PLATFORM === "win32" || PLATFORM === "linux";

const isWindows = PLATFORM === "win32";
const exe = isWindows ? ".exe" : "";

const application = isWindows
    ? path.resolve(
          __dirname,
          "..",
          "..",
          "src-tauri",
          "target",
          "release",
          "biometrics-studio.exe"
      )
    : path.resolve(
          __dirname,
          "..",
          "..",
          "src-tauri",
          "target",
          "release",
          "biometrics-studio"
      );

const tauriDriverPath = path.resolve(
    os.homedir(),
    ".cargo",
    "bin",
    `tauri-driver${exe}`
);

let driver: WebDriver | undefined;
let tauriDriver: ChildProcessByStdio<Writable, null, null> | undefined;

async function clickThroughElements(testIdList: string[]) {
    for (const testId of testIdList) {
        // oxlint-disable-next-line no-await-in-loop -- clicks must happen sequentially
        await driver?.findElement(By.css(`[data-testid='${testId}']`)).click();
    }
}

const describeIfSupported = SUPPORTED ? describe : describe.skip;

beforeAll(async () => {
    if (!SUPPORTED) return;

    spawnSync("cargo", ["build", "--release"]);

    tauriDriver = spawn(tauriDriverPath, [], {
        stdio: [null, process.stdout, process.stderr],
    });

    const capabilities = new Capabilities();
    capabilities.set("tauri:options", { application });
    capabilities.setBrowserName("wry");
    capabilities.setPageLoadStrategy("normal");

    driver = await new Builder()
        .withCapabilities(capabilities)
        .usingServer("http://127.0.0.1:4444/")
        .build();
}, 120000);

afterAll(async () => {
    if (!SUPPORTED) return;

    tauriDriver?.kill();
    const appProcesses = await find("name", `biometrics-studio${exe}`, true);
    appProcesses.forEach(({ pid }) => {
        process?.kill(pid);
    });
    if (isWindows) {
        const msedgedriverProcesses = await find(
            "name",
            "msedgedriver.exe",
            true
        );
        msedgedriverProcesses.forEach(({ pid }) => {
            process?.kill(pid);
        });
    }
});

describeIfSupported("Dark mode", () => {
    it("should switch to light color mode", async () => {
        const dashboard = await driver
            ?.findElement(By.css("[data-testid='page-container']"))
            .isDisplayed();
        expect(dashboard).toBe(true);

        await clickThroughElements([
            "settings-tab",
            "dark-mode-toggle",
            "dark-mode-toggle-item-light",
        ]);

        const htmlElement = await driver?.findElement(By.css("html"));
        const htmlClass = await htmlElement?.getAttribute("class");
        expect(htmlClass).toBe("light");
    });

    it("should switch to dark color mode", async () => {
        await clickThroughElements(["dark-mode-toggle-item-dark"]);

        const htmlElement = await driver?.findElement(By.css("html"));
        const htmlClass = await htmlElement?.getAttribute("class");
        expect(htmlClass).toBe("dark");
    });
});
