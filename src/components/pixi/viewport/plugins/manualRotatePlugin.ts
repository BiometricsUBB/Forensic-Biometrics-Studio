import { Plugin, Viewport } from "pixi-viewport";
import { FederatedPointerEvent, Sprite } from "pixi.js";
import { applyRotationDelta } from "@/lib/utils/viewport/applyRotation";
import { CANVAS_ID } from "../../canvas/hooks/useCanvasContext";

let rotateKeyDown = false;

export const isManualRotateKeyDown = () => rotateKeyDown;

export class ManualRotatePlugin extends Plugin {
    private viewport: Viewport;

    private canvasId: CANVAS_ID;

    private lastAngle: number | null = null;

    private isHovered = false;

    constructor(viewport: Viewport, canvasId: CANVAS_ID) {
        super(viewport);
        this.viewport = viewport;
        this.canvasId = canvasId;

        document.addEventListener("keydown", this.handleKeyDown);
        document.addEventListener("keyup", this.handleKeyUp);
        this.viewport.on("pointerenter", this.handlePointerEnter);
        this.viewport.on("pointerleave", this.handlePointerLeave);
        this.viewport.on("globalmousemove", this.handleMouseMove);
    }

    public override destroy(): void {
        super.destroy();
        document.removeEventListener("keydown", this.handleKeyDown);
        document.removeEventListener("keyup", this.handleKeyUp);
        this.viewport.off("pointerenter", this.handlePointerEnter);
        this.viewport.off("pointerleave", this.handlePointerLeave);
        this.viewport.off("globalmousemove", this.handleMouseMove);
    }

    private handlePointerEnter = (): void => {
        this.isHovered = true;
    };

    private handlePointerLeave = (): void => {
        this.isHovered = false;
    };

    private handleKeyDown = (e: KeyboardEvent): void => {
        if ((e.key === "r" || e.key === "R") && !e.repeat) {
            rotateKeyDown = true;
            this.lastAngle = null;
        }
    };

    private handleKeyUp = (e: KeyboardEvent): void => {
        if (e.key === "r" || e.key === "R") {
            rotateKeyDown = false;
            this.lastAngle = null;
        }
    };

    private getScreenCenter(): { x: number; y: number } {
        const sprite = this.viewport.children.find(x => x instanceof Sprite) as
            | Sprite
            | undefined;
        if (!sprite) {
            return {
                x: this.viewport.screenWidth / 2,
                y: this.viewport.screenHeight / 2,
            };
        }
        const worldCenter = this.viewport.toWorld(
            this.viewport.screenWidth / 2,
            this.viewport.screenHeight / 2
        );
        const screenPos = this.viewport.toScreen(worldCenter.x, worldCenter.y);
        return { x: screenPos.x, y: screenPos.y };
    }

    private handleMouseMove = (e: FederatedPointerEvent): void => {
        if (!rotateKeyDown || !this.isHovered) return;

        const center = this.getScreenCenter();
        const currentAngle = Math.atan2(
            e.screenY - center.y,
            e.screenX - center.x
        );

        if (this.lastAngle === null) {
            this.lastAngle = currentAngle;
            return;
        }

        let delta = currentAngle - this.lastAngle;
        if (delta > Math.PI) delta -= 2 * Math.PI;
        if (delta < -Math.PI) delta += 2 * Math.PI;

        this.lastAngle = currentAngle;
        applyRotationDelta(this.canvasId, delta);
    };
}
