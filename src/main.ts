interface MotionParameters {
  distance: number; // mm
  rate: number; // mm/s
  acceleration: number; // mm/s²
  accOvershoot: number; // factor
  k: number; // factor for g(t) calculation
}

interface ProfilePoint {
  time: number;
  position: number;
  velocity: number;
  acceleration: number;
}
const dt = 0.001; // 1ms steps

class TrapezoidalProfile {
  private params: MotionParameters;
  private profile: ProfilePoint[] = [];

  constructor(params: MotionParameters) {
    this.params = params;
    this.calculateProfile();
  }

  private calculateProfile(): void {
    const { distance, rate, acceleration } = this.params;

    // Calculate times for each phase
    const t_accel = rate / acceleration; // time to reach max velocity
    const d_accel = 0.5 * acceleration * t_accel * t_accel; // distance during acceleration
    const d_decel = d_accel; // distance during deceleration (same as acceleration)
    const d_constant = distance - d_accel - d_decel; // distance at constant velocity

    if (d_constant < 0) {
      // Triangle profile - not enough distance for constant velocity phase
      const t_total = Math.sqrt(2 * distance / acceleration);
      const t_accel_total = t_total / 2;
      const v_max = acceleration * t_accel_total;

      this.generateTriangleProfile(t_accel_total, v_max, acceleration);
    } else {
      // Trapezoidal profile
      const t_constant = d_constant / rate;
      const t_decel = t_accel; // same time as acceleration
      const t_total = t_accel + t_constant + t_decel;

      this.generateTrapezoidalProfile(t_accel, t_constant, t_decel, rate, acceleration);
    }
  }

  private generateTriangleProfile(t_accel: number, v_max: number, accel: number): void {
    let time = 0;

    // Acceleration phase
    while (time <= t_accel) {
      const velocity = accel * time;
      const position = 0.5 * accel * time * time;
      this.profile.push({
        time,
        position,
        velocity,
        acceleration: accel
      });
      time += dt;
    }

    // Deceleration phase
    while (time <= 2 * t_accel) {
      const velocity = v_max - accel * (time - t_accel);
      const position = 0.5 * accel * t_accel * t_accel + v_max * (time - t_accel) - 0.5 * accel * (time - t_accel) * (time - t_accel);
      this.profile.push({
        time,
        position,
        velocity,
        acceleration: -accel
      });
      time += dt;
    }
  }

  private generateTrapezoidalProfile(t_accel: number, t_constant: number, t_decel: number, v_max: number, accel: number): void {
    let time = 0;

    // Acceleration phase
    while (time <= t_accel) {
      const velocity = accel * time;
      const position = 0.5 * accel * time * time;
      this.profile.push({
        time,
        position,
        velocity,
        acceleration: accel
      });
      time += dt;
    }

    // Constant velocity phase
    const accel_end_time = t_accel;
    const constant_end_time = t_accel + t_constant;
    while (time <= constant_end_time) {
      const position = 0.5 * accel * t_accel * t_accel + v_max * (time - t_accel);
      this.profile.push({
        time,
        position,
        velocity: v_max,
        acceleration: 0
      });
      time += dt;
    }

    // Deceleration phase (using same acceleration magnitude)
    while (time <= t_accel + t_constant + t_decel) {
      const time_in_decel = time - constant_end_time;
      const velocity = v_max - accel * time_in_decel;
      const position = 0.5 * accel * t_accel * t_accel + v_max * t_constant + v_max * time_in_decel - 0.5 * accel * time_in_decel * time_in_decel;
      this.profile.push({
        time,
        position,
        velocity,
        acceleration: -accel
      });
      time += dt;
    }
  }

  getProfile(): ProfilePoint[] {
    return this.profile;
  }
}

