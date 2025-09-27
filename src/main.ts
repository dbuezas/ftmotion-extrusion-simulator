import { MotionSimulator } from './plotter.js';
import { MotionParameters } from './profile.js';

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
  const layerHeightSlider = document.getElementById(
    'layer-height'
  ) as HTMLInputElement;
  const ftmFsSlider = document.getElementById('ftm-fs') as HTMLInputElement;
  const smoothingTimeSlider = document.getElementById(
    'smoothing-time'
  ) as HTMLInputElement;
  const overshootGroup = document.getElementById('overshoot-group')!;

  // Get value display elements
  const distanceValue = document.getElementById('distance-value')!;
  const rateValue = document.getElementById('rate-value')!;
  const accelerationValue = document.getElementById('acceleration-value')!;
  const overshootValue = document.getElementById('overshoot-value')!;
  const kValue = document.getElementById('k-value')!;
  const lineWidthValue = document.getElementById('line-width-value')!;
  const layerHeightValue = document.getElementById('layer-height-value')!;
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
      layerHeight: parseFloat(layerHeightSlider.value),
      ftmFs: parseFloat(ftmFsSlider.value),
      smoothingTime: parseFloat(smoothingTimeSlider.value),
    };
    simulator.updateProfile(params);
  }

  function updateDisplays() {
    distanceValue.textContent = distanceSlider.value + ' mm';
    rateValue.textContent = rateSlider.value + ' mm/s';
    accelerationValue.textContent =
      parseFloat(accelerationSlider.value) + ' mm/s²';
    overshootValue.textContent = overshootSlider.value;
    kValue.textContent = kSlider.value;
    lineWidthValue.textContent = lineWidthSlider.value + ' mm';
    layerHeightValue.textContent = layerHeightSlider.value + ' mm';
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
    layerHeightSlider,
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
