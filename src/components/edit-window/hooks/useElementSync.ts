/* eslint-disable no-param-reassign */
import React, { useCallback, useEffect, useRef } from "react";

export function syncContainedElement(
    element: HTMLElement,
    container: HTMLElement,
    naturalWidth: number,
    naturalHeight: number,
    extraStyles: Partial<CSSStyleDeclaration> = {},
    syncDimensions: boolean = false
) {
    if (!naturalWidth || !naturalHeight) return;

    const { clientWidth, clientHeight } = container;
    if (!clientWidth || !clientHeight) return;

    const scale = Math.min(
        clientWidth / naturalWidth,
        clientHeight / naturalHeight
    );
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));

    if (syncDimensions && element instanceof HTMLCanvasElement) {
        if (element.width !== naturalWidth) {
            element.width = naturalWidth;
        }
        if (element.height !== naturalHeight) {
            element.height = naturalHeight;
        }
    }

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
}

export function useElementSync() {
    const syncCallback = useCallback(syncContainedElement, []);
    return { syncContainedElement: syncCallback };
}

export interface SyncedElementOptions {
    displayUrl?: string | null;
    isFftActive?: boolean;
    extraStyles?: Partial<CSSStyleDeclaration>;
    syncDimensions?: boolean;
}

export function useSyncedElement(
    sourceRef: React.RefObject<HTMLImageElement | null>,
    targetRef: React.RefObject<HTMLElement | null>,
    containerRef: React.RefObject<HTMLElement | null>,
    options: SyncedElementOptions = {}
) {
    const { displayUrl, isFftActive, extraStyles, syncDimensions } = options;
    const { syncContainedElement } = useElementSync();
    const extraStylesRef = useRef(extraStyles);
    extraStylesRef.current = extraStyles;

    useEffect(() => {
        const source = sourceRef.current;
        const target = targetRef.current;
        const container = containerRef.current;

        if (!source || !target || !container) return undefined;

        const sync = () => {
            requestAnimationFrame(() => {
                if (!source || !target || !container) return;

                syncContainedElement(
                    target,
                    container,
                    source.naturalWidth,
                    source.naturalHeight,
                    extraStylesRef.current,
                    syncDimensions
                );
            });
        };

        const resizeObserver = new ResizeObserver(sync);
        resizeObserver.observe(container);

        if (source.complete && source.naturalWidth > 0) sync();
        source.addEventListener("load", sync);

        return () => {
            resizeObserver.disconnect();
            source.removeEventListener("load", sync);
        };
    }, [
        containerRef,
        displayUrl,
        isFftActive,
        sourceRef,
        syncContainedElement,
        targetRef,
        syncDimensions,
    ]);
}
