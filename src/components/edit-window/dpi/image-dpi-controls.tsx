import React, { RefObject, useEffect, useRef, useState } from "react";
import { Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ICON } from "@/lib/utils/const";
import { cn } from "@/lib/utils/shadcn";
import { ImageDpiCalibration } from "./imageDpiCalibration";

interface ImageDpiControlsProps {
    imageRef: RefObject<HTMLImageElement>;
    canvasRef: RefObject<HTMLCanvasElement>;
    active: boolean;
    onActiveChange: (active: boolean) => void;
    onScaleComputed: (scaleFactor: number) => void;
}

export default function ImageDpiControls({
    imageRef,
    canvasRef,
    active,
    onActiveChange,
    onScaleComputed,
}: ImageDpiControlsProps) {
    const [targetDpi, setTargetDpi] = useState<500 | 1000>(1000);
    const [referenceMm, setReferenceMm] = useState(10);
    const handlerRef = useRef<ImageDpiCalibration | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const img = imageRef.current;

        if (!canvas) return;

        if (active && img) {
            if (!handlerRef.current) {
                handlerRef.current = new ImageDpiCalibration(img, canvas, {
                    referenceMm,
                    onScaleComputed,
                });
            }
            handlerRef.current.setTargetDpi(targetDpi);
            handlerRef.current.setReferenceMm(referenceMm);
            handlerRef.current.setOnScaleComputed(onScaleComputed);
        } else {
            handlerRef.current?.clear();
            handlerRef.current?.destroy();
            handlerRef.current = null;
        }
    }, [active, targetDpi, referenceMm, canvasRef, imageRef, onScaleComputed]);

    useEffect(() => {
        return () => {
            handlerRef.current?.destroy();
            handlerRef.current = null;
        };
    }, []);

    return (
        <div className="space-y-3 w-full max-w-md">
            <Button
                onClick={() => onActiveChange(!active)}
                variant={active ? "destructive" : "default"}
                className="flex items-center justify-center gap-2"
            >
                <Ruler size={ICON.SIZE} />
                DPI
            </Button>

            <div className="space-y-2">
                <span className="text-sm font-medium">Target DPI</span>

                <div className="flex gap-4">
                    {([500, 1000] as const).map(dpi => (
                        <label
                            key={dpi}
                            htmlFor={`dpi-radio-${dpi}`}
                            className={cn(
                                "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 transition",
                                targetDpi === dpi
                                    ? "border-primary bg-primary/10"
                                    : "border-border hover:bg-muted"
                            )}
                        >
                            <span
                                className={cn(
                                    "flex h-4 w-4 items-center justify-center rounded-full border",
                                    targetDpi === dpi
                                        ? "border-primary"
                                        : "border-muted-foreground"
                                )}
                            >
                                {targetDpi === dpi && (
                                    <span className="h-2 w-2 rounded-full bg-primary" />
                                )}
                            </span>

                            <input
                                id={`dpi-radio-${dpi}`}
                                type="radio"
                                name="dpi"
                                className="hidden"
                                checked={targetDpi === dpi}
                                onChange={() => setTargetDpi(dpi)}
                            />

                            <span className="text-sm">{dpi} DPI</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="space-y-1">
                <span className="block text-sm font-medium">
                    Reference length (mm)
                </span>
                <input
                    type="number"
                    min={1}
                    step={1}
                    value={referenceMm}
                    aria-label="Reference length in millimeters"
                    onChange={event => {
                        const value = Number(event.target.value);
                        if (Number.isFinite(value) && value > 0) {
                            setReferenceMm(value);
                        }
                    }}
                    className="h-9 w-full rounded-md border border-border/40 bg-background px-2 text-sm"
                />
                <p className="text-xs text-muted-foreground">
                    Used when tick detection on the ruler is ambiguous.
                </p>
            </div>
        </div>
    );
}
