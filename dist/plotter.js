import { calculateMotionProfile } from './profile.js';
import { smoothen } from './smoothen.js';
const derivate = (arr, dt) => arr.map((p, i) => (i === 0 ? 0 : (p - arr[i - 1]) / dt));
export class MotionSimulator {
    constructor(canvasId) {
        this.profile = null;
        this.k = 0.5;
        this.currentParams = null;
        // Scaling state as array of derivative levels (0=position, 1=velocity, 2=acceleration)
        this.scalingState = [
            { max: 0, min: 0, oldMax: 0, oldMin: 0, newMax: 0, newMin: 0 }, // position
            { max: 0, min: 0, oldMax: 0, oldMin: 0, newMax: 0, newMin: 0 }, // velocity
            { max: 0, min: 0, oldMax: 0, oldMin: 0, newMax: 0, newMin: 0 }, // acceleration
        ];
        this.animating = false;
        this.animationStartTime = 0;
        this.firstUpdate = true;
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    resizeCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
        // Redraw after resize to update axes
        if (this.profile) {
            this.draw();
        }
    }
    updateProfile(params) {
        this.currentParams = params;
        this.profile = calculateMotionProfile(params);
        this.k = params.k;
        this.updateScaling();
        this.draw();
    }
    updateProfileOnly(params) {
        this.currentParams = params;
        this.profile = calculateMotionProfile(params);
        this.k = params.k;
        this.draw();
    }
    updateScaling() {
        if (!this.profile || !this.currentParams || this.animating)
            return;
        const dt = 1 / this.currentParams.ftmFs;
        // Calculate all traces using array-based approach
        const traces = this.calculateAllTraces(this.profile, dt);
        // Process each derivative level (0=position, 1=velocity, 2=acceleration)
        for (let level = 0; level < 3; level++) {
            // Store old values for animation
            this.scalingState[level].oldMax = this.scalingState[level].max;
            this.scalingState[level].oldMin = this.scalingState[level].min;
            // Calculate new values
            const levelKeys = ['position', 'velocity', 'acceleration'];
            const allValues = traces[levelKeys[level]].flat();
            this.scalingState[level].newMax = Math.max(...allValues);
            this.scalingState[level].newMin = Math.min(...allValues);
        }
        if (this.firstUpdate) {
            this.firstUpdate = false;
            // Set values directly without animation
            for (let level = 0; level < 3; level++) {
                this.scalingState[level].max = this.scalingState[level].newMax;
                this.scalingState[level].min = this.scalingState[level].newMin;
            }
        }
        else {
            // Start animation
            this.animating = true;
            this.animationStartTime = performance.now();
            this.animateScaling();
        }
    }
    calculateAllTraces(posRaw, dt) {
        // Calculate derivatives
        const velRaw = derivate(posRaw, dt);
        const accRaw = derivate(velRaw, dt);
        // Calculate extruder(t) values - first apply formula to posRaw, then smooth
        const posWithAdvanceRaw = posRaw.map((p, i) => p + this.currentParams.k * velRaw[i]);
        const posWithAdvance = smoothen(posWithAdvanceRaw, this.currentParams.smoothingTime, dt, this.currentParams.ftmFs, this.currentParams.ftmSmoothingOrder);
        const velWithAdvance = derivate(posWithAdvance, dt);
        const accWithAdvance = derivate(velWithAdvance, dt);
        // Calculate effective values using exponential smoothing with tau = k
        const tau = this.currentParams.k;
        const alpha = 1 - Math.exp(-dt / tau);
        const posEffective = this.simulateNozzle(posWithAdvance, alpha);
        const velEffective = this.simulateNozzle(velWithAdvance, alpha);
        const accEffective = this.simulateNozzle(accWithAdvance, alpha);
        return {
            position: [posRaw, posWithAdvance, posEffective],
            velocity: [velRaw, velWithAdvance, velEffective],
            acceleration: [accRaw, accWithAdvance, accEffective],
            labels: ['Planned', 'With advance', 'Effective'],
        };
    }
    animateScaling() {
        const elapsed = performance.now() - this.animationStartTime;
        const duration = 500;
        const progress = Math.min(elapsed / duration, 1);
        // Ease function (ease-in-out)
        const easeProgress = 3 * progress * progress - 2 * progress * progress * progress;
        // Interpolate max and min values for each derivative level
        for (let level = 0; level < 3; level++) {
            this.scalingState[level].max =
                this.scalingState[level].oldMax +
                    (this.scalingState[level].newMax - this.scalingState[level].oldMax) * easeProgress;
            this.scalingState[level].min =
                this.scalingState[level].oldMin +
                    (this.scalingState[level].newMin - this.scalingState[level].oldMin) * easeProgress;
        }
        // Redraw with interpolated values
        this.draw();
        if (progress < 1) {
            requestAnimationFrame(() => this.animateScaling());
        }
        else {
            this.animating = false;
            // Ensure final values are set exactly
            for (let level = 0; level < 3; level++) {
                this.scalingState[level].max = this.scalingState[level].newMax;
                this.scalingState[level].min = this.scalingState[level].newMin;
            }
            this.draw();
        }
    }
    redraw() {
        this.draw();
    }
    simulateNozzle(values, alpha) {
        if (values.length === 0)
            return [];
        if (alpha <= 0)
            return [...values];
        const smoothed = [values[0]]; // Start with the first value
        for (let i = 1; i < values.length; i++) {
            smoothed[i] = alpha * values[i] + (1 - alpha) * smoothed[i - 1];
        }
        return smoothed;
    }
    draw() {
        if (!this.profile || !this.currentParams)
            return;
        this.ctx.clearRect(0, 0, this.canvas.width / window.devicePixelRatio, this.canvas.height / window.devicePixelRatio);
        const height = this.canvas.height / window.devicePixelRatio;
        const dt = 1 / this.currentParams.ftmFs;
        const plotHeight = height / 3;
        // Calculate all traces using array-based approach
        const traces = this.calculateAllTraces(this.profile, dt);
        // Define plot configurations
        const plotConfigs = [
            { traces: traces.position, colors: ['green', 'blue', 'red'], label: 'Position (mm)' },
            { traces: traces.velocity, colors: ['green', 'blue', 'red'], label: 'Velocity (mm/s)' },
            { traces: traces.acceleration, colors: ['green', 'blue', 'red'], label: 'Acceleration (mm/s²)' },
        ];
        // Draw all plots using loops
        plotConfigs.forEach((config, plotIndex) => {
            // Draw axes for this plot (only once per plot)
            this.drawAxes(this.scalingState[plotIndex].min, this.scalingState[plotIndex].max, plotIndex * plotHeight, plotHeight, config.label);
            // Draw all traces and their legends for this plot
            config.traces.forEach((trace, traceIndex) => {
                this.drawTrace(trace, this.scalingState[plotIndex].min, this.scalingState[plotIndex].max, plotIndex * plotHeight, plotHeight, config.colors[traceIndex]);
                // Draw legend for this specific trace
                this.drawLegend(trace, config.colors[traceIndex], traces.labels[traceIndex], plotIndex * plotHeight, plotHeight, traceIndex);
            });
        });
    }
    drawAxes(minValue, maxValue, yOffset, plotHeight, label) {
        const width = this.canvas.width / window.devicePixelRatio;
        const range = maxValue - minValue;
        if (range === 0)
            return;
        const scale = (plotHeight - 40) / range;
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
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.fillStyle = '#333';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'right';
        const numTicks = 5;
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
        this.ctx.textAlign = 'left';
        // Draw label
        this.ctx.fillStyle = '#333';
        this.ctx.font = '14px Arial';
        this.ctx.fillText(label, 45, yOffset + 15);
    }
    drawTrace(trace, minValue, maxValue, yOffset, plotHeight, color) {
        const width = this.canvas.width / window.devicePixelRatio;
        const range = maxValue - minValue;
        if (range === 0)
            return;
        const scale = (plotHeight - 40) / range;
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        for (let i = 0; i < trace.length; i++) {
            const x = (i / trace.length) * (width - 100) + 50;
            const value = trace[i];
            const y = yOffset + plotHeight - 20 - (value - minValue) * scale;
            if (i === 0) {
                this.ctx.moveTo(x, y);
            }
            else {
                this.ctx.lineTo(x, y);
            }
        }
        this.ctx.stroke();
    }
    drawLegend(trace, color, label, yOffset, plotHeight, traceIndex) {
        const width = this.canvas.width / window.devicePixelRatio;
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'right';
        const labelX = width - 50;
        const labelY = yOffset + plotHeight - 90 + traceIndex * 10;
        this.ctx.fillStyle = color;
        this.ctx.fillText(`${label}: Max: ${Math.max(...trace).toFixed(1)}, Min: ${Math.min(...trace).toFixed(1)}`, labelX, labelY);
        this.ctx.textAlign = 'left';
    }
}
