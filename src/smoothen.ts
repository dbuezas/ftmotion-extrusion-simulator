export function smoothen(positions: number[], s_time: number, dt: number, fs: number, order: number): number[] {
  let alpha = 0;
  let delay_samples = 0;
  alpha = 1.0 - Math.exp((-dt * order) / s_time);
  delay_samples = s_time * fs;
  if (alpha > 0) {
    const smoothing_pass = new Array(order).fill(0);
    const padCount = Math.round(delay_samples);
    const padded = [...positions, ...Array(padCount).fill(positions.at(-1)!)];
    const smoothed: number[] = [];
    for (let val of padded) {
      let smooth_val = val;
      for (let i = 0; i < smoothing_pass.length; ++i) {
        smoothing_pass[i] += (smooth_val - smoothing_pass[i]) * alpha;
        smooth_val = smoothing_pass[i];
      }
      smoothed.push(smooth_val);
    }
    return smoothed.slice(delay_samples);
  }
  return positions;
}
