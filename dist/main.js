import { TrapezoidalProfile } from './trapezoidal.js';
import { Poly6Profile } from './poly6.js';
const dt = 0.001; // 1ms steps
class MotionProfile {
    constructor(params) {
        this.profile = [];
        this.params = params;
        this.calculateProfile();
    }
    calculateProfile() {
        const { trajectory, distance, rate, acceleration, accOvershoot } = this.params;
        if (trajectory === '6poly') {
            const poly6Profile = new Poly6Profile(distance, rate, acceleration, accOvershoot);
            this.profile = poly6Profile.getProfile();
        }
        else {
            const trapezoidalProfile = new TrapezoidalProfile(distance, rate, acceleration);
            this.profile = trapezoidalProfile.getProfile();
        }
    }
    getProfile() {
        return this.profile;
    }
}
class MotionSimulator {
    constructor(canvasId) {
        this.profile = null;
        this.k = 0.5;
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
    }
    updateProfile(params) {
        this.profile = new MotionProfile(params);
        this.k = params.k;
        this.draw();
    }
    draw() {
        if (!this.profile)
            return;
        const profile = this.profile.getProfile();
        if (profile.length === 0)
            return;
        this.ctx.clearRect(0, 0, this.canvas.width / window.devicePixelRatio, this.canvas.height / window.devicePixelRatio);
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        // Find max values for scaling
        const maxTime = Math.max(...profile.map(p => p.time));
        const maxPosition = Math.max(...profile.map(p => p.position));
        const maxVelocity = Math.max(...profile.map(p => p.velocity));
        const maxAcceleration = Math.max(...profile.map(p => Math.abs(p.acceleration)));
        // Calculate g(t) values for each plot
        const gPosition = profile.map((p, i) => p.position + this.k * (p.position - (i == 0 ? 0 : profile[i - 1].position)) / dt);
        const gVelocity = profile.map((p, i) => p.velocity + this.k * (p.velocity - (i == 0 ? 0 : profile[i - 1].velocity)) / dt);
        const gAcceleration = profile.map((p, i) => p.acceleration + this.k * (p.acceleration - (i == 0 ? 0 : profile[i - 1].acceleration)) / dt); // jerk not calculated, so derivative of acceleration is 0
        // Calculate min/max values including both original and g(t) traces
        const positionValues = [...profile.map(p => p.position), ...gPosition];
        const velocityValues = [...profile.map(p => p.velocity), ...gVelocity];
        const accelerationValues = [...profile.map(p => Math.abs(p.acceleration)), ...gAcceleration.map(Math.abs)];
        const positionMin = Math.min(...positionValues);
        const positionMax = Math.max(...positionValues);
        const positionRange = Math.max(Math.abs(positionMin), Math.abs(positionMax));
        const velocityMin = Math.min(...velocityValues);
        const velocityMax = Math.max(...velocityValues);
        const velocityRange = Math.max(Math.abs(velocityMin), Math.abs(velocityMax));
        const maxAccelerationWithG = Math.max(...accelerationValues);
        // Draw position plot (top third) with both traces
        this.drawPlotWithG(profile, 'position', gPosition, maxTime, positionRange, 0, height / 3, 'blue', 'purple', 'Position (mm)');
        // Draw velocity plot (middle third) with both traces
        this.drawPlotWithG(profile, 'velocity', gVelocity, maxTime, velocityRange, height / 3, height / 3, 'green', 'purple', 'Velocity (mm/s)');
        // Draw acceleration plot (bottom third) with both traces
        this.drawPlotWithG(profile, 'acceleration', gAcceleration, maxTime, maxAccelerationWithG, 2 * height / 3, height / 3, 'red', 'purple', 'Acceleration (mm/s²)');
    }
    drawPlotWithG(profile, property, gValues, maxTime, maxValue, yOffset, plotHeight, color1, color2, label) {
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        // Calculate center line (zero) position
        const centerY = yOffset + plotHeight / 2;
        // Draw original function
        this.ctx.strokeStyle = color1;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        for (let i = 0; i < profile.length; i++) {
            const point = profile[i];
            const x = (point.time / maxTime) * (width - 100) + 50;
            const value = property === 'acceleration' ? Math.abs(point[property]) : point[property];
            const y = centerY - (value / maxValue) * (plotHeight / 2 - 20);
            if (i === 0) {
                this.ctx.moveTo(x, y);
            }
            else {
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
            const value = gValues[i];
            const y = centerY - (value / maxValue) * (plotHeight / 2 - 20);
            if (i === 0) {
                this.ctx.moveTo(x, y);
            }
            else {
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
        // Draw label
        this.ctx.fillStyle = color1;
        this.ctx.font = '14px Arial';
        this.ctx.fillText(label, 10, yOffset + 30);
    }
}
// Initialize the simulator
document.addEventListener('DOMContentLoaded', () => {
    const simulator = new MotionSimulator('motion-canvas');
    // Get control elements
    const trajectorySelect = document.getElementById('trajectory');
    const distanceSlider = document.getElementById('distance');
    const rateSlider = document.getElementById('rate');
    const accelerationSlider = document.getElementById('acceleration');
    const overshootSlider = document.getElementById('acc-overshoot');
    const kSlider = document.getElementById('k-factor');
    const overshootGroup = document.getElementById('overshoot-group');
    // Get value display elements
    const distanceValue = document.getElementById('distance-value');
    const rateValue = document.getElementById('rate-value');
    const accelerationValue = document.getElementById('acceleration-value');
    const overshootValue = document.getElementById('overshoot-value');
    const kValue = document.getElementById('k-value');
    function updateSimulator() {
        const params = {
            trajectory: trajectorySelect.value,
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
    function updateTrajectoryDisplay() {
        if (trajectorySelect.value === '6poly') {
            overshootGroup.classList.remove('conditional');
        }
        else {
            overshootGroup.classList.add('conditional');
        }
    }
    // Add event listeners
    trajectorySelect.addEventListener('change', () => {
        updateTrajectoryDisplay();
        updateSimulator();
    });
    [distanceSlider, rateSlider, accelerationSlider, overshootSlider, kSlider].forEach(slider => {
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
