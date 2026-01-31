import { useEffect, useRef, RefObject } from "react";
import { sampleLine, findPeaks, Point } from "./measurementUtils";

interface MeasurementLine {
  pointA: Point;
  pointB: Point;
  peaks: Point[];
}

export class ImageDpiCalibration {
  private image: HTMLImageElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pointA?: Point;
  private line?: MeasurementLine;
  private isDrawingTempLine: boolean = false;
  private mousePos?: Point;
  private targetDpi: number = 1000;

  public setTargetDpi(dpi: number) {
    this.targetDpi = dpi;
  }

  constructor(image: HTMLImageElement, canvas: HTMLCanvasElement) {
    this.image = image;
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Cannot get canvas context");
    this.ctx = ctx;
    this.setupCanvasDPI();

    this.canvas.addEventListener("pointerdown", this.handleClick);
    this.canvas.addEventListener("pointermove", this.handleMouseMove);
  }

  destroy() {
    this.canvas.removeEventListener("pointerdown", this.handleClick);
    this.canvas.removeEventListener("pointermove", this.handleMouseMove);
  }

  private setupCanvasDPI() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private drawTempLine() {
    if (!this.pointA || !this.mousePos) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = "red";
    this.ctx.beginPath();
    this.ctx.arc(this.pointA.x, this.pointA.y, 3, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = "red";
    this.ctx.lineWidth = 5;
    this.ctx.beginPath();
    this.ctx.moveTo(this.pointA.x, this.pointA.y);
    this.ctx.lineTo(this.mousePos.x, this.mousePos.y);
    this.ctx.stroke();
  }

  private handleMouseMove = (event: PointerEvent) => {
    if (!this.pointA) return;

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    this.mousePos = {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };

    this.drawTempLine();
  };

  private handleClick = (event: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const point = {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };

    this.click(point);
  };

  clear() {
    this.pointA = undefined;
    this.line = undefined;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  click(globalPoint: Point) {
    if (!this.pointA) {
      this.pointA = globalPoint;
      this.isDrawingTempLine = true;
      return;
    }

    const pointB = globalPoint;
    const aPx = this.pointA;
    const bPx = pointB;

    const imgData = this.getImageData();
    const values = sampleLine(imgData, aPx, bPx);
    const peaksIdx = findPeaks(values);

    const peaks = peaksIdx.map((idx) => ({
      x: aPx.x + ((bPx.x - aPx.x) * idx) / (values.length - 1),
      y: aPx.y + ((bPx.y - aPx.y) * idx) / (values.length - 1),
    }));

    this.line = { pointA: aPx, pointB: bPx, peaks };

    this.pointA = undefined;
    this.mousePos = undefined;
    this.isDrawingTempLine = false;

    this.drawLine();

    if (peaksIdx.length >= 2) {
      this.processPeaks(peaksIdx);
    }
  }

  private getImageData(): ImageData {
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = this.image.naturalWidth;
    tmpCanvas.height = this.image.naturalHeight;
    const tmpCtx = tmpCanvas.getContext("2d")!;
    tmpCtx.drawImage(this.image, 0, 0);
    return tmpCtx.getImageData(0, 0, tmpCanvas.width, tmpCanvas.height);
  }

  private drawLine() {
    if (!this.line) return;
    const { pointA, pointB, peaks } = this.line;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.strokeStyle = "red";
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.moveTo(pointA.x, pointA.y);
    this.ctx.lineTo(pointB.x, pointB.y);
    this.ctx.stroke();

    this.ctx.fillStyle = "yellow";
    peaks.forEach((p) => this.ctx.fillRect(p.x - 2, p.y - 2, 4, 4));
  }

  private processPeaks(peaksIdx: number[]) {
    if (peaksIdx.length < 2) return;
    const diffs: number[] = [];
    for (let i = 0; i < peaksIdx.length - 1; i++) {
      diffs.push(peaksIdx[i + 1] - peaksIdx[i]);
    }
    const pxPerMmOriginal = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const dpiOriginal = pxPerMmOriginal * 25.4;
    const scaleFactor = this.targetDpi / dpiOriginal;
    this.scaleImage(scaleFactor);
  }

  public scaleImage(scaleFactor: number) {
    if (!this.image) return;

    const canvas = document.createElement("canvas");
    canvas.width = this.image.naturalWidth * scaleFactor;
    canvas.height = this.image.naturalHeight * scaleFactor;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "low";
    ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);

    this.image.src = canvas.toDataURL("image/png");
  }
}

export function useImageDpiCalibration(
  imageRef: RefObject<HTMLImageElement>,
  canvasRef: RefObject<HTMLCanvasElement>,
) {
  const handlerRef = useRef<ImageDpiCalibration | null>(null);

  useEffect(() => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    handlerRef.current = new ImageDpiCalibration(img, canvas);
    return () => handlerRef.current?.destroy();
  }, [imageRef, canvasRef]);

  return handlerRef;
}
