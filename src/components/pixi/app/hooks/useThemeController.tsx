import { Application, ICanvas } from "pixi.js";
import { useEffect } from "react";
import { useColors } from "./useColors";

export const useThemeController = (app: Application<ICanvas>) => {
    const colors = useColors();

    useEffect(() => {
        // Update the canvas background when the user changes the theme
        app.renderer.background.color = colors.background;
    }, [app.renderer.background, colors.background]);

    return colors;
};
