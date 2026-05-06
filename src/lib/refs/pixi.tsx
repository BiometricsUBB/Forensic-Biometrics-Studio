import { Viewport } from "pixi-viewport";
import { Application, ICanvas } from "pixi.js";

export type CanvasRef = {
    app: Application<ICanvas> | null;
    viewport: Viewport | null;
};

export type GlobalCanvasRefs = {
    leftCanvas: CanvasRef;
    rightCanvas: CanvasRef;
};

// Global object holding canvas references so they're accessible across the project.
// In React components, prefer the useGlobalApp() and useGlobalViewport() hooks —
// they return the same references and trigger re-renders on change.
//
// app — the pixi.js instance that handles all 2D graphics for the canvas.
// viewport — the pixi-viewport instance, the area that loads forensic-trace
//   images, mounted as a child of app.
export const CANVAS_REFS: GlobalCanvasRefs = {
    leftCanvas: {
        app: null as Application<ICanvas> | null,
        viewport: null as Viewport | null,
    },
    rightCanvas: {
        app: null as Application<ICanvas> | null,
        viewport: null as Viewport | null,
    },
};
