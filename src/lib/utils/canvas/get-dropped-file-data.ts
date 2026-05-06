import { DragEvent } from "react";

export const getDroppedFileData = async (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer) throw new Error("Received unexpected event data");
    const { items } = event.dataTransfer;

    if (items) {
        const fileDataArray = [];

        for (const item of items) {
            if (item.kind !== "file")
                throw new Error(
                    `Received object is not a file but ${item.kind}`
                );
            if (!item.type.startsWith("image/"))
                throw new Error("Received file is not an image");

            const file = item.getAsFile();
            if (!file) throw new Error("This object is not a file");

            const dataArrayPromise = file
                .arrayBuffer()
                .then(e => new Uint8Array(e));
            fileDataArray.push(dataArrayPromise);
        }

        return Promise.all(fileDataArray);
    }

    const { files } = event.dataTransfer;
    if (!files) throw new Error("Received object is not a file");

    const fileDataArray = [];

    for (const file of files) {
        const dataArrayPromise = file
            .arrayBuffer()
            .then(e => new Uint8Array(e));
        fileDataArray.push(dataArrayPromise);
    }

    return Promise.all(fileDataArray);
};
