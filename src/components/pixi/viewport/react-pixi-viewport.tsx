import { PixiComponent, useApp } from "@pixi/react";
import { IViewportOptions, Viewport } from "pixi-viewport";
import * as PIXI from "pixi.js";
import { ReactNode, forwardRef } from "react";

export type ReactPixiViewportComponentProps = {
    children: ReactNode;
    app: PIXI.Application;
    options: IViewportOptions;
    sideEffects?: (viewport: Viewport) => Viewport;
};
const ReactPixiViewportComponent = PixiComponent("Viewport", {
    create: ({
        app,
        options,
        sideEffects,
    }: ReactPixiViewportComponentProps) => {
        const events = new PIXI.EventSystem(app.renderer);
        events.domElement = app.renderer.view as HTMLCanvasElement;

        const viewport = new Viewport(options);

        if (sideEffects) {
            sideEffects(viewport);
        }

        return viewport;
    },
    willUnmount: (viewport: Viewport) => {
        viewport.options.noTicker = true;
        viewport.destroy({ children: true });
    },
});

export type ReactPixiViewportProps = Omit<
    ReactPixiViewportComponentProps,
    "app"
>;
export const ReactPixiViewport = forwardRef<Viewport, ReactPixiViewportProps>(
    ({ ...props }: ReactPixiViewportProps, ref) => {
        const app = useApp();

        return <ReactPixiViewportComponent ref={ref} app={app} {...props} />;
    }
);