class MotionSimulator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private profile: TrapezoidalProfile | null = null;
  private k: number = 0.5;

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  private resizeCanvas(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
  }

  updateProfile(params: MotionParameters): void {
    this.profile = new TrapezoidalProfile(params);
    this.k = params.k;
    this.draw();
  }

  private draw(): void {
    if (!this.profile) return;

    const profile = this.profile.getProfile();
    if (profile.length === 0) return;

    this.ctx.clearRect(0, 0, this.canvas.width / window.devicePixelRatio, this.canvas.height / window.devicePixelRatio);

    const width = this.canvas.width / window.devicePixelRatio;
    const height = this.canvas.height / window.devicePixelRatio;

    // Find max values for scaling
    const maxTime = Math.max(...profile.map(p => p.time));
    const maxPosition = Math.max(...profile.map(p => p.position));
    const maxVelocity = Math.max(...profile.map(p => p.velocity));
    const maxAcceleration = Math.max(...profile.map(p => Math.abs(p.acceleration)));

    // Calculate g(t) values for each plot
    const gPosition = profile.map((p, i) => p.position + this.k * (p.position-profile[i-1].position)/dt);
    const gVelocity = profile.map((p, i) => p.velocity + this.k * (p.velocity-profile[i-1].velocity)/dt);
    const gAcceleration = profile.map((p, i) => p.acceleration + this.k * (p.acceleration-profile[i-1].acceleration)/dt); // jerk not calculated, so derivative of acceleration is 0

    // Update max values to include g(t) traces
    const maxPositionWithG = Math.max(maxPosition, Math.max(...gPosition.map(Math.abs)));
    const maxVelocityWithG = Math.max(maxVelocity, Math.max(...gVelocity.map(Math.abs)));
    const maxAccelerationWithG = Math.max(maxAcceleration, Math.max(...gAcceleration.map(Math.abs)));

    // Draw position plot (top third) with both traces
    this.drawPlotWithG(profile, 'position', gPosition, maxTime, maxPositionWithG, 0, height / 3, 'blue', 'purple', 'Position (mm)');

    // Draw velocity plot (middle third) with both traces
    this.drawPlotWithG(profile, 'velocity', gVelocity, maxTime, maxVelocityWithG, height / 3, height / 3, 'green', 'purple', 'Velocity (mm/s)');

    // Draw acceleration plot (bottom third) with both traces
    this.drawPlotWithG(profile, 'acceleration', gAcceleration, maxTime, maxAccelerationWithG, 2 * height / 3, height / 3, 'red', 'purple', 'Acceleration (mm/s²)');
  }

  private drawPlotWithG(profile: ProfilePoint[], property: keyof ProfilePoint, gValues: number[], maxTime: number, maxValue: number, yOffset: number, plotHeight: number, color1: string, color2: string, label: string): void {
    const width = this.canvas.width / window.devicePixelRatio;
    const height = this.canvas.height / window.devicePixelRatio;

    // Draw original function
    this.ctx.strokeStyle = color1;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();

    for (let i = 0; i < profile.length; i++) {
      const point = profile[i];
      const x = (point.time / maxTime) * (width - 100) + 50;
      const value = property === 'acceleration' ? Math.abs(point[property] as number) : point[property] as number;
      const y = yOffset + plotHeight - (value / maxValue) * (plotHeight - 40) - 20;

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }

    this.ctx.stroke();

    // Draw g(t) trace
    this.ctx.strokeStyle = color2;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();

    for (let i = 0; i < profile.length; i++) {
      const point = profile[i];
      const x = (point.time / maxTime) * (width - 100) + 50;
      const value = Math.abs(gValues[i]);
      const y = yOffset + plotHeight - (value / maxValue) * (plotHeight - 40) - 20;

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }

    this.ctx.stroke();

    // Draw axes
    this.ctx.strokeStyle = '#333';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(50, yOffset + plotHeight - 20);
    this.ctx.lineTo(width - 50, yOffset + plotHeight - 20);
    this.ctx.moveTo(50, yOffset + 20);
    this.ctx.lineTo(50, yOffset + plotHeight - 20);
    this.ctx.stroke();

    // Draw label
    this.ctx.fillStyle = color1;
    this.ctx.font = '14px Arial';
    this.ctx.fillText(label, 10, yOffset + 30);
  }
}

// Initialize the simulator
document.addEventListener('DOMContentLoaded', () => {
  const simulator = new MotionSimulator('motion-canvas');

  // Get slider elements
  const distanceSlider = document.getElementById('distance') as HTMLInputElement;
  const rateSlider = document.getElementById('rate') as HTMLInputElement;
  const accelerationSlider = document.getElementById('acceleration') as HTMLInputElement;
  const overshootSlider = document.getElementById('acc-overshoot') as HTMLInputElement;
  const kSlider = document.getElementById('k-factor') as HTMLInputElement;

  // Get value display elements
  const distanceValue = document.getElementById('distance-value')!;
  const rateValue = document.getElementById('rate-value')!;
  const accelerationValue = document.getElementById('acceleration-value')!;
  const overshootValue = document.getElementById('overshoot-value')!;
  const kValue = document.getElementById('k-value')!;

  function updateSimulator() {
    const params: MotionParameters = {
      distance: parseFloat(distanceSlider.value),
      rate: parseFloat(rateSlider.value),
      acceleration: parseFloat(accelerationSlider.value),
      accOvershoot: parseFloat(overshootSlider.value),
      k: parseFloat(kSlider.value)
    };
    simulator.updateProfile(params);
  }

  function updateDisplays() {
    distanceValue.textContent = distanceSlider.value + ' mm';
    rateValue.textContent = rateSlider.value + ' mm/s';
    accelerationValue.textContent = accelerationSlider.value + ' mm/s²';
    overshootValue.textContent = overshootSlider.value;
    kValue.textContent = kSlider.value;
  }

  // Add event listeners
  [distanceSlider, rateSlider, accelerationSlider, overshootSlider, kSlider].forEach(slider => {
    slider.addEventListener('input', () => {
      updateDisplays();
      updateSimulator();
    });
  });

  // Initial update
  updateDisplays();
  updateSimulator();
});
