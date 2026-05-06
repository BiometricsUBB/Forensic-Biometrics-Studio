import { LineSegmentMarking } from "./LineSegmentMarking";
import { MARKING_CLASS } from "./MARKING_CLASS";

export class DistanceMarking extends LineSegmentMarking {
    // Reuse the LINE_SEGMENT class so existing handlers and renderers can draw it
    override readonly markingClass = MARKING_CLASS.LINE_SEGMENT;

    /** Distance in image pixels. */
    public getDistance(): number {
        const dx = this.endpoint.x - this.origin.x;
        const dy = this.endpoint.y - this.origin.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /** Distance formatted as a human-readable string. */
    public getFormattedDistance(): string {
        return `${this.getDistance().toFixed(2)} px`;
    }
}
