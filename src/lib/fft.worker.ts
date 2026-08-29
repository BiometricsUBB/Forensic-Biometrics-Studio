import { ImageFFT } from "./fftProcessor";

export type FftWorkerRequest =
    | {
          id: number;
          type: "FORWARD";
          pixels: Uint8ClampedArray;
          width: number;
          height: number;
          fftW: number;
          fftH: number;
      }
    | {
          id: number;
          type: "INVERSE";
          complexData: Float32Array;
          maskData: Uint8ClampedArray;
          maskWidth: number;
          maskHeight: number;
          fftW: number;
          fftH: number;
          outputW: number;
          outputH: number;
      };

export type FftWorkerResponse =
    | {
          id: number;
          type: "FORWARD_SUCCESS";
          complexData: Float32Array;
          width: number;
          height: number;
          spectrum: Uint8Array;
      }
    | {
          id: number;
          type: "INVERSE_SUCCESS";
          pixelData: Uint8ClampedArray;
          outputW: number;
          outputH: number;
      }
    | {
          id: number;
          type: "ERROR";
          error: string;
      };

declare const self: {
    onmessage: ((e: MessageEvent<FftWorkerRequest>) => void) | null;
    postMessage(
        message: FftWorkerResponse,
        transfer?: (ArrayBuffer | MessagePort)[]
    ): void;
};

self.onmessage = (e: MessageEvent<FftWorkerRequest>) => {
    const msg = e.data;
    try {
        if (msg.type === "FORWARD") {
            const processor = new ImageFFT(msg.fftW, msg.fftH);
            const result = processor.forward({
                data: msg.pixels,
                width: msg.width,
                height: msg.height,
            });

            const { complexData, spectrum, width, height } = result;

            self.postMessage(
                {
                    id: msg.id,
                    type: "FORWARD_SUCCESS",
                    complexData,
                    width,
                    height,
                    spectrum,
                },
                [
                    complexData.buffer as ArrayBuffer,
                    spectrum.buffer as ArrayBuffer,
                ]
            );
        } else if (msg.type === "INVERSE") {
            const processor = new ImageFFT(msg.fftW, msg.fftH);
            const filteredData = processor.applyMask(
                msg.complexData,
                msg.maskData,
                msg.maskWidth,
                msg.maskHeight
            );
            const pixelData = processor.inverseRaw(
                filteredData,
                msg.outputW,
                msg.outputH
            );

            self.postMessage(
                {
                    id: msg.id,
                    type: "INVERSE_SUCCESS",
                    pixelData,
                    outputW: msg.outputW,
                    outputH: msg.outputH,
                },
                [pixelData.buffer as ArrayBuffer]
            );
        }
    } catch (err) {
        self.postMessage({
            id: msg.id,
            type: "ERROR",
            error: err instanceof Error ? err.message : String(err),
        });
    }
};
