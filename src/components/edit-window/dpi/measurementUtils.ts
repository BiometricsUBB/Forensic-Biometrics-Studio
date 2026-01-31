export interface Point {
  x: number;
  y: number;
}

export function sampleLine(imgData: ImageData, a: Point, b: Point): number[] {
  const values: number[] = [];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));

  for (let i = 0; i <= steps; i++) {
    const x = Math.round(a.x + (dx * i) / steps);
    const y = Math.round(a.y + (dy * i) / steps);
    const idx = (y * imgData.width + x) * 4;

    const r = imgData.data[idx];
    const g = imgData.data[idx + 1];
    const b = imgData.data[idx + 2];

    values.push((r + g + b) / 3);
  }

  return values;
}

export function findPeaks(values: number[], minDistance = 5): number[] {
  const peaks: number[] = [];
  if (values.length < 3) return peaks;

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);

  const threshold = mean - stddev * 0.7;

  let inPeak = false;
  let peakMinIdx = 0;
  let peakMinVal = 255;

  for (let i = 0; i < values.length; i++) {
    const v = values[i];

    if (v < threshold) {
      if (!inPeak) {
        inPeak = true;
        peakMinIdx = i;
        peakMinVal = v;
      } else if (v < peakMinVal) {
        peakMinVal = v;
        peakMinIdx = i;
      }
    } else if (inPeak) {
      inPeak = false;
      if (peaks.length === 0 || peakMinIdx - peaks[peaks.length - 1] >= minDistance) {
        peaks.push(peakMinIdx);
      }
    }
  }

  if (inPeak && (peaks.length === 0 || peakMinIdx - peaks[peaks.length - 1] >= minDistance)) {
    peaks.push(peakMinIdx);
  }

  return peaks;
}
