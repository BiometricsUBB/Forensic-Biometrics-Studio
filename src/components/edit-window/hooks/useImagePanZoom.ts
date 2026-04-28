import React, { useState, useCallback, RefObject } from "react";

export function useImagePanZoom(
    containerRef: RefObject<HTMLElement | null>,
    imageRef: RefObject<HTMLElement | null>,
    isEnabled: boolean = true
) {
    const [state, setState] = useState({
        zoom: 1,
        pan: { x: 0, y: 0 },
        isDragging: false,
        dragStart: { x: 0, y: 0 },
    });

    const reset = useCallback(() => {
        setState(s => ({ ...s, zoom: 1, pan: { x: 0, y: 0 } }));
    }, []);

    const handleWheel = useCallback(
        (e: React.WheelEvent<HTMLButtonElement> | WheelEvent) => {
            if (!isEnabled || !containerRef.current || !imageRef.current)
                return;
            e.preventDefault();
            const delta = (e as WheelEvent).deltaY > 0 ? 0.9 : 1.1;
            const newZoom = Math.max(0.1, Math.min(10, state.zoom * delta));
            const rect = containerRef.current.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const mouseX = (e as MouseEvent).clientX - rect.left;
            const mouseY = (e as MouseEvent).clientY - rect.top;
            const imageX = (mouseX - centerX - state.pan.x) / state.zoom;
            const imageY = (mouseY - centerY - state.pan.y) / state.zoom;

            setState(s => ({
                ...s,
                zoom: newZoom,
                pan: {
                    x: mouseX - centerX - imageX * newZoom,
                    y: mouseY - centerY - imageY * newZoom,
                },
            }));
        },
        [isEnabled, state.zoom, state.pan, containerRef, imageRef]
    );

    const handleMouseDown = useCallback(
        (
            e: React.MouseEvent<HTMLButtonElement>,
            allowedButtons: number[] = [0]
        ) => {
            if (!allowedButtons.includes(e.button)) return;
            setState(s => ({
                ...s,
                isDragging: true,
                dragStart: { x: e.clientX - s.pan.x, y: e.clientY - s.pan.y },
            }));
        },
        []
    );

    const handleMouseMove = useCallback(
        (e: React.MouseEvent<HTMLButtonElement>) => {
            if (!state.isDragging) return;
            setState(s => ({
                ...s,
                pan: {
                    x: e.clientX - s.dragStart.x,
                    y: e.clientY - s.dragStart.y,
                },
            }));
        },
        [state.isDragging]
    );

    const handleMouseUp = useCallback(() => {
        setState(s => ({ ...s, isDragging: false }));
    }, []);

    const handleMiddleDrag = useCallback((dx: number, dy: number) => {
        setState(s => ({ ...s, pan: { x: s.pan.x + dx, y: s.pan.y + dy } }));
    }, []);

    return {
        ...state,
        reset,
        setState,
        handleWheel,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleMiddleDrag,
    };
}
