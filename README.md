# FTMotion Extrusion Profile Simulator

A web-based simulator for visualizing extrusion motion profiles in Marlin with FTMotion enalbled. This tool helps understand how different motion parameters affect the position, velocity, and acceleration of the extruder, including the effects of linear advance (K-factor), particularly those of smoothing time, poly6 and acceleration overshoot.

# Note not al of this is merged in Marlin yet

* https://github.com/MarlinFirmware/Marlin/pull/28082 
* https://github.com/MarlinFirmware/Marlin/pull/28043
* https://github.com/MarlinFirmware/Marlin/pull/28055
* https://github.com/MarlinFirmware/Marlin/pull/28078

See the webapp: https://dbuezas.github.io/ftmotion-extrusion-simulator/
<img width="1149" height="855" alt="image" src="https://github.com/user-attachments/assets/1de7839f-13cc-4d17-a116-e8af4b86f994" />


## Features

- **Motion Profile Types**: Supports both trapezoidal and 6-poly (sextic) acceleration profiles
- **Real-time Visualization**: Interactive plots showing position, velocity, and acceleration over time
- **Linear Advance Simulation**: Displays the effect of linear advance on extrusion profiles
- **Adjustable Parameters**:
  - Distance (mm)
  - Rate (Velocity, mm/s)
  - Acceleration (mm/s²)
  - Acceleration Overshoot (for 6-poly profiles)
  - Linear Advance K-factor
  - Line Width (mm)
  - Layer Height (mm)
  - Smoothing Time (s)
  - FTM_TS (Hz)
- **Axis Smoothing**: Implements new FTMotion smoothing algorithm

## How It Works

The simulator generates motion profiles based on the selected trajectory type:

- **Trapezoidal**: Classic trapezoidal velocity profile with constant acceleration/deceleration phases
- **6-Poly**: Sextic polynomial profile with acceleration overshoot for continuous acceleration, resulting in a smooth linear advance term

The profiles are calculated in terms of filament extrusion, taking into account line width and layer height to convert travel distance to filament volume. Linear advance is applied to show how it compensates for pressure changes in the extruder.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/dbuezas/ftmotion-extrusion-simulator.git
   cd ftmotion-extrusion-simulator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

## Running the Simulator

Start the development server:
```bash
npm run dev
```

Or serve the built files:
```bash
npm start
```

Open your browser and navigate to `http://localhost:3000` (or the port shown in the terminal).

## Usage

1. Adjust the sliders to set your motion parameters
2. Select the trajectory type (Trapezoidal or 6POLY)
3. Observe the real-time updates in the plots:
   - **Position**: Shows planned extrusion (blue) and with linear advance (purple)
   - **Velocity**: Velocity profile with advance compensation
   - **Acceleration**: Acceleration profile with advance effects

## Technical Details

- Built with TypeScript and vanilla JavaScript
- Uses HTML5 Canvas for plotting
- Implements Marlin firmware's motion algorithms
- Includes FTMotion axis smoothing
- Calculates filament volume based on line dimensions

## Scripts

- `npm run build`: Compile TypeScript to JavaScript
- `npm run watch`: Watch for changes and recompile
- `npm run start`: Start HTTP server
- `npm run dev`: Run watch and server concurrently
- `npm run format`: Format code with Prettier and ESLint
- `npm run lint`: Run ESLint

## Dependencies

- TypeScript
- ESLint
- Prettier
- HTTP Server

## License

MIT

## Author

dbuezas@2025
