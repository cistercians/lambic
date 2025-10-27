# MapModeler - Interactive Map Design Tool

A standalone web-based tool for experimenting with noise algorithm parameters to design procedural maps for the Lambic game.

## Features

- **Interactive Map Viewer**: Real-time visualization of generated maps using the same color scheme as the game
- **Parameter Controls**: Sliders for all noise algorithm parameters with real-time updates
- **Preset Configurations**: Pre-configured parameter sets for different map styles
- **Export Functionality**: Generate detailed reports of current parameters for use in the game
- **Responsive Design**: Works on desktop and mobile devices

## Quick Start

1. Open `index.html` in a web browser
2. Adjust parameters using the sliders in the left panel
3. Watch the map update in real-time on the right
4. Use preset buttons for quick configurations
5. Click "Export Report" to generate a text report of current parameters

## Parameter Guide

### Red Channel (Continents/Oceans)
- **Frequency X/Y**: Controls the scale of landmass features
  - Lower values = larger landmasses
  - Higher values = more islands and fractured coastlines
- **Amplitude**: Controls contrast between land and water
- **Offset**: Shifts the baseline (more/less land overall)

### Green Channel (Biomes/Terrain)
- **Frequency X/Y**: Controls biome region size
  - Lower values = larger biome regions
  - Higher values = more varied/mixed terrain
- **Amplitude**: Controls biome contrast
- **Offset**: Affects biome distribution

### Blue Channel (Fine Details)
- **Frequency X/Y**: Controls terrain detail level
  - Lower values = more detailed texture
  - Higher values = smoother terrain
- **Amplitude**: Controls detail intensity

### Terrain Thresholds
- **Water Threshold**: Higher = more land, lower = more water
- **Mountain Threshold**: Controls mountain frequency
- **Rocks Threshold**: Controls rocky terrain frequency
- **Brush Threshold**: Controls arid regions
- **Light Forest Threshold**: Controls transitional forest areas

## Presets

- **Default**: Balanced parameters for general use
- **Islands**: Creates island-heavy maps with varied terrain
- **Continents**: Creates large continental landmasses
- **Varied**: High variety with broken-up terrain features

## Export Options

The export functionality generates a detailed report containing:
- All current parameter values
- Terrain distribution statistics
- Analysis of map characteristics
- Instructions for implementing in the game

## Integration with Game

To use generated parameters in your game:

1. Export the report from MapModeler
2. Copy the parameter values
3. Paste them into `server/js/genesis.js`
4. Replace the existing parameter declarations
5. Restart your game server

## File Structure

```
mapmodeler/
├── index.html          # Main HTML interface
├── css/
│   └── mapmodeler.css  # Styling for the tool
├── js/
│   ├── genesis.js      # Noise generation algorithm
│   ├── mapviewer.js    # Canvas-based map rendering
│   ├── controls.js     # Slider controls and UI logic
│   └── export.js       # Report generation functionality
└── README.md           # This file
```

## Technical Details

- **Noise Algorithm**: Simplex Noise implementation adapted for browser use
- **Rendering**: Canvas-based tile rendering with color mapping
- **Performance**: Debounced regeneration to prevent excessive computation
- **Compatibility**: Works in all modern browsers, no external dependencies

## Troubleshooting

- **Map not updating**: Check browser console for errors
- **Slow performance**: Reduce map size or disable auto-regeneration
- **Export not working**: Ensure browser supports clipboard API

## Development

The tool is built with vanilla JavaScript and HTML5 Canvas. No build process or external dependencies are required.

## License

This tool is part of the Lambic game project.

