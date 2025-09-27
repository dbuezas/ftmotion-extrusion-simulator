import {
  TrapezoidalProfile,
  ProfilePoint as TrapezoidalProfilePoint,
} from './trapezoidal.js';
import { Poly6Profile, ProfilePoint as Poly6ProfilePoint } from './poly6.js';

const dt = 0.001; // 1ms steps

interface MotionParameters {
  trajectory: 'trapezoidal' | '6poly';
  distance: number; // mm
  rate: number; // mm/s
  acceleration: number; // mm/s²
  accOvershoot: number; // factor
  k: number; // linear advance
  lineWidth: number; // mm
}

interface ProfilePoint {
  time: number;
  position: number;
  velocity: number;
  acceleration: number;
}

class MotionProfile {
  private params: MotionParameters;
  private profile: ProfilePoint[] = [];

  constructor(params: MotionParameters) {
    this.params = params;
    this.calculateProfile();
  }

  private calculateProfile(): void {
    const { trajectory, distance, rate, acceleration, accOvershoot } =
      this.params;

    if (trajectory === '6poly') {
      const poly6Profile = new Poly6Profile(
        distance,
        rate,
        acceleration,
        accOvershoot
      );
      this.profile = poly6Profile.getProfile();
    } else {
      const trapezoidalProfile = new TrapezoidalProfile(
        distance,
        rate,
        acceleration
      );
      this.profile = trapezoidalProfile.getProfile();
    }
  }

  getProfile(): ProfilePoint[] {
    return this.profile;
  }
}

