import React, { RefObject, useEffect, useRef, useState } from "react";
import { Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ICON } from "@/lib/utils/const";
import { cn } from "@/lib/utils/shadcn";
import { ImageDpiCalibration } from "./imageDpiCalibration";

interface ImageDpiControlsProps {
    imageRef: RefObject<HTMLImageElement>;
    canvasRef: RefObject<HTMLCanvasElement>;
}

export default function ImageDpiControls({
    imageRef,
    canvasRef,
}: ImageDpiControlsProps) {
    const [active, setActive] = useState(false);
    const [targetDpi, setTargetDpi] = useState<500 | 1000>(1000);
    const handlerRef = useRef<ImageDpiCalibration | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const img = imageRef.current;

        if (!canvas) return;

        if (active && img) {
            if (!handlerRef.current) {
                handlerRef.current = new ImageDpiCalibration(img, canvas);
            }
            handlerRef.current.setTargetDpi(targetDpi);
            canvas.style.pointerEvents = "auto";
        } else {
            canvas.style.pointerEvents = "none";
            handlerRef.current?.clear();
        }
    }, [active, targetDpi, canvasRef, imageRef]);

    useEffect(() => {
        return () => {
            handlerRef.current?.destroy();
            handlerRef.current = null;
        };
    }, []);

    return (
        <div className="space-y-3 w-full max-w-md">
            <Button
                onClick={() => setActive(prev => !prev)}
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
        </div>
    );
}
