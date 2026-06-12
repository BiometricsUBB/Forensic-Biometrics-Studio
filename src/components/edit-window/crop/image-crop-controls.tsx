import React, {
    RefObject,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { Crop } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ICON } from "@/lib/utils/const";

interface CropRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface ImageCropControlsProps {
    imageRef: RefObject<HTMLImageElement>;
    canvasRef: RefObject<HTMLCanvasElement>;
    active: boolean;
    onActiveChange: (active: boolean) => void;
    onApplyCrop: (rect: CropRect) => void;
}

function getCanvasPoint(canvas: HTMLCanvasElement, event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
    };
}

function normalizeRect(
    a: { x: number; y: number },
    b: { x: number; y: number }
) {
    return {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        width: Math.abs(b.x - a.x),
        height: Math.abs(b.y - a.y),
    };
}

export function ImageCropControls({
    imageRef,
    canvasRef,
    active,
    onActiveChange,
    onApplyCrop,
}: ImageCropControlsProps) {
    const { t } = useTranslation(["tooltip"]);
    const [selection, setSelection] = useState<CropRect | null>(null);
    const startRef = useRef<{ x: number; y: number } | null>(null);
    const selectionRef = useRef<CropRect | null>(null);

    const drawSelection = useCallback(
        (rect: CropRect | null) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (!rect) return;

            ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
            ctx.strokeStyle = "#22c55e";
            ctx.lineWidth = Math.max(2, canvas.width / 600);
            ctx.setLineDash([8, 6]);
            ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
            ctx.setLineDash([]);
        },
        [canvasRef]
    );

    useEffect(() => {
        selectionRef.current = selection;
        drawSelection(selection);
    }, [drawSelection, selection]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const image = imageRef.current;
        if (!canvas || !image) return undefined;

        if (!active) {
            startRef.current = null;
            setSelection(null);
            drawSelection(null);
            return undefined;
        }

        const onPointerDown = (event: PointerEvent) => {
            if (event.button !== 0) return;
            event.preventDefault();
            const point = getCanvasPoint(canvas, event);
            startRef.current = point;
            setSelection({ x: point.x, y: point.y, width: 0, height: 0 });
            canvas.setPointerCapture(event.pointerId);
        };

        const onPointerMove = (event: PointerEvent) => {
            if (!startRef.current) return;
            const point = getCanvasPoint(canvas, event);
            setSelection(normalizeRect(startRef.current, point));
        };

        const onPointerUp = (event: PointerEvent) => {
            startRef.current = null;
            if (canvas.hasPointerCapture(event.pointerId)) {
                canvas.releasePointerCapture(event.pointerId);
            }
        };

        canvas.addEventListener("pointerdown", onPointerDown);
        canvas.addEventListener("pointermove", onPointerMove);
        canvas.addEventListener("pointerup", onPointerUp);
        canvas.addEventListener("pointercancel", onPointerUp);

        return () => {
            canvas.removeEventListener("pointerdown", onPointerDown);
            canvas.removeEventListener("pointermove", onPointerMove);
            canvas.removeEventListener("pointerup", onPointerUp);
            canvas.removeEventListener("pointercancel", onPointerUp);
        };
    }, [active, canvasRef, drawSelection, imageRef]);

    const applyCrop = () => {
        const rect = selectionRef.current;
        if (!rect || rect.width < 2 || rect.height < 2) return;
        onApplyCrop({
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
        });
        onActiveChange(false);
    };

    return (
        <div className="space-y-2">
            <Button
                onClick={() => onActiveChange(!active)}
                variant={active ? "destructive" : "outline"}
                className="w-full flex items-center justify-center gap-2"
            >
                <Crop size={ICON.SIZE} />
                {active
                    ? t("Cancel crop", { ns: "tooltip" })
                    : t("Start crop", { ns: "tooltip" })}
            </Button>
            {active && (
                <>
                    <p className="text-xs text-muted-foreground">
                        {selection
                            ? t("Crop area selected", { ns: "tooltip" })
                            : t("Draw a rectangle on the image to crop it", {
                                  ns: "tooltip",
                              })}
                    </p>
                    <Button
                        onClick={applyCrop}
                        disabled={
                            !selection ||
                            selection.width < 2 ||
                            selection.height < 2
                        }
                        size="sm"
                        className="w-full"
                    >
                        {t("Apply crop", { ns: "tooltip" })}
                    </Button>
                </>
            )}
        </div>
    );
}