class MotionSimulator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private profile: MotionProfile | null = null;
  private k: number = 0.5;
  private historicMaxPosition: number = 0;
  private historicMaxVelocity: number = 0;
  private historicMaxAcceleration: number = 0;
  private previousAccOvershoot: number = 1.5;
  private currentParams: MotionParameters | null = null;

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  private resizeCanvas(): void {
    this.canvas.style.display = 'none';
    const rect = this.canvas.parentElement!.getBoundingClientRect();
    this.canvas.style.display = '';
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx.setTransform(
      window.devicePixelRatio,
      0,
      0,
      window.devicePixelRatio,
      0,
      0
    );
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    // Redraw after resize to update axes
    if (this.profile) {
      this.draw();
    }
  }

  updateProfile(params: MotionParameters): void {
    this.currentParams = params;
    this.profile = new MotionProfile(params);
    this.k = params.k;
    this.draw();
  }

  private draw(): void {
    if (!this.profile) return;

    const profile = this.profile.getProfile();
    if (profile.length === 0) return;

    this.ctx.clearRect(
      0,
      0,
      this.canvas.width / window.devicePixelRatio,
      this.canvas.height / window.devicePixelRatio
    );

    const height = this.canvas.height / window.devicePixelRatio;

    // Find max values for scaling
    const maxTime = Math.max(...profile.map((p) => p.time));

    // Calculate extruder(t) values for each plot
    const gPosition = profile.map(
      (p, i) =>
        p.position +
        (this.k * (p.position - (i == 0 ? 0 : profile[i - 1].position))) / dt
    );
    const gVelocity = profile.map(
      (p, i) =>
        p.velocity +
        (this.k * (p.velocity - (i == 0 ? 0 : profile[i - 1].velocity))) / dt
    );
    const gAcceleration = profile.map(
      (p, i) =>
        p.acceleration +
        (this.k *
          (p.acceleration - (i == 0 ? 0 : profile[i - 1].acceleration))) /
          dt
    ); // jerk not calculated, so derivative of acceleration is 0

    // Update historic max values only if overshoot didn't change
    const overshootChanged =
      this.currentParams &&
      this.currentParams.accOvershoot !== this.previousAccOvershoot;
    if (!overshootChanged) {
      // Calculate current max values including extruder(t) traces
      const positionValues = [...profile.map((p) => p.position), ...gPosition];
      this.historicMaxPosition = Math.max(...positionValues.map(Math.abs));

      const velocityValues = [...profile.map((p) => p.velocity), ...gVelocity];
      this.historicMaxVelocity = Math.max(...velocityValues.map(Math.abs));

      const accelerationValues = [
        ...profile.map((p) => Math.abs(p.acceleration) / 1000),
        ...gAcceleration.map((a) => Math.abs(a) / 1000),
      ];
      this.historicMaxAcceleration = Math.max(...accelerationValues);
    }

    // Update previous overshoot
    if (this.currentParams) {
      this.previousAccOvershoot = this.currentParams.accOvershoot;
    }

    // Use historic max values for scaling (only increases)
    const maxPosition = Math.max(this.historicMaxPosition, 1); // minimum 1 to avoid division by zero
    const maxVelocity = Math.max(this.historicMaxVelocity, 1);
    const maxAcceleration = Math.max(this.historicMaxAcceleration, 1);
    const plotHeight = (height - 40) / 3;
    // Draw position plot (top third) with both traces
    this.drawPlotWithG(
      profile,
      'position',
      gPosition,
      maxTime,
      maxPosition,
      0,
      plotHeight,
      'blue',
      'purple',
      'Position (mm)'
    );

    // Draw velocity plot (middle third) with both traces
    this.drawPlotWithG(
      profile,
      'velocity',
      gVelocity,
      maxTime,
      maxVelocity,
      plotHeight,
      plotHeight,
      'green',
      'purple',
      'Velocity (mm/s)'
    );

    // Draw acceleration plot (bottom third) with both traces
    this.drawPlotWithG(
      profile,
      'acceleration',
      gAcceleration,
      maxTime,
      maxAcceleration,
      2 * plotHeight,
      plotHeight,
      'red',
      'purple',
      'Acceleration (mm/s²)'
    );
  }

  private drawPlotWithG(
    profile: ProfilePoint[],
    property: keyof ProfilePoint,
    gValues: number[],
    maxTime: number,
    maxValue: number,
    yOffset: number,
    plotHeight: number,
    color1: string,
    color2: string,
    label: string
  ): void {
    const width = this.canvas.width / window.devicePixelRatio;

    // Calculate center line (zero) position
    const centerY = yOffset + plotHeight / 2;

    // Draw original function
    this.ctx.strokeStyle = color1;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();

    for (let i = 0; i < profile.length; i++) {
      const point = profile[i];
      const x = (point.time / maxTime) * (width - 100) + 50;
      const value =
        property === 'acceleration'
          ? Math.abs(point[property] as number) / 1000
          : (point[property] as number);
      const y = centerY - (value / maxValue) * (plotHeight / 2 - 20);

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }

    this.ctx.stroke();

    // Draw extruder(t) trace
    this.ctx.strokeStyle = color2;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();

    for (let i = 0; i < profile.length; i++) {
      const point = profile[i];
      const x = (point.time / maxTime) * (width - 100) + 50;
      const value =
        property === 'acceleration' ? gValues[i] / 1000 : gValues[i];
      const y = centerY - (value / maxValue) * (plotHeight / 2 - 20);

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }

    this.ctx.stroke();

    // Draw axes (including center line)
    this.ctx.strokeStyle = '#333';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    // Horizontal axis (time)
    this.ctx.moveTo(50, centerY);
    this.ctx.lineTo(width - 50, centerY);
    // Vertical axis (zero line)
    this.ctx.moveTo(50, yOffset + 20);
    this.ctx.lineTo(50, yOffset + plotHeight - 20);
    this.ctx.stroke();

    // Draw y-axis scale
    const numTicks = 5;
    this.ctx.strokeStyle = '#333';
    this.ctx.lineWidth = 1;
    this.ctx.fillStyle = '#333';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'right';
    for (let i = 0; i < numTicks; i++) {
      const tickValue = -maxValue + (i / (numTicks - 1)) * 2 * maxValue;
      const y = centerY - (tickValue / maxValue) * (plotHeight / 2 - 20);
      // Draw tick mark
      this.ctx.beginPath();
      this.ctx.moveTo(45, y);
      this.ctx.lineTo(55, y);
      this.ctx.stroke();
      // Draw label
      this.ctx.fillText(
        property === 'acceleration'
          ? tickValue.toFixed(1) + 'k'
          : tickValue.toFixed(1),
        40,
        y + 4
      );
    }
    this.ctx.textAlign = 'left'; // reset

    // Draw label
    this.ctx.fillStyle = color1;
    this.ctx.font = '14px Arial';
    this.ctx.fillText(label, 45, yOffset + 15);

    // Calculate max/min for display
    const originalValues = profile.map(p =>
      property === 'acceleration'
        ? Math.abs((p[property] as number)) / 1000
        : (p[property] as number)
    );
    const adjustedGValues = gValues.map(v =>
      property === 'acceleration' ? v / 1000 : v
    );
    const suffix = property === 'acceleration' ? 'k' : '';

    // Display max/min for traces at bottom right
    this.ctx.fillStyle = '#333';
    this.ctx.font = '10px Arial';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(
      `Max: ${Math.max(...originalValues).toFixed(1)}${suffix}, Min: ${Math.min(...originalValues).toFixed(1)}${suffix}`,
      width - 50,
      yOffset + plotHeight/2 + 10
    );

    this.ctx.fillText(
      `w / linear advance Max: ${Math.max(...adjustedGValues).toFixed(1)}${suffix}, Min: ${Math.min(...adjustedGValues).toFixed(1)}${suffix}`,
      width - 50,
      yOffset + plotHeight/2 + 20
    );
    this.ctx.textAlign = 'left'; // reset
  }
}

