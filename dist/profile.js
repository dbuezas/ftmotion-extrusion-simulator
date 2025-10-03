import { trapezoidalProfile } from './trapezoidal.js';
import { poly6Profile } from './poly6.js';
const filamentDiameter = 1.75; // mm
const filamentArea = Math.PI * Math.pow(filamentDiameter / 2, 2); // mm²
export function calculateMotionProfile(params) {
    const { trajectory, distance, rate, acceleration, accOvershoot, layerHeight, ftmFs, smoothingTime, ftmSmoothingOrder, } = params;
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
    const padLength = Math.floor(posProfile.length / 5);
    const paddedProfile = [
        ...Array(padLength).fill(posProfile.at(0)),
        ...posProfile,
        ...Array(padLength).fill(posProfile.at(-1)),
    ];
    return paddedProfile;
}
