import os from "os";
import path from "path";
import { ChildProcessByStdio, spawn, spawnSync } from "child_process";
import { Builder, By, Capabilities, WebDriver } from "selenium-webdriver";
import { Writable } from "stream";
import find from "find-process";

// NOTE:
// do uruchomienia testów potrzebne są zainstalowane poniższe programy:
// tauri-driver [https://beta.tauri.app/guides/test/webdriver/]
// msedgedriver (na moment pisania tego komentarza wersja 119.0.2151.58, trzeba sprawdzić jaka jest wersja webview tauri)
// https://msedgewebdriverstorage.z22.web.core.windows.net/?prefix=119.0.2151.58/
// msedgedriver.exe musi być w %PATH%

const application = path.resolve(
    __dirname,
    "..",
    "..",
    "src-tauri",
    "target",
    "release",
    "biometrics-studio.exe"
);

const tauriDriverPath = path.resolve(
    os.homedir(),
    ".cargo",
    "bin",
    "tauri-driver.exe"
);

let driver: WebDriver | undefined;
let tauriDriver: ChildProcessByStdio<Writable, null, null> | undefined;

async function clickThroughElements(testIdList: string[]) {
    for (const testId of testIdList) {
        await driver?.findElement(By.css(`[data-testid='${testId}']`)).click();
    }
}

beforeAll(async () => {
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
    // czekaj przez maks. 120 sekund na uruchomienie aplikacji
}, 120000);

afterAll(async () => {
    tauriDriver?.kill();
    const biometricsStudioProcesses = await find(
        "name",
        "biometrics-studio.exe",
        true
    );
    biometricsStudioProcesses.forEach(({ pid }) => {
        process?.kill(pid);
    });
    const msedgedriverProcesses = await find("name", "msedgedriver.exe", true);
    msedgedriverProcesses.forEach(({ pid }) => {
        process?.kill(pid);
    });
});

describe("Dark mode", () => {
    it("should swtich to light color mode", async () => {
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

    it("should swtich to dark color mode", async () => {
        await clickThroughElements(["dark-mode-toggle-item-dark"]);

        const htmlElement = await driver?.findElement(By.css("html"));
        const htmlClass = await htmlElement?.getAttribute("class");
        expect(htmlClass).toBe("dark");
    });
});
