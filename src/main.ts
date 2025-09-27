import {
  TrapezoidalProfile,
  ProfilePoint as TrapezoidalProfilePoint,
} from './trapezoidal.js';
import { Poly6Profile, ProfilePoint as Poly6ProfilePoint } from './poly6.js';

const layerHeight = 0.2; // mm
const filamentDiameter = 1.75; // mm
const filamentArea = Math.PI * Math.pow(filamentDiameter / 2, 2); // mm²

const FTM_SMOOTHING_ORDER = 5;

class AxisSmoothing {
  alpha: number = 0;
  delay_samples: number = 0;
  smoothing_pass: number[] = [];

  constructor(order: number) {
    this.smoothing_pass = new Array(order).fill(0);
  }

  set_smoothing_time(s_time: number, ts: number, fs: number, order: number) {
    if (s_time > 0.001) {
      this.alpha = 1.0 - Math.exp(-ts * order / s_time);
      this.delay_samples = s_time * fs;
    } else {
      this.alpha = 0;
      this.delay_samples = 0;
    }
  }
}

function smoothen(value: number, smoothing: AxisSmoothing): number {
  if (smoothing.alpha > 0) {
    let smooth_val = value;
    for (let i = 0; i < smoothing.smoothing_pass.length; ++i) {
      smoothing.smoothing_pass[i] += (smooth_val - smoothing.smoothing_pass[i]) * smoothing.alpha;
      smooth_val = smoothing.smoothing_pass[i];
    }
    return smooth_val;
  }
  return value;
}

interface MotionParameters {
  trajectory: 'trapezoidal' | '6poly';
  distance: number; // mm
  rate: number; // mm/s
  acceleration: number; // mm/s²
  accOvershoot: number; // factor
  k: number; // linear advance
  lineWidth: number; // mm
  ftmFs: number; // Hz
  smoothingTime: number; // s
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
    const { trajectory, distance, rate, acceleration, accOvershoot, ftmFs, smoothingTime } =
      this.params;
    const dt = 1 / ftmFs;

    if (trajectory === '6poly') {
      const poly6Profile = new Poly6Profile(
        distance,
        rate,
        acceleration,
        accOvershoot,
        dt
      );
      this.profile = poly6Profile.getProfile();
    } else {
      const trapezoidalProfile = new TrapezoidalProfile(
        distance,
        rate,
        acceleration,
        dt
      );
      this.profile = trapezoidalProfile.getProfile();
    }

