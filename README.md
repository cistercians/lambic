# Lambic

Primitive engine for Stronghodl in Node.js

Read the [design doc](https://docs.google.com/document/d/19Afe7--aKg5ewG4RFM2WIsnfFLiB4CcMyw2aWD9Q2vo/edit?usp=sharing) to learn more about the game.

## Requirements

- **Node.js**: v20.x LTS (Iron) or higher
- **npm**: v10.x or higher (comes with Node.js)
- **macOS**: Homebrew for system dependencies

## Setup Instructions

### 1. Install Node.js v20 LTS

This project requires Node.js v20 or higher. If you use `nvm`:

```bash
nvm install 20
nvm use 20
```

The project includes an `.nvmrc` file, so you can also just run:

```bash
nvm use
```

### 2. Install System Dependencies (macOS)

The `canvas` package requires native system libraries for image processing. Install them via Homebrew:

```bash
brew install pkg-config cairo pango libpng jpeg giflib librsvg pixman
```

**Note for other platforms:**
- **Linux**: Install equivalent packages via your package manager (apt, yum, etc.)
- **Windows**: See [node-canvas documentation](https://github.com/Automattic/node-canvas#compiling) for Windows setup

### 3. Install Node Dependencies

```bash
npm install
```

### 4. Start the Server

```bash
npm start
```

For development mode:

```bash
npm run dev
```

## Project Structure

```
lambic/
├── client/           # Client-side assets
│   ├── js/          # Client JavaScript
│   ├── img/         # Game sprites and tiles
│   └── audio/       # Sound effects and music
├── server/
│   └── js/          # Server-side game logic
│       ├── ai/      # AI and faction logic
│       ├── commands/ # Command handlers
│       ├── core/    # Core game systems
│       └── entities/ # Game entities
└── lambic.js        # Main entry point
```

## Dependencies

### Production Dependencies

- **canvas** (v2.11.2): Server-side canvas for procedural map generation
- **express** (v4.21.1): Web server framework
- **mongojs** (v3.1.0): MongoDB wrapper for data persistence
- **pathfinding** (v0.4.18): Pathfinding algorithms for game AI
- **simplex-noise** (v2.4.0): Noise generation for terrain
- **sockjs** (v0.3.24): WebSocket-like API for real-time communication
- **taffydb** (v2.7.3): In-memory database for game state

## Troubleshooting

### Canvas Installation Issues

If `npm install` fails on the `canvas` package:

1. **Verify system dependencies are installed:**
   ```bash
   pkg-config --exists cairo
   ```

2. **Clean npm cache and retry:**
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Check Node.js version:**
   ```bash
   node -v  # Should be v20.x or higher
   ```

### Deprecated Package Warnings

You may see warnings about deprecated packages during installation. This is expected and safe - they are transitive dependencies (dependencies of dependencies) and do not affect functionality.

**Expected warnings:**
- `inflight`, `glob`, `rimraf`, `npmlog` (from mongojs and canvas dependencies)

## Known Issues

- **mongojs**: This package is outdated but functional. Consider migrating to the official MongoDB driver in the future.
- Some transitive dependencies have deprecation warnings but are required by main dependencies.

## Development Notes

### Package Maintenance

This project has been updated for long-term maintainability:

- ✅ Removed `taffy` (security vulnerability CVE)
- ✅ Using `taffydb` as replacement
- ✅ Updated to Node.js v20 LTS
- ✅ Updated all packages to latest stable versions
- ✅ Added `engines` field to enforce Node.js version

### Future Improvements

- Consider migrating from `mongojs` to official MongoDB driver
- Evaluate alternatives to `taffydb` for in-memory database
- Update deprecated transitive dependencies as main packages update

## License

MIT
