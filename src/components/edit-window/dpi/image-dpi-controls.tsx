import React, { RefObject, useEffect, useState } from "react";
import { Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ICON } from "@/lib/utils/const";
import { cn } from "@/lib/utils/shadcn";
import { useImageDpiCalibration } from "./ImageDpiCalibration";

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
  const handlerRef = useImageDpiCalibration(imageRef, canvasRef);

  useEffect(() => {
    const handler = handlerRef.current;
    const canvas = canvasRef.current;

    if (!handler || !canvas) return;

    canvas.style.pointerEvents = active ? "auto" : "none";

    if (!active) {
      handler.clear();
    }
  }, [active, handlerRef, canvasRef]);

 
  useEffect(() => {
    handlerRef.current?.setTargetDpi(targetDpi);
  }, [targetDpi, handlerRef]);

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
        <label className="text-sm font-medium">Target DPI</label>

        <div className="flex gap-4">
          {[500, 1000].map(dpi => (
            <label
              key={dpi}
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
                type="radio"
                name="dpi"
                className="hidden"
                checked={targetDpi === dpi}
                onChange={() => setTargetDpi(dpi as 500 | 1000)}
              />

              <span className="text-sm">{dpi} DPI</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
