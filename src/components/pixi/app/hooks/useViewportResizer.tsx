import { Viewport } from "pixi-viewport";
import { useEffect } from "react";

export const useViewportResizer = (
    viewport: Viewport | null,
    width: number,
    height: number
) => {
    useEffect(() => {
        // Resize the canvas when the user resizes the window
        if (viewport === null) return;
        viewport.resize(width, height);
    }, [width, height, viewport]);
};
