export function trapezoidalProfile(distance: number, rate: number, acceleration: number, dt: number): number[] {
  const profile: number[] = [];

  // Use the same timing calculation as Marlin 6POLY
  const initial_speed = 0.0;
  const final_speed = 0.0;
  let nominal_speed = rate;

  const invA = 1.0 / acceleration;
  const ldiff = distance + 0.5 * invA * (initial_speed * initial_speed + final_speed * final_speed);

  let T2 = ldiff / nominal_speed - invA * nominal_speed;
  if (T2 < 0.0) {
    T2 = 0.0;
    nominal_speed = Math.sqrt(ldiff * acceleration);
  }

  const T1 = (nominal_speed - initial_speed) * invA;
  const T3 = (nominal_speed - final_speed) * invA;

  // Generate profile points - calculate positions
  let time = 0;
  const totalTime = T1 + T2 + T3;

  while (time <= totalTime) {
    let position: number;

    if (time < T1) {
      // Accel phase
      const t = time;
      position = initial_speed * t + 0.5 * acceleration * t * t;
    } else if (time <= T1 + T2) {
      // Coast
      const t_coast = time - T1;
      position = 0.5 * (initial_speed + nominal_speed) * T1 + nominal_speed * t_coast;
    } else {
      // Decel phase
      const t_decel = time - (T1 + T2);
      const pos_at_decel_start = 0.5 * (initial_speed + nominal_speed) * T1 + nominal_speed * T2;
      position = pos_at_decel_start + nominal_speed * t_decel - 0.5 * acceleration * t_decel * t_decel;
    }

    profile.push(position);

    time += dt;
  }

  return profile;
}
