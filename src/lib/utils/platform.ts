import { platform } from "@tauri-apps/plugin-os";

const CURRENT_PLATFORM = platform();

export const IS_MACOS = CURRENT_PLATFORM === "macos";
export const IS_WINDOWS = CURRENT_PLATFORM === "windows";
export const IS_LINUX = CURRENT_PLATFORM === "linux";
