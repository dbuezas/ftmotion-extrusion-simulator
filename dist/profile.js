import { trapezoidalProfile } from './trapezoidal.js';
import { poly6Profile } from './poly6.js';
const filamentDiameter = 1.75; // mm
const filamentArea = Math.PI * Math.pow(filamentDiameter / 2, 2); // mm²
const FTM_SMOOTHING_ORDER = 5;
const derivate = (arr, dt) => arr.map((p, i) => (i === 0 ? 0 : (p - arr[i - 1]) / dt));
function smoothen(positions, s_time, ts, fs, order) {
    let alpha = 0;
    let delay_samples = 0;
    if (s_time > 0.001) {
        alpha = 1.0 - Math.exp((-ts * order) / s_time);
        delay_samples = s_time * fs;
    }
    if (alpha > 0) {
        const smoothing_pass = new Array(order).fill(0);
        const padCount = Math.ceil(delay_samples * 2);
        const padded = [...positions, ...Array(padCount).fill(positions.at(-1))];
        const smoothed = [];
        for (let val of padded) {
            let smooth_val = val;
            for (let i = 0; i < smoothing_pass.length; ++i) {
                smoothing_pass[i] += (smooth_val - smoothing_pass[i]) * alpha;
                smooth_val = smoothing_pass[i];
            }
            smoothed.push(smooth_val);
        }
        return smoothed;
    }
    return positions;
}
export function calculateMotionProfile(params) {
    const { trajectory, distance, rate, acceleration, accOvershoot, layerHeight, ftmFs, smoothingTime } = params;
    const dt = 1 / ftmFs;
    let posProfile;
    if (trajectory === '6poly') {
        posProfile = poly6Profile(distance, rate, acceleration, accOvershoot, dt);
    }
    else {
        posProfile = trapezoidalProfile(distance, rate, acceleration, dt);
    }
    const mmFilamentPerMmTravel = (params.lineWidth * layerHeight) / filamentArea;
    posProfile = posProfile.map((p) => p * mmFilamentPerMmTravel);
    const pos = smoothen(posProfile, smoothingTime, dt, ftmFs, FTM_SMOOTHING_ORDER);
    const vel = derivate(pos, dt);
    const acc = derivate(vel, dt);
    return { pos, vel, acc };
}
