/* eslint-disable no-shadow */
export const IS_DEV_ENVIRONMENT = import.meta.env.MODE === "development";

export const ICON = {
    SIZE: 20,
    STROKE_WIDTH: 2,
} as const;

/** https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button */
export const enum MOUSE_BUTTON {
    PRIMARY = 0,
    AUXILIARY = 1,
    SECONDARY = 2,
    BACK = 3,
    FORWARD = 4,
}

/** https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/buttons */
export const enum MOUSE_BUTTONS {
    NONE = 0,
    PRIMARY = 1,
    SECONDARY = 2,
    AUXILIARY = 4,
    BACK = 8,
    FORWARD = 16,
}

/** https://davidfig.github.io/pixi-viewport/jsdoc/ */
export const enum PIXI_VIEWPORT_EVENTS {
    BOUNCE_X_END = "bounce-x-end",
    BOUNCE_X_START = "bounce-x-start",
    BOUNCE_Y_END = "bounce-y-end",
    BOUNCE_Y_START = "bounce-y-start",
    CLICKED = "clicked",
    DRAG_END = "drag-end",
    DRAG_START = "drag-start",
    FRAME_END = "frame-end",
    MOUSE_EDGE_END = "mouse-edge-end",
    MOUSE_EDGE_START = "mouse-edge-start",
    MOVED = "moved",
    MOVED_END = "moved-end",
    PINCH_END = "pinch-end",
    PINCH_START = "pinch-start",
    SNAP_END = "snap-end",
    SNAP_START = "snap-start",
    SNAP_ZOOM_END = "snap-zoom-end",
    SNAP_ZOOM_START = "snap-zoom-start",
    WHEEL = "wheel",
    WHEEL_SCROLL = "wheel-scroll",
    ZOOMED = "zoomed",
    ZOOMED_END = "zoomed-end",
}

export const enum CUSTOM_VIEWPORT_EVENTS {
    OPPOSITE_MOVED = "opposite-moved",
}

export const enum CUSTOM_GLOBAL_EVENTS {
    INTERRUPT_MARKING = "interrupt-marking",
    CLEANUP = "cleanup",
}
