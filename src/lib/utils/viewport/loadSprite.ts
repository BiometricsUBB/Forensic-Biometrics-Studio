import * as PIXI from "pixi.js";
import { readFile } from "@tauri-apps/plugin-fs";

export async function loadSprite(data: string | Uint8Array, name?: string) {
    const imageBytes = await (async () => {
        if (typeof data === "string") {
            return readFile(data);
        }
        if (data instanceof Uint8Array) return data;

        throw new Error(
            `Sprite could not be loaded because the received data is of unknown type: ${JSON.stringify(
                data
            )}`
        );
    })();

    if (!imageBytes)
        throw new Error("Failed to receive a byte representation of a file");

    const hashBuffer = await window.crypto.subtle.digest("SHA-256", imageBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray
        .map(item => item.toString(16).padStart(2, "0"))
        .join("");

    const bitmap = await createImageBitmap(new Blob([imageBytes]));
    const sprite = new PIXI.Sprite(PIXI.Texture.from(bitmap));

    const path = typeof data === "string" ? data.split(/[\\/]/) : null;

    // @ts-expect-error custom property
    sprite.hash = hash;
    sprite.name = name ?? (path === null ? null : path.pop() ?? null);
    // @ts-expect-error custom property
    // Store the original file path, not the processed version
    sprite.path = typeof data === "string" ? data : null;
    return sprite;
}
