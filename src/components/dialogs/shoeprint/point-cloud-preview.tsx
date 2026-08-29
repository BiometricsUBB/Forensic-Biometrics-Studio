import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils/shadcn";
import type { Point } from "@/lib/shoeprint/edge-extraction";

type PointCloudPreviewProps = {
    points: Point[];
    className?: string;
    width?: number;
    height?: number;
};

/**
 * Draws the extracted edge points so the examiner can confirm the threshold
 * picked out the outsole pattern before committing to a comparison that runs
 * for minutes.
 */
export function PointCloudPreview({
    points,
    className,
    width = 180,
    height = 320,
}: PointCloudPreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext("2d");
        if (!context) return;

        const ratio = window.devicePixelRatio || 1;
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.clearRect(0, 0, width, height);

        if (points.length === 0) return;

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (let i = 0; i < points.length; i += 1) {
            const point = points[i]!;
            if (point.x < minX) minX = point.x;
            if (point.x > maxX) maxX = point.x;
            if (point.y < minY) minY = point.y;
            if (point.y > maxY) maxY = point.y;
        }

        const spanX = Math.max(1, maxX - minX);
        const spanY = Math.max(1, maxY - minY);
        const scale = Math.min(width / spanX, height / spanY) * 0.94;
        const offsetX = (width - spanX * scale) / 2;
        const offsetY = (height - spanY * scale) / 2;

        context.fillStyle = "#64748b";
        for (let i = 0; i < points.length; i += 1) {
            const point = points[i]!;
            // The point cloud has a bottom-left origin; the canvas grows
            // downwards, so y is flipped back here for display.
            const x = offsetX + (point.x - minX) * scale;
            const y = height - offsetY - (point.y - minY) * scale;
            context.fillRect(x, y, 1, 1);
        }
    }, [points, width, height]);

    return (
        <canvas
            ref={canvasRef}
            style={{ width, height }}
            className={cn(
                "rounded border border-border bg-background",
                className
            )}
        />
    );
}
