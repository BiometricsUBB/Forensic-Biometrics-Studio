export function redrawFftOverlay(
    spectrumCanvas: HTMLCanvasElement,
    specCanvas: HTMLCanvasElement,
    maskCanvas: HTMLCanvasElement | null
) {
    const ctx = spectrumCanvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, spectrumCanvas.width, spectrumCanvas.height);
    ctx.globalAlpha = 1.0;
    ctx.drawImage(
        specCanvas,
        0,
        0,
        spectrumCanvas.width,
        spectrumCanvas.height
    );

    if (maskCanvas) {
        ctx.drawImage(
            maskCanvas,
            0,
            0,
            spectrumCanvas.width,
            spectrumCanvas.height
        );
    }
}

export function getCanvasCoords(
    e: MouseEvent,
    canvas: HTMLCanvasElement
): { cx: number; cy: number } {
    const rect = canvas.getBoundingClientRect();
    return {
        cx: (e.clientX - rect.left) * (canvas.width / rect.width),
        cy: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
}