    // Apply axis smoothing if smoothingTime > 0
    if (smoothingTime > 0) {
      const smoothing = new AxisSmoothing(FTM_SMOOTHING_ORDER);
      smoothing.set_smoothing_time(smoothingTime, dt, ftmFs, FTM_SMOOTHING_ORDER);

      for (let i = 0; i < this.profile.length; i++) {
        this.profile[i].position = smoothen(this.profile[i].position, smoothing);
      }

      // Recalculate velocity and acceleration after smoothing position
      for (let i = 0; i < this.profile.length; i++) {
        if (i === 0) {
          this.profile[i].velocity = 0;
          this.profile[i].acceleration = 0;
        } else if (i === this.profile.length - 1) {
          this.profile[i].velocity = 0;
          this.profile[i].acceleration = 0;
        } else {
          this.profile[i].velocity = (this.profile[i + 1].position - this.profile[i - 1].position) / (2 * dt);
          this.profile[i].acceleration = (this.profile[i + 1].velocity - this.profile[i - 1].velocity) / (2 * dt);
        }
      }
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
    const dt = 1 / this.currentParams!.ftmFs;

    // Compute mm of filament per mm of travel
    const mmFilamentPerMmTravel =
      (this.currentParams!.lineWidth * layerHeight) / filamentArea;

    // Calculate extruder(t) values for each plot
    const ePosition = profile.map(
      (p, i) =>
        p.position * mmFilamentPerMmTravel +
        (this.k * (p.position - (i == 0 ? 0 : profile[i - 1].position))) / dt
    );
    const eVelocity = profile.map(
      (p, i) =>
        p.velocity * mmFilamentPerMmTravel +
        (this.k * (p.velocity - (i == 0 ? 0 : profile[i - 1].velocity))) / dt
    );
    const eAcceleration = profile.map(
      (p, i) =>
        p.acceleration * mmFilamentPerMmTravel +
        (this.k *
          (p.acceleration - (i == 0 ? 0 : profile[i - 1].acceleration))) /
          dt
    );

    // Update historic max values only if overshoot didn't change
    const overshootChanged =
      this.currentParams &&
      this.currentParams.accOvershoot !== this.previousAccOvershoot;
    if (!overshootChanged) {
      // Calculate current max values including extruder(t) traces
      const positionValues = [...profile.map((p) => p.position), ...ePosition];
      this.historicMaxPosition = Math.max(...positionValues.map(Math.abs));

      const velocityValues = [...profile.map((p) => p.velocity), ...eVelocity];
      this.historicMaxVelocity = Math.max(...velocityValues.map(Math.abs));

      const accelerationValues = [
        ...profile.map((p) => Math.abs(p.acceleration) / 1000),
        ...eAcceleration.map((a) => Math.abs(a) / 1000),
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
    this.drawPlotWithE(
      profile,
      'position',
      ePosition,
      maxTime,
      maxPosition,
      0,
      plotHeight,
      'blue',
      'purple',
      'Position (mm)'
    );

    // Draw velocity plot (middle third) with both traces
    this.drawPlotWithE(
      profile,
      'velocity',
      eVelocity,
      maxTime,
      maxVelocity,
      plotHeight,
      plotHeight,
      'green',
      'purple',
      'Velocity (mm/s)'
    );

    // Draw acceleration plot (bottom third) with both traces
    this.drawPlotWithE(
      profile,
      'acceleration',
      eAcceleration,
      maxTime,
      maxAcceleration,
      2 * plotHeight,
      plotHeight,
      'red',
      'purple',
      'Acceleration (mm/s²)'
    );
  }

  private drawPlotWithE(
    profile: ProfilePoint[],
    property: keyof ProfilePoint,
    eValues: number[],
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
        property === 'acceleration' ? eValues[i] / 1000 : eValues[i];
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
    const originalValues = profile.map((p) =>
      property === 'acceleration'
        ? Math.abs(p[property] as number) / 1000
        : (p[property] as number)
    );
    const adjustedEValues = eValues.map((v) =>
      property === 'acceleration' ? v / 1000 : v
    );
    const suffix = property === 'acceleration' ? 'k' : '';

    // Display max/min for traces at bottom right
    this.ctx.fillStyle = '#333';
    this.ctx.font = '10px Arial';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(
      `Motion Max: ${Math.max(...originalValues).toFixed(1)}${suffix}, Min: ${Math.min(...originalValues).toFixed(1)}${suffix}`,
      width - 50,
      yOffset + plotHeight / 2 + 10
    );

    this.ctx.fillText(
      `Extruder Max: ${Math.max(...adjustedEValues).toFixed(1)}${suffix}, Min: ${Math.min(...adjustedEValues).toFixed(1)}${suffix}`,
      width - 50,
      yOffset + plotHeight / 2 + 20
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
  const lineWidthSlider = document.getElementById(
    'line-width'
  ) as HTMLInputElement;
  const ftmFsSlider = document.getElementById('ftm-fs') as HTMLInputElement;
  const smoothingTimeSlider = document.getElementById('smoothing-time') as HTMLInputElement;
  const overshootGroup = document.getElementById('overshoot-group')!;

  // Get value display elements
  const distanceValue = document.getElementById('distance-value')!;
  const rateValue = document.getElementById('rate-value')!;
  const accelerationValue = document.getElementById('acceleration-value')!;
  const overshootValue = document.getElementById('overshoot-value')!;
  const kValue = document.getElementById('k-value')!;
  const lineWidthValue = document.getElementById('line-width-value')!;
  const ftmFsValue = document.getElementById('ftm-fs-value')!;
  const smoothingTimeValue = document.getElementById('smoothing-time-value')!;

  function updateSimulator() {
    const params: MotionParameters = {
      trajectory: trajectorySelect.value as 'trapezoidal' | '6poly',
      distance: parseFloat(distanceSlider.value),
      rate: parseFloat(rateSlider.value),
      acceleration: parseFloat(accelerationSlider.value),
      accOvershoot: parseFloat(overshootSlider.value),
      k: parseFloat(kSlider.value),
      lineWidth: parseFloat(lineWidthSlider.value),
      ftmFs: parseFloat(ftmFsSlider.value),
      smoothingTime: parseFloat(smoothingTimeSlider.value),
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
    ftmFsValue.textContent = ftmFsSlider.value + ' Hz';
    smoothingTimeValue.textContent = smoothingTimeSlider.value + ' s';
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
    ftmFsSlider,
    smoothingTimeSlider,
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