// Initialize the simulator
document.addEventListener('DOMContentLoaded', () => {
  const simulator = new MotionSimulator('motion-canvas');

  // Get control elements
  const trajectorySelect = document.getElementById(
    'trajectory'
  ) as HTMLSelectElement;
  const distanceSlider = document.getElementById(
    'distance'
  ) as HTMLInputElement;
  const rateSlider = document.getElementById('rate') as HTMLInputElement;
  const accelerationSlider = document.getElementById(
    'acceleration'
  ) as HTMLInputElement;
  const overshootSlider = document.getElementById(
    'acc-overshoot'
  ) as HTMLInputElement;
  const kSlider = document.getElementById('k-factor') as HTMLInputElement;
  const lineWidthSlider = document.getElementById('line-width') as HTMLInputElement;
  const overshootGroup = document.getElementById('overshoot-group')!;

  // Get value display elements
  const distanceValue = document.getElementById('distance-value')!;
  const rateValue = document.getElementById('rate-value')!;
  const accelerationValue = document.getElementById('acceleration-value')!;
  const overshootValue = document.getElementById('overshoot-value')!;
  const kValue = document.getElementById('k-value')!;
  const lineWidthValue = document.getElementById('line-width-value')!;

  function updateSimulator() {
    const params: MotionParameters = {
      trajectory: trajectorySelect.value as 'trapezoidal' | '6poly',
      distance: parseFloat(distanceSlider.value),
      rate: parseFloat(rateSlider.value),
      acceleration: parseFloat(accelerationSlider.value),
      accOvershoot: parseFloat(overshootSlider.value),
      k: parseFloat(kSlider.value),
      lineWidth: parseFloat(lineWidthSlider.value),
    };
    simulator.updateProfile(params);
  }

  function updateDisplays() {
    distanceValue.textContent = distanceSlider.value + ' mm';
    rateValue.textContent = rateSlider.value + ' mm/s';
    accelerationValue.textContent =
      (parseFloat(accelerationSlider.value) / 1000).toFixed(1) + ' mm/s²';
    overshootValue.textContent = overshootSlider.value;
    kValue.textContent = kSlider.value;
    lineWidthValue.textContent = lineWidthSlider.value + ' mm';
  }

  function updateTrajectoryDisplay() {
    if (trajectorySelect.value === '6poly') {
      overshootGroup.classList.remove('conditional');
    } else {
      overshootGroup.classList.add('conditional');
    }
  }

  // Add event listeners
  trajectorySelect.addEventListener('change', () => {
    updateTrajectoryDisplay();
    updateSimulator();
  });

  [
    distanceSlider,
    rateSlider,
    accelerationSlider,
    overshootSlider,
    kSlider,
    lineWidthSlider,
  ].forEach((slider) => {
    slider.addEventListener('input', () => {
      updateDisplays();
      updateSimulator();
    });
  });

  // Initial setup
  updateTrajectoryDisplay();
  updateDisplays();
  updateSimulator();

  // Initial update
  updateDisplays();
  updateSimulator();
});
