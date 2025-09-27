import {
  MotionParameters,
  Profile,
  calculateMotionProfile,
} from './profile.js';

const derivate = (arr: number[], dt: number) =>
  arr.map((p, i) => (i === 0 ? 0 : (p - arr[i - 1]) / dt));

export class MotionSimulator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private profile: Profile | null = null;
  private k: number = 0.5;
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
    this.profile = calculateMotionProfile(params);
    this.k = params.k;
    this.draw();
  }

  private draw(): void {
    if (!this.profile) return;

    const profile = this.profile;
    if (profile.pos.length === 0) return;

    this.ctx.clearRect(
      0,
      0,
      this.canvas.width / window.devicePixelRatio,
      this.canvas.height / window.devicePixelRatio
    );

    const height = this.canvas.height / window.devicePixelRatio;

    // Find max values for scaling
    const dt = 1 / this.currentParams!.ftmFs;
    const maxTime = profile.pos.length * dt;

    // Calculate extruder(t) values for each plot
    const ePosition = profile.pos.map((p, i) => p + this.k * profile.vel[i]);
    const eVelocity = derivate(ePosition, dt);
    const eAcceleration = derivate(eVelocity, dt);

    // Calculate current max values including extruder(t) traces
    const positionValues = [...profile.pos, ...ePosition];
    const maxPosition = Math.max(...positionValues.map(Math.abs));

    const velocityValues = [...profile.vel, ...eVelocity];
    const maxVelocity = Math.max(...velocityValues.map(Math.abs));

    const accelerationValues = [...profile.acc, ...eAcceleration].map(
      (a) => Math.abs(a) / 1000
    );
    const maxAcceleration = Math.max(...accelerationValues);

    const plotHeight = (height - 40) / 3;
    // Draw position plot (top third) with both traces
    this.drawPlotWithE(
      profile,
      'pos',
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
      'vel',
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
      'acc',
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
    profile: Profile,
    property: keyof Profile,
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

    const datapoints = profile[property];
    for (let i = 0; i < datapoints.length; i++) {
      const point = datapoints[i];
      const x = (i / datapoints.length) * (width - 100) + 50;
      const value = property === 'acc' ? Math.abs(point) / 1000 : point;
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

    for (let i = 0; i < eValues.length; i++) {
      const x = (i / eValues.length) * (width - 100) + 50;
      const value = property === 'acc' ? eValues[i] / 1000 : eValues[i];
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
        property === 'acc' ? tickValue.toFixed(1) + 'k' : tickValue.toFixed(1),
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
    const originalValues = datapoints.map((v) =>
      property === 'acc' ? Math.abs(v) / 1000 : v
    );
    const adjustedEValues = eValues.map((v) =>
      property === 'acc' ? v / 1000 : v
    );
    const suffix = property === 'acc' ? 'k' : '';

    // Display max/min for traces at bottom right
    this.ctx.fillStyle = '#333';
    this.ctx.font = '10px Arial';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(
      `Raw Max: ${Math.max(...originalValues).toFixed(1)}${suffix}, Min: ${Math.min(...originalValues).toFixed(1)}${suffix}`,
      width - 50,
      yOffset + plotHeight / 2 + 10
    );

    this.ctx.fillText(
      `With advance Max: ${Math.max(...adjustedEValues).toFixed(1)}${suffix}, Min: ${Math.min(...adjustedEValues).toFixed(1)}${suffix}`,
      width - 50,
      yOffset + plotHeight / 2 + 20
    );
    this.ctx.textAlign = 'left'; // reset
  }
}
