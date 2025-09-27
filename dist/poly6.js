const dt = 0.001; // 1ms steps
export class Poly6Profile {
    constructor(distance, rate, acceleration, accOvershoot) {
        this.profile = [];
        this.generateProfile(distance, rate, acceleration, accOvershoot);
    }
    generateProfile(distance, rate, acceleration, accOvershoot) {
        // Port of Marlin's Poly6TrajectoryGenerator
        const initial_speed = 0.0;
        const final_speed = 0.0;
        let nominal_speed = rate;
        // --- Trapezoid timings (unchanged) ---
        const invA = 1.0 / acceleration;
        const ldiff = distance +
            0.5 * invA * (initial_speed * initial_speed + final_speed * final_speed);
        let T2 = ldiff / nominal_speed - invA * nominal_speed;
        if (T2 < 0.0) {
            T2 = 0.0;
            nominal_speed = Math.sqrt(ldiff * acceleration);
        }
        const T1 = (nominal_speed - initial_speed) * invA;
        const T3 = (nominal_speed - final_speed) * invA;
        // Distances at phase boundaries (trapezoid areas)
        const pos_before_coast = 0.5 * (initial_speed + nominal_speed) * T1;
        const pos_after_coast = pos_before_coast + nominal_speed * T2;
        // --- Build sextic (in position) for each phase ---
        // Common mid values for K''(u)
        const Kpp_mid = 6 * 0.5 - 36 * 0.25 + 60 * 0.125 - 30 * 0.0625; // = 1.875
        // ---- Accel phase ----
        let acc_c3 = 0.0, acc_c4 = 0.0, acc_c5 = 0.0, acc_c6 = 0.0;
        {
            const Ts = T1;
            const s0 = 0.0;
            const v0 = initial_speed;
            const s1 = pos_before_coast;
            const v1 = nominal_speed;
            const delta_p = s1 - s0 - v0 * Ts;
            const delta_v = (v1 - v0) * Ts;
            // s5(u) = s0 + v0*Ts*u + c3 u^3 + c4 u^4 + c5 u^5
            acc_c3 = 10.0 * delta_p - 4.0 * delta_v;
            acc_c4 = -15.0 * delta_p + 7.0 * delta_v;
            acc_c5 = 6.0 * delta_p - 3.0 * delta_v;
            // a5_mid = s5''(0.5)/Ts^2
            const a5_mid = this.s5pp_u(acc_c3, acc_c4, acc_c5, 0.5) / (Ts * Ts);
            const a_mid_target = accOvershoot * acceleration;
            // c chosen so that (s5''(0.5)+c5*K''(0.5))/Ts^2 == a_mid_target
            acc_c6 = (Ts * Ts * (a_mid_target - a5_mid)) / Kpp_mid;
        }
        // ---- Decel phase ----
        let dec_c3 = 0.0, dec_c4 = 0.0, dec_c5 = 0.0, dec_c6 = 0.0;
        {
            const Ts = T3;
            const s0 = pos_after_coast;
            const v0 = nominal_speed;
            const s1 = pos_after_coast + 0.5 * (nominal_speed + final_speed) * T3;
            const v1 = final_speed;
            const delta_p = s1 - s0 - v0 * Ts;
            const delta_v = (v1 - v0) * Ts;
            dec_c3 = 10.0 * delta_p - 4.0 * delta_v;
            dec_c4 = -15.0 * delta_p + 7.0 * delta_v;
            dec_c5 = 6.0 * delta_p - 3.0 * delta_v;
            const a5_mid = this.s5pp_u(dec_c3, dec_c4, dec_c5, 0.5) / (Ts * Ts);
            const a_mid_target = -accOvershoot * acceleration;
            dec_c6 = (Ts * Ts * (a_mid_target - a5_mid)) / Kpp_mid;
        }
        // Generate profile points - first pass: calculate positions
        const positions = [];
        let time = 0;
        const totalTime = T1 + T2 + T3;
        while (time <= totalTime) {
            let position;
            if (time < T1) {
                // Accel phase: u = time/T1
                const u = time / T1;
                position =
                    this.s5_u(0.0, initial_speed, T1, acc_c3, acc_c4, acc_c5, u) +
                        acc_c6 * this.K_u(0.0, initial_speed, T1, u);
            }
            else if (time <= T1 + T2) {
                // Coast
                position = pos_before_coast + nominal_speed * (time - T1);
            }
            else {
                // Decel phase
                const tau = time - (T1 + T2);
                const u = tau / T3;
                position =
                    this.s5_u(pos_after_coast, nominal_speed, T3, dec_c3, dec_c4, dec_c5, u) +
                        dec_c6 * this.K_u(pos_after_coast, nominal_speed, T3, u);
            }
            positions.push(position);
            time += dt;
        }
        positions.push(positions.at(-1));
        positions.push(positions.at(-1));
        positions.push(positions.at(-1));
        // Second pass: numerically differentiate to get velocity and acceleration
        const velocities = [];
        for (let i = 0; i < positions.length; i++) {
            // Calculate velocity using backward difference: vel[i] = (pos[i] - pos[i-1]) / dt
            const velocity = i === 0 ? 0 : (positions[i] - positions[i - 1]) / dt;
            velocities.push(velocity);
        }
        // Third pass: differentiate velocity to get acceleration
        for (let i = 0; i < positions.length; i++) {
            // Calculate acceleration using backward difference: acc[i] = (vel[i] - vel[i-1]) / dt
            const acceleration_val = i === 0 ? 0 : (velocities[i] - velocities[i - 1]) / dt;
            this.profile.push({
                time: i * dt,
                position: positions[i],
                velocity: velocities[i],
                acceleration: acceleration_val,
            });
        }
    }
    // Utility functions ported from Marlin
    s5_u(s0, v0, Ts, c3, c4, c5, u) {
        const u2 = u * u, u3 = u2 * u, u4 = u3 * u, u5 = u4 * u;
        return s0 + v0 * Ts * u + c3 * u3 + c4 * u4 + c5 * u5;
    }
    s5pp_u(c3, c4, c5, u) {
        // d²/du² (c3 u³ + c4 u⁴ + c5 u⁵) = 6*c3*u + 12*c4*u² + 20*c5*u³
        return 6.0 * c3 * u + 12.0 * c4 * u * u + 20.0 * c5 * u * u * u;
    }
    K_u(s0, v0, Ts, u) {
        const um1 = 1.0 - u;
        return u * u * u * (um1 * um1 * um1);
    }
    getProfile() {
        return this.profile;
    }
}
