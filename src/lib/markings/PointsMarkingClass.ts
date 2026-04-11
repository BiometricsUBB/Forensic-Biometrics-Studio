import { MarkingClass } from "@/lib/markings/MarkingClass";
import { Point } from "@/lib/markings/Point";

export abstract class PointsMarkingClass extends MarkingClass {
    public abstract points: Point[];

    public abstract clone(ids: string[]): this;

    public calculatePointsViewportPosition(
        viewportWidthRatio: number,
        viewportHeightRatio: number
    ): Point[] {
        return this.points.map(point => ({
            x: point.x * viewportWidthRatio,
            y: point.y * viewportHeightRatio,
        }));
    }
}
