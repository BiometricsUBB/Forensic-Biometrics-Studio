import { LineSegmentMarking } from "./LineSegmentMarking";
import { MARKING_CLASS } from "./MARKING_CLASS";

export class DistanceMarking extends LineSegmentMarking {
    // Używamy klasy LINE_SEGMENT, aby istniejące handlery i rendery wiedziały jak to narysować
    override readonly markingClass = MARKING_CLASS.LINE_SEGMENT;

    /**
     * Oblicza dystans w pikselach obrazu
     */
    public getDistance(): number {
        const dx = this.endpoint.x - this.origin.x;
        const dy = this.endpoint.y - this.origin.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Zwraca dystans jako sformatowany tekst
     */
    public getFormattedDistance(): string {
        return `${this.getDistance().toFixed(2)} px`;
    }
}