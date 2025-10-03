import { MotionSimulator } from './plotter.js';
import { MotionParameters } from './profile.js';

// Initialize the simulator
document.addEventListener('DOMContentLoaded', () => {
  const simulator = new MotionSimulator('motion-canvas');

  // Get control elements
  const trajectorySelect = document.getElementById('trajectory') as HTMLSelectElement;
  const distanceSlider = document.getElementById('distance') as HTMLInputElement;
  const rateSlider = document.getElementById('rate') as HTMLInputElement;
  const accelerationSlider = document.getElementById('acceleration') as HTMLInputElement;
  const overshootSlider = document.getElementById('acc-overshoot') as HTMLInputElement;
  const kSlider = document.getElementById('k-factor') as HTMLInputElement;
  const lineWidthSlider = document.getElementById('line-width') as HTMLInputElement;
  const layerHeightSlider = document.getElementById('layer-height') as HTMLInputElement;
  const ftmFsSlider = document.getElementById('ftm-fs') as HTMLInputElement;
  const smoothingTimeSlider = document.getElementById('smoothing-time') as HTMLInputElement;
  const ftmSmoothingOrderSlider = document.getElementById('ftm-smoothing-order') as HTMLInputElement;
  const overshootGroup = document.getElementById('overshoot-group')!;

  // Get value input elements
  const distanceValue = document.getElementById('distance-value') as HTMLInputElement;
  const rateValue = document.getElementById('rate-value') as HTMLInputElement;
  const accelerationValue = document.getElementById('acceleration-value') as HTMLInputElement;
  const overshootValue = document.getElementById('overshoot-value') as HTMLInputElement;
  const kValue = document.getElementById('k-value') as HTMLInputElement;
  const lineWidthValue = document.getElementById('line-width-value') as HTMLInputElement;
  const layerHeightValue = document.getElementById('layer-height-value') as HTMLInputElement;
  const ftmFsValue = document.getElementById('ftm-fs-value') as HTMLInputElement;
  const smoothingTimeValue = document.getElementById('smoothing-time-value') as HTMLInputElement;
  const ftmSmoothingOrderValue = document.getElementById('ftm-smoothing-order-value') as HTMLInputElement;

  function getParams(): MotionParameters {
    return {
      trajectory: trajectorySelect.value as 'trapezoidal' | '6poly',
      distance: parseFloat(distanceSlider.value),
      rate: parseFloat(rateSlider.value),
      acceleration: parseFloat(accelerationSlider.value),
      accOvershoot: parseFloat(overshootSlider.value),
      k: parseFloat(kSlider.value),
      lineWidth: parseFloat(lineWidthSlider.value),
      layerHeight: parseFloat(layerHeightSlider.value),
      ftmFs: parseFloat(ftmFsSlider.value),
      smoothingTime: parseFloat(smoothingTimeSlider.value),
      ftmSmoothingOrder: parseFloat(ftmSmoothingOrderSlider.value),
    };
  }

  function updateSimulator() {
    const params = getParams();
    simulator.updateProfile(params);
  }

  function updateProfileOnly() {
    const params = getParams();
    simulator.updateProfileOnly(params);
  }

  function updateScaling() {
    simulator.updateScaling();
  }

  function updateDisplays() {
    distanceValue.value = distanceSlider.value;
    rateValue.value = rateSlider.value;
    accelerationValue.value = accelerationSlider.value;
    overshootValue.value = overshootSlider.value;
    kValue.value = kSlider.value;
    lineWidthValue.value = lineWidthSlider.value;
    layerHeightValue.value = layerHeightSlider.value;
    ftmFsValue.value = ftmFsSlider.value;
    smoothingTimeValue.value = smoothingTimeSlider.value;
    ftmSmoothingOrderValue.value = ftmSmoothingOrderSlider.value;
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
    layerHeightSlider,
    ftmFsSlider,
    smoothingTimeSlider,
    ftmSmoothingOrderSlider,
  ].forEach((slider) => {
    slider.addEventListener('input', () => {
      updateDisplays();
      updateProfileOnly();
    });
    slider.addEventListener('change', () => {
      updateScaling();
    });
  });

  // Add event listeners for input fields
  [
    { input: distanceValue, slider: distanceSlider },
    { input: rateValue, slider: rateSlider },
    { input: accelerationValue, slider: accelerationSlider },
    { input: overshootValue, slider: overshootSlider },
    { input: kValue, slider: kSlider },
    { input: lineWidthValue, slider: lineWidthSlider },
    { input: layerHeightValue, slider: layerHeightSlider },
    { input: ftmFsValue, slider: ftmFsSlider },
    { input: smoothingTimeValue, slider: smoothingTimeSlider },
    { input: ftmSmoothingOrderValue, slider: ftmSmoothingOrderSlider },
  ].forEach(({ input, slider }) => {
    input.addEventListener('input', () => {
      // Update slider value if input is valid
      const value = parseFloat(input.value);
      if (!isNaN(value) && value >= parseFloat(slider.min) && value <= parseFloat(slider.max)) {
        slider.value = input.value;
        updateProfileOnly();
      }
    });
    input.addEventListener('change', () => {
      // Validate and clamp the value
      const value = parseFloat(input.value);
      if (!isNaN(value)) {
        const clampedValue = Math.min(Math.max(value, parseFloat(slider.min)), parseFloat(slider.max));
        input.value = clampedValue.toString();
        slider.value = clampedValue.toString();
        updateScaling();
      }
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
