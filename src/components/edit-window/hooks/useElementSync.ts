import React, { useCallback, useEffect } from "react";

export function useElementSync() {
    const syncContainedElement = useCallback(
        (
            element: HTMLElement,
            container: HTMLElement,
            naturalWidth: number,
            naturalHeight: number,
            extraStyles: Partial<CSSStyleDeclaration> = {}
        ) => {
            if (!naturalWidth || !naturalHeight) return;

            const { clientWidth, clientHeight } = container;
            if (!clientWidth || !clientHeight) return;

            const scale = Math.min(
                clientWidth / naturalWidth,
                clientHeight / naturalHeight
            );
            const width = Math.max(1, Math.round(naturalWidth * scale));
            const height = Math.max(1, Math.round(naturalHeight * scale));

            Object.assign(element.style, {
                width: `${width}px`,
                height: `${height}px`,
                position: "absolute",
                top: "50%",
                left: "50%",
                marginTop: `-${height / 2}px`,
                marginLeft: `-${width / 2}px`,
                ...extraStyles,
            });
        },
        []
    );

    return { syncContainedElement };
}

export function useSyncedElement(
    sourceRef: React.RefObject<HTMLImageElement | null>,
    targetRef: React.RefObject<HTMLElement | null>,
    containerRef: React.RefObject<HTMLElement | null>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dependencies: any[] = [],
    extraStyles: Partial<CSSStyleDeclaration> = {}
) {
    const { syncContainedElement } = useElementSync();

    useEffect(() => {
        const source = sourceRef.current;
        const target = targetRef.current;
        const container = containerRef.current;

        if (!source || !target || !container) return undefined;

        const sync = () => {
            requestAnimationFrame(() => {
                if (!source || !target || !container) return;

                // If target is a canvas, sync its internal resolution as well
                if (target instanceof HTMLCanvasElement) {
                    target.width = source.naturalWidth;
                    target.height = source.naturalHeight;
                }

                syncContainedElement(
                    target,
                    container,
                    source.naturalWidth,
                    source.naturalHeight,
                    extraStyles
                );
            });
        };

        const resizeObserver = new ResizeObserver(sync);
        resizeObserver.observe(container);

        if (source.complete) sync();
        source.addEventListener("load", sync);

        return () => {
            resizeObserver.disconnect();
            source.removeEventListener("load", sync);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [syncContainedElement, ...dependencies]);
}
