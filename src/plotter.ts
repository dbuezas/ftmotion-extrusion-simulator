import { MotionParameters, Profile, calculateMotionProfile } from './profile.js';

const derivate = (arr: number[], dt: number) => arr.map((p, i) => (i === 0 ? 0 : (p - arr[i - 1]) / dt));

export class MotionSimulator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private profile: Profile | null = null;
  private k: number = 0.5;
  private currentParams: MotionParameters | null = null;
  private maxPosition: number = 0;
  private maxVelocity: number = 0;
  private maxAcceleration: number = 0;
  private minPosition: number = 0;
  private minVelocity: number = 0;
  private minAcceleration: number = 0;
  private animating: boolean = false;
  private animationStartTime: number = 0;
  private oldMaxPosition: number = 0;
  private oldMaxVelocity: number = 0;
  private oldMaxAcceleration: number = 0;
  private oldMinPosition: number = 0;
  private oldMinVelocity: number = 0;
  private oldMinAcceleration: number = 0;
  private newMaxPosition: number = 0;
  private newMaxVelocity: number = 0;
  private newMaxAcceleration: number = 0;
  private newMinPosition: number = 0;
  private newMinVelocity: number = 0;
  private newMinAcceleration: number = 0;
  private firstUpdate: boolean = true;

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
    this.ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    // Redraw after resize to update axes
    if (this.profile) {
      this.draw();
    }
  }

  updateProfile(params: MotionParameters): void {
    this.currentParams = params;
    this.profile = calculateMotionProfile(params);
    this.k = params.k;
    this.updateScaling();
    this.draw();
  }

  updateProfileOnly(params: MotionParameters): void {
    this.currentParams = params;
    this.profile = calculateMotionProfile(params);
    this.k = params.k;
    this.draw();
  }

  updateScaling(): void {
    if (!this.profile || !this.currentParams || this.animating) return;

    // Store old values
    this.oldMaxPosition = this.maxPosition;
    this.oldMaxVelocity = this.maxVelocity;
    this.oldMaxAcceleration = this.maxAcceleration;
    this.oldMinPosition = this.minPosition;
    this.oldMinVelocity = this.minVelocity;
    this.oldMinAcceleration = this.minAcceleration;

    const profile = this.profile;
    const dt = 1 / this.currentParams.ftmFs;

    // Calculate extruder(t) values for each plot
    const ePosition = profile.pos.map((p, i) => p + this.k * profile.vel[i]);
    const eVelocity = derivate(ePosition, dt);
    const eAcceleration = derivate(eVelocity, dt);

    // Calculate new min and max values including extruder(t) traces
    const positionValues = [...profile.pos, ...ePosition];
    this.newMaxPosition = Math.max(...positionValues);
    this.newMinPosition = Math.min(...positionValues);

    const velocityValues = [...profile.vel, ...eVelocity];
    this.newMaxVelocity = Math.max(...velocityValues);
    this.newMinVelocity = Math.min(...velocityValues);

    const accelerationValues = [...profile.acc, ...eAcceleration];
    this.newMaxAcceleration = Math.max(...accelerationValues);
    this.newMinAcceleration = Math.min(...accelerationValues);

    if (this.firstUpdate) {
      this.firstUpdate = false;
      // Set values directly without animation
      this.maxPosition = this.newMaxPosition;
      this.maxVelocity = this.newMaxVelocity;
      this.maxAcceleration = this.newMaxAcceleration;
      this.minPosition = this.newMinPosition;
      this.minVelocity = this.newMinVelocity;
      this.minAcceleration = this.newMinAcceleration;
    } else {
      // Start animation
      this.animating = true;
      this.animationStartTime = performance.now();
      this.animateScaling();
    }
  }

  private animateScaling(): void {
    const elapsed = performance.now() - this.animationStartTime;
    const duration = 250; // 250ms
    const progress = Math.min(elapsed / duration, 1);

    // Ease function (ease-out)
    const easeProgress = 1 - Math.pow(1 - progress, 3);

    // Interpolate max and min values
    this.maxPosition = this.oldMaxPosition + (this.newMaxPosition - this.oldMaxPosition) * easeProgress;
    this.maxVelocity = this.oldMaxVelocity + (this.newMaxVelocity - this.oldMaxVelocity) * easeProgress;
    this.maxAcceleration = this.oldMaxAcceleration + (this.newMaxAcceleration - this.oldMaxAcceleration) * easeProgress;
    this.minPosition = this.oldMinPosition + (this.newMinPosition - this.oldMinPosition) * easeProgress;
    this.minVelocity = this.oldMinVelocity + (this.newMinVelocity - this.oldMinVelocity) * easeProgress;
    this.minAcceleration = this.oldMinAcceleration + (this.newMinAcceleration - this.oldMinAcceleration) * easeProgress;

    // Redraw with interpolated values
    this.draw();

    if (progress < 1) {
      requestAnimationFrame(() => this.animateScaling());
    } else {
      this.animating = false;
      // Ensure final values are set exactly
      this.maxPosition = this.newMaxPosition;
      this.maxVelocity = this.newMaxVelocity;
      this.maxAcceleration = this.newMaxAcceleration;
      this.minPosition = this.newMinPosition;
      this.minVelocity = this.newMinVelocity;
      this.minAcceleration = this.newMinAcceleration;
      this.draw();
    }
  }

  redraw(): void {
    this.draw();
  }

  private draw(): void {
    if (!this.profile || !this.currentParams) return;

    const profile = this.profile;
    if (profile.pos.length === 0) return;

    this.ctx.clearRect(0, 0, this.canvas.width / window.devicePixelRatio, this.canvas.height / window.devicePixelRatio);

    const height = this.canvas.height / window.devicePixelRatio;

    // Find max values for scaling
    const dt = 1 / this.currentParams.ftmFs;
    const maxTime = profile.pos.length * dt;

    // Calculate extruder(t) values for each plot
    const ePosition = profile.pos.map((p, i) => p + this.k * profile.vel[i]);
    const eVelocity = derivate(ePosition, dt);
    const eAcceleration = derivate(eVelocity, dt);

    const plotHeight = (height - 40) / 3;
    // Draw position plot (top third) with both traces
    this.drawPlotWithE(
      profile,
      'pos',
      ePosition,
      maxTime,
      this.minPosition,
      this.maxPosition,
      0,
      plotHeight,
      'blue',
      'purple',
      'Position (mm)'
    );

    // Draw velocity plot (middle third) with both traces
    this.drawPlotWithE(
      profile,
      'vel',
      eVelocity,
      maxTime,
      this.minVelocity,
      this.maxVelocity,
      plotHeight,
      plotHeight,
      'green',
      'purple',
      'Velocity (mm/s)'
    );

    // Draw acceleration plot (bottom third) with both traces
    this.drawPlotWithE(
      profile,
      'acc',
      eAcceleration,
      maxTime,
      this.minAcceleration,
      this.maxAcceleration,
      2 * plotHeight,
      plotHeight,
      'red',
      'purple',
      'Acceleration (mm/s²)'
    );
  }

  private drawPlotWithE(
    profile: Profile,
    property: keyof Profile,
    eValues: number[],
    maxTime: number,
    minValue: number,
    maxValue: number,
    yOffset: number,
    plotHeight: number,
    color1: string,
    color2: string,
    label: string
  ): void {
    const width = this.canvas.width / window.devicePixelRatio;

    const range = maxValue - minValue;
    if (range === 0) return;
    const scale = (plotHeight - 40) / range;

    // Draw original function
    this.ctx.strokeStyle = color1;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();

    const datapoints = profile[property];
    for (let i = 0; i < datapoints.length; i++) {
      const point = datapoints[i];
      const x = (i / datapoints.length) * (width - 100) + 50;
      const value = point;
      const y = yOffset + plotHeight - 20 - (value - minValue) * scale;

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

    for (let i = 0; i < eValues.length; i++) {
      const x = (i / eValues.length) * (width - 100) + 50;
      const eValue = eValues[i];
      const y = yOffset + plotHeight - 20 - (eValue - minValue) * scale;

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
    // Horizontal axis (zero line)
    const zeroY = yOffset + plotHeight - 20 - (0 - minValue) * scale;
    this.ctx.moveTo(50, zeroY);
    this.ctx.lineTo(width - 50, zeroY);
    // Vertical axis
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
      const tickValue = minValue + (i / (numTicks - 1)) * range;
      const y = yOffset + plotHeight - 20 - (tickValue - minValue) * scale;
      // Draw tick mark
      this.ctx.beginPath();
      this.ctx.moveTo(45, y);
      this.ctx.lineTo(55, y);
      this.ctx.stroke();
      // Draw label
      this.ctx.fillText(tickValue.toFixed(1), 40, y + 4);
    }
    this.ctx.textAlign = 'left'; // reset

    // Draw label
    this.ctx.fillStyle = color1;
    this.ctx.font = '14px Arial';
    this.ctx.fillText(label, 45, yOffset + 15);

    // Calculate max/min for display
    const originalValues = datapoints;
    const adjustedEValues = eValues;
    const suffix = '';

    // Display max/min for traces at bottom right
    this.ctx.fillStyle = '#333';
    this.ctx.font = '10px Arial';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(
      `Planned extrussion. Max: ${Math.max(...originalValues).toFixed(1)}${suffix}, Min: ${Math.min(...originalValues).toFixed(1)}${suffix}`,
      width - 50,
      yOffset + plotHeight / 2 + 10
    );

    this.ctx.fillText(
      `With advance Max:. ${Math.max(...adjustedEValues).toFixed(1)}${suffix}, Min: ${Math.min(...adjustedEValues).toFixed(1)}${suffix}`,
      width - 50,
      yOffset + plotHeight / 2 + 20
    );
    this.ctx.textAlign = 'left'; // reset
  }
}
