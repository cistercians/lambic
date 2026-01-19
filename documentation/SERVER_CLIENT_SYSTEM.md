# Server-Client System Documentation

This document provides a comprehensive breakdown of all systems related to the traffic of information between the server and client in the Lambic game. It examines connection protocols, message types, data synchronization mechanisms, and all communication flows.

## Table of Contents

1. [Connection Architecture](#1-connection-architecture)
2. [Message Protocol](#2-message-protocol)
3. [Client-to-Server Messages](#3-client-to-server-messages)
4. [Server-to-Client Messages](#4-server-to-client-messages)
5. [Data Synchronization](#5-data-synchronization)
6. [Initialization Flow](#6-initialization-flow)
7. [Authentication System](#7-authentication-system)
8. [Game State Management](#8-game-state-management)
9. [Special Communication Patterns](#9-special-communication-patterns)
10. [Error Handling & Edge Cases](#10-error-handling--edge-cases)
11. [Performance Considerations](#11-performance-considerations)

---

## 1. Connection Architecture

### Protocol

The server-client communication uses **SockJS** (version 0.3.24), a WebSocket-like API that provides a cross-browser JavaScript library for establishing low-latency, full-duplex communication channels between web browsers and servers.

**Key Characteristics:**
- Bidirectional real-time communication
- Falls back to HTTP polling if WebSockets unavailable
- Provides WebSocket-like API with automatic reconnection
- JSON-based message format

### Server Setup

The SockJS server is initialized in [`lambic.js`](lambic.js) at approximately line 6329:

```javascript
io = sockjs.createServer();
io.installHandlers(serv, { prefix: '/io' });
```

The server is bound to the `/io` endpoint and listens on port 2000 (default Express server port). The SockJS server is created before world initialization to ensure the connection endpoint is ready when clients attempt to connect.

**Connection Tracking:**
- All active socket connections are stored in `SOCKET_LIST` object
- Key: Socket ID (typically matches player ID after authentication)
- Value: Socket connection object
- Located in `lambic.js` (global scope)

### Client Setup

Client-side socket connection is managed by [`client/js/core/SocketManager.js`](client/js/core/SocketManager.js):

```javascript
var newSocket = SockJS('http://localhost:2000/io');
```

The socket is stored in both:
- Global `window.socket` variable
- Local `socket` variable for backward compatibility

**Connection Initialization:**
- Socket connection is established on page load via `initSocket()`
- Automatic connection cleanup on page unload
- Reconnection logic handled by SockJS library

### Connection Lifecycle

**1. Connection Establishment:**
```
Client → Server: SockJS handshake
Server → Client: Connection established
Client: socket.onopen event fires
Client: Immediately requests previewData
```

**2. Connection Maintenance:**
- Connection remains open during entire game session
- Server monitors connections via `SOCKET_LIST`
- Automatic cleanup of disconnected sockets

**3. Connection Cleanup:**
- **Server-side**: Handled in `socket.on('close')` handler (line ~8845)
  - Removes socket from `SOCKET_LIST`
  - Cleans up spectator entries
  - Calls `Player.onDisconnect()` to handle player cleanup
  
- **Client-side**: Handled in `SocketManager.cleanup()`
  - Unregisters all event listeners
  - Closes socket connection
  - Resets `selfId` to null

### Connection Management

**Server Connection Management:**
- `SOCKET_LIST`: Global object tracking all active connections
- Socket ID used as key (matches player ID after authentication)
- Direct socket access via `SOCKET_LIST[socket.id]`

**Client Connection Management:**
- Socket stored in global `window.socket`
- Connection state tracked via `socket.onopen`, `socket.onclose`, `socket.onerror`
- Message queue for messages received before handlers are ready

---

## 2. Message Protocol

### Message Format

All messages are JSON objects with the following structure:

```javascript
{
  msg: 'messageType',  // Required: identifies message type
  ...data              // Optional: message-specific data
}
```

### Message Encoding

- **Encoding**: UTF-8 JSON strings
- **Serialization**: `JSON.stringify()` on send
- **Deserialization**: `JSON.parse()` on receive
- **Transport**: SockJS binary/text frames

### Bidirectional Communication

**Client → Server:**
- Messages sent via `socket.send(JSON.stringify(data))`
- Handled in server's `socket.on('data', function(string) { ... })` handler
- Located in `lambic.js` around line 6557

**Server → Client:**
- Messages sent via `socket.write(JSON.stringify(data))`
- Broadcast messages sent via `emit(data)` function (line ~907)
- Handled in client's `socket.onmessage` event handler
- Routed through `SocketMessageHandler.handle(data)`

### Broadcast Function

The server uses an `emit()` function for broadcasting messages to all connected clients:

```javascript
function emit(data) {
  const jsonData = JSON.stringify(data);
  for (const i in SOCKET_LIST) {
    const socket = SOCKET_LIST[i];
    if (socket && typeof socket.write === 'function') {
      socket.write(jsonData);
    }
  }
}
```

This function:
- Serializes data once
- Iterates through all sockets in `SOCKET_LIST`
- Sends to all connected clients
- Used for game state updates, chat messages, etc.

---

## 3. Client-to-Server Messages

All client-initiated messages are documented below, organized by category.

### Authentication Messages

**`signIn`**
- **Purpose**: Authenticate existing user and join game
- **Source**: [`client/js/core/LoginHandler.js`](client/js/core/LoginHandler.js)
- **Format**:
  ```javascript
  {
    msg: 'signIn',
    name: string,      // Username
    password: string   // Password (plaintext)
  }
  ```
- **Server Handler**: Line ~6645 in `lambic.js`
- **Response**: `signInResponse` message

**`signUp`**
- **Purpose**: Create new user account
- **Source**: [`client/js/core/LoginHandler.js`](client/js/core/LoginHandler.js)
- **Format**:
  ```javascript
  {
    msg: 'signUp',
    name: string,      // Desired username
    password: string   // Password (plaintext)
  }
  ```
- **Server Handler**: Line ~6666 in `lambic.js`
- **Response**: `signUpResponse` message

**`spectate`**
- **Purpose**: Enter spectate mode (view-only, no player entity)
- **Source**: [`client/js/core/LoginHandler.js`](client/js/core/LoginHandler.js)
- **Format**:
  ```javascript
  {
    msg: 'spectate',
    name: string,      // Spectator name
    password: string   // Authentication password
  }
  ```
- **Server Handler**: Line ~6680 in `lambic.js`
- **Response**: `spectateResponse` message

**`requestPreviewData`**
- **Purpose**: Request world data for login screen preview (pre-authentication)
- **Source**: [`client/js/core/SocketManager.js`](client/js/core/SocketManager.js) line 82
- **Format**:
  ```javascript
  {
    msg: 'requestPreviewData'
  }
  ```
- **Server Handler**: Line ~6561 in `lambic.js`
- **Response**: `previewData` message

### Input & Movement Messages

**`keyPress`**
- **Purpose**: Send keyboard input state changes
- **Source**: [`client/js/core/InputHandler.js`](client/js/core/InputHandler.js)
- **Format**:
  ```javascript
  {
    msg: 'keyPress',
    inputId: string,   // Key identifier ('up', 'down', 'left', 'right', 'e', 't', 'i', etc.)
    state: boolean     // true = pressed, false = released
  }
  ```
- **Server Handler**: Line ~6781 in `lambic.js`
- **Note**: Handles special cases for ship navigation controls

**`clickNavigate`**
- **Purpose**: Right-click navigation to specific tile
- **Source**: [`client/js/client.js`](client/js/client.js) various locations
- **Format**:
  ```javascript
  {
    msg: 'clickNavigate',
    tileX: number,     // Target tile column
    tileY: number,     // Target tile row
    z: number          // Z-level (0=overworld, -1=cave, 1=building, etc.)
  }
  ```
- **Server Handler**: Line ~6866 in `lambic.js`
- **Note**: Triggers pathfinding calculation on server

**`attackMove`**
- **Purpose**: Attack-move command (A+left-click on terrain)
- **Source**: [`client/js/client.js`](client/js/client.js) line ~1268
- **Format**:
  ```javascript
  {
    msg: 'attackMove',
    tileX: number,     // Target tile column
    tileY: number,     // Target tile row
    z: number          // Z-level
  }
  ```
- **Server Handler**: Line ~7487 in `lambic.js`
- **Note**: Player moves to location and auto-attacks enemies encountered

**`workAtTile`**
- **Purpose**: Work command (F key + right-click on workable tile)
- **Source**: [`client/js/client.js`](client/js/client.js) line ~1432
- **Format**:
  ```javascript
  {
    msg: 'workAtTile',
    tileX: number,     // Target tile column
    tileY: number,     // Target tile row
    z: number          // Z-level
  }
  ```
- **Server Handler**: Line ~7103 in `lambic.js`
- **Note**: Supports chopping, mining, farming, fishing, building

### Combat Messages

**`selectTarget`**
- **Purpose**: Select target entity (left-click)
- **Source**: [`client/js/client.js`](client/js/client.js) line ~1239
- **Format**:
  ```javascript
  {
    msg: 'selectTarget',
    targetId: string   // Entity ID
  }
  ```
- **Server Handler**: Line ~7286 in `lambic.js`

**`engageCombat`**
- **Purpose**: Engage in combat with target (right-click or A+left-click on enemy)
- **Source**: [`client/js/client.js`](client/js/client.js) line ~1224
- **Format**:
  ```javascript
  {
    msg: 'engageCombat',
    targetId: string   // Enemy entity ID
  }
  ```
- **Server Handler**: Line ~7291 in `lambic.js`
- **Note**: Starts combat system, reveals stealthed targets

### Interaction Messages

**`interact`**
- **Purpose**: Interact with building (right-click)
- **Source**: [`client/js/client.js`](client/js/client.js)
- **Format**:
  ```javascript
  {
    msg: 'interact',
    buildingId: string // Building entity ID
  }
  ```
- **Server Handler**: Line ~7325 in `lambic.js`

**`interactWithPath`**
- **Purpose**: Interact with entity using pathfinding to adjacent tile
- **Source**: [`client/js/client.js`](client/js/client.js)
- **Format**:
  ```javascript
  {
    msg: 'interactWithPath',
    entityType: string,  // 'building', 'item', or 'ship'
    entityId: string     // Entity ID
  }
  ```
- **Server Handler**: Line ~7336 in `lambic.js`
- **Note**: Automatically pathfinds to adjacent walkable tile before interacting

### Inventory Messages

**`equipItem`**
- **Purpose**: Equip item from inventory
- **Source**: [`client/js/ui/InventoryHandler.js`](client/js/ui/InventoryHandler.js) line 189
- **Format**:
  ```javascript
  {
    msg: 'equipItem',
    itemType: string    // Item type identifier
  }
  ```
- **Server Handler**: Handled via `evalCmd` system (`/equip` command)

**`unequipItem`**
- **Purpose**: Unequip item from gear slot
- **Source**: [`client/js/ui/CharacterDisplayUI.js`](client/js/ui/CharacterDisplayUI.js) line 359
- **Format**:
  ```javascript
  {
    msg: 'unequipItem',
    slot: string        // Gear slot name ('weapon', 'armor', etc.)
  }
  ```
- **Server Handler**: Handled via `evalCmd` system (`/unequip` command)

**`dropItem`**
- **Purpose**: Drop item from inventory
- **Source**: [`client/js/client.js`](client/js/client.js) line ~797, [`client/js/ui/InventoryHandler.js`](client/js/ui/InventoryHandler.js) line 266
- **Format**:
  ```javascript
  {
    msg: 'dropItem',
    itemType: string,   // Item type identifier
    quantity: number    // Quantity to drop
  }
  ```
- **Server Handler**: Handled via `evalCmd` system (`/drop` command)

**`useItem`**
- **Purpose**: Use consumable item
- **Source**: [`client/js/ui/InventoryHandler.js`](client/js/ui/InventoryHandler.js) line 192
- **Format**:
  ```javascript
  {
    msg: 'useItem',
    itemType: string    // Item type identifier
  }
  ```
- **Server Handler**: Handled via `evalCmd` system

### Chat Messages

**`msgToServer`**
- **Purpose**: Send chat message to all players
- **Source**: [`client/js/client.js`](client/js/client.js)
- **Format**:
  ```javascript
  {
    msg: 'msgToServer',
    name: string,       // Player name (display name)
    message: string     // Chat message text
  }
  ```
- **Server Handler**: Line ~7570 in `lambic.js`
- **Note**: Triggers NPC conversation system if NPCs nearby

**`pmToServer`**
- **Purpose**: Send private message to specific player
- **Source**: [`client/js/client.js`](client/js/client.js)
- **Format**:
  ```javascript
  {
    msg: 'pmToServer',
    recip: string,      // Recipient username
    message: string     // Private message text
  }
  ```
- **Server Handler**: Line ~7765 in `lambic.js`

**`spectatorChat`**
- **Purpose**: Send chat message visible only to other spectators
- **Source**: [`client/js/client.js`](client/js/client.js)
- **Format**:
  ```javascript
  {
    msg: 'spectatorChat',
    message: string     // Chat message text
  }
  ```
- **Server Handler**: Line ~6754 in `lambic.js`

### UI Request Messages

**`requestBuildMenu`**
- **Purpose**: Request building menu data
- **Source**: [`client/js/core/UIEventHandlers.js`](client/js/core/UIEventHandlers.js) line 359, [`client/js/core/InputHandler.js`](client/js/core/InputHandler.js) line 399
- **Format**:
  ```javascript
  {
    msg: 'requestBuildMenu'
  }
  ```
- **Server Handler**: Line ~7795 in `lambic.js`
- **Response**: `buildMenuData` message

**`requestWorldMap`**
- **Purpose**: Request world map data
- **Source**: [`client/js/core/InputHandler.js`](client/js/core/InputHandler.js) line 155
- **Format**:
  ```javascript
  {
    msg: 'requestWorldMap'
  }
  ```
- **Server Handler**: Line ~7974 in `lambic.js`
- **Response**: `worldMapData` message

**`requestCaveMap`**
- **Purpose**: Request cave map data
- **Source**: [`client/js/core/InputHandler.js`](client/js/core/InputHandler.js) line 165
- **Format**:
  ```javascript
  {
    msg: 'requestCaveMap'
  }
  ```
- **Server Handler**: Line ~8010 in `lambic.js`
- **Response**: `caveMapData` message

**`getResourceScoreboard`**
- **Purpose**: Request faction resource scoreboard data
- **Source**: [`client/js/client.js`](client/js/client.js) line ~892
- **Format**:
  ```javascript
  {
    msg: 'getResourceScoreboard'
  }
  ```
- **Server Handler**: Line ~7559 in `lambic.js`
- **Response**: `resourceScoreboard` or `resourceScoreboardUpdate` message

### Building & Construction Messages

**`startBuildPreview`**
- **Purpose**: Start building preview mode
- **Source**: Client building UI
- **Format**:
  ```javascript
  {
    msg: 'startBuildPreview',
    buildingType: string  // Building type identifier
  }
  ```
- **Server Handler**: Line ~7904 in `lambic.js`
- **Response**: `buildPreviewData` message

**`requestBuildValidation`**
- **Purpose**: Request building placement validation at specific tile
- **Source**: Client building UI
- **Format**:
  ```javascript
  {
    msg: 'requestBuildValidation',
    buildingType: string,  // Building type identifier
    tileX: number,         // Tile column
    tileY: number          // Tile row
  }
  ```
- **Server Handler**: Line ~7925 in `lambic.js`
- **Response**: `buildValidationData` message

**`buildAt`**
- **Purpose**: Execute build command at specific tile coordinates
- **Source**: Client building UI
- **Format**:
  ```javascript
  {
    msg: 'buildAt',
    buildingType: string,  // Building type identifier
    tileX: number,         // Tile column
    tileY: number          // Tile row
  }
  ```
- **Server Handler**: Line ~7961 in `lambic.js`
- **Note**: Executes `/build` command via `evalCmd` system

### Market Messages

**`marketBuy`**
- **Purpose**: Buy items from market
- **Source**: [`client/js/core/UIEventHandlers.js`](client/js/core/UIEventHandlers.js) line 405
- **Format**:
  ```javascript
  {
    msg: 'evalCmd',
    cmd: string  // '/buy <amount> <item> <price>'
  }
  ```
- **Server Handler**: Handled via `evalCmd` system
- **Note**: Uses generic `evalCmd` message format

**`marketSell`**
- **Purpose**: Sell items to market
- **Source**: [`client/js/core/UIEventHandlers.js`](client/js/core/UIEventHandlers.js) line 435
- **Format**:
  ```javascript
  {
    msg: 'evalCmd',
    cmd: string  // '/sell <amount> <item> <price>'
  }
  ```
- **Server Handler**: Handled via `evalCmd` system

**`marketCancel`**
- **Purpose**: Cancel market order
- **Source**: Client market UI
- **Format**:
  ```javascript
  {
    msg: 'evalCmd',
    cmd: string  // '/marketcancel <orderId>'
  }
  ```
- **Server Handler**: Handled via `evalCmd` system

### Dock & Ship Messages

Dock and ship interaction messages are handled through the dock UI system:
- **Source**: [`client/js/ui/DockUI.js`](client/js/ui/DockUI.js)
- **Format**: Various messages sent via `socket.send()` with dock-specific data
- **Server Handler**: Handled via `evalCmd` system and ship-specific handlers

### Camera Updates

**`cameraUpdate`**
- **Purpose**: Send camera/viewer position updates for spatial filtering
- **Source**: [`client/js/utils/CameraHelper.js`](client/js/utils/CameraHelper.js), various camera systems
- **Format**:
  ```javascript
  {
    msg: 'cameraUpdate',
    cameraId: string,        // Camera identifier ('godmode', 'spectate', 'login', or player ID)
    x: number,               // Camera X position
    y: number,               // Camera Y position
    z: number,               // Camera Z-level
    mode: string,            // Camera mode ('player', 'godmode', 'spectate', 'login')
    locked: boolean,         // Whether camera is locked to a target
    lockedToEntityId: string,// Entity ID camera is locked to (optional)
    ownerPlayerId: string,   // Associated player ID (null for spectators)
    context: object          // Additional context (battleground info, etc.)
  }
  ```
- **Server Handler**: Line ~7331 in `lambic.js`
- **Note**: Updates Camera entity registry for spatial filtering, replaces player position-based filtering

### Command Execution

**`evalCmd`**
- **Purpose**: Execute server-side command (generic command interface)
- **Source**: [`client/js/client.js`](client/js/client.js) line ~878
- **Format**:
  ```javascript
  {
    msg: 'evalCmd',
    cmd: string  // Command string (e.g., '/teleport 100 200', '/spawn item sword')
  }
  ```
- **Server Handler**: Line ~6769 in `lambic.js`
- **Note**: Routes to command system (`EvalCmd` function)
- **Security**: Commands are validated and executed server-side

---

## 4. Server-to-Client Messages

All server-initiated messages are documented below, organized by category.

### Authentication Response Messages

**`previewData`**
- **Purpose**: Send world data for login screen preview
- **Server Source**: Line ~6561 in `lambic.js`
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 88
- **Format**:
  ```javascript
  {
    msg: 'previewData',
    world: array,          // World tilemap data
    tileSize: number,      // Tile size in pixels
    mapSize: number,       // Map size in tiles
    tempus: string,        // Current time phase
    nightfall: boolean,    // Is it night?
    pack: {                // Entity packs for preview
      player: array,       // NPCs and falcons for cinematic camera
      item: array,
      building: array
    }
  }
  ```

**`signInResponse`**
- **Purpose**: Response to sign-in attempt
- **Server Source**: Line ~6653 in `lambic.js`
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 199
- **Format**:
  ```javascript
  {
    msg: 'signInResponse',
    success: boolean,      // Authentication result
    world: array,          // World tilemap data (if success)
    tileSize: number,      // Tile size in pixels (if success)
    mapSize: number,       // Map size in tiles (if success)
    tempus: string,        // Current time phase (if success)
    nightfall: boolean     // Is it night? (if success)
  }
  ```

**`spectateResponse`**
- **Purpose**: Response to spectate mode request
- **Server Source**: Line ~6704 in `lambic.js`
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 266
- **Format**:
  ```javascript
  {
    msg: 'spectateResponse',
    success: boolean,      // Authentication result
    world: array,          // World tilemap data (if success)
    tileSize: number,      // Tile size in pixels (if success)
    mapSize: number,       // Map size in tiles (if success)
    tempus: string         // Current time phase (if success)
  }
  ```

**`signUpResponse`**
- **Purpose**: Response to sign-up attempt
- **Server Source**: Line ~6672 in `lambic.js`
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 337
- **Format**:
  ```javascript
  {
    msg: 'signUpResponse',
    success: boolean       // Registration result
  }
  ```

### Game State Initialization

**`init`**
- **Purpose**: Full game state initialization (sent after authentication)
- **Server Source**: Line ~5026 in `lambic.js` (for players), line ~6721 (for spectators)
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 755
- **Format**:
  ```javascript
  {
    msg: 'init',
    selfId: string,        // Player's entity ID (null for spectators)
    pack: {
      player: array,       // All player entities (full state)
      arrow: array,        // All arrow entities
      item: array,         // All item entities
      light: array,        // All light entities
      building: array      // All building entities
    }
  }
  ```
- **Note**: Client clears all existing entities and creates new ones from init pack

### Periodic Update Messages

**`update`**
- **Purpose**: Periodic game state updates (sent every frame at 60 FPS)
- **Server Source**: [`server/js/core/OptimizedGameLoop.js`](server/js/core/OptimizedGameLoop.js) line 376
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 901
- **Format**:
  ```javascript
  {
    msg: 'update',
    pack: {
      player: array,       // Player entity updates (delta)
      arrow: array,        // Arrow entity updates
      item: array,         // Item entity updates
      light: array,        // Light entity updates
      building: array,     // Building entity updates
      weather: array,      // Weather entity updates
      camera: array        // Camera/viewer updates
    }
  }
  ```
- **Frequency**: In-view entities are sent every frame; out-of-view entities can be sent less frequently
- **Optimization**: Spatial filtering, delta compression, frequency optimization

**`remove`**
- **Purpose**: Entity removal notifications
- **Server Source**: Generated when entities are deleted
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 1275
- **Format**:
  ```javascript
  {
    msg: 'remove',
    pack: {
      player: array,       // Array of entity IDs to remove
      arrow: array,
      item: array,
      light: array,
      building: array
    }
  }
  ```

### Time & Environment Messages

**`tempus`**
- **Purpose**: Time/weather synchronization (day/night cycle)
- **Server Source**: Line ~6277 in `lambic.js`, sent when tempus changes
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 1303
- **Format**:
  ```javascript
  {
    msg: 'tempus',
    tempus: string,        // Current time phase (e.g., 'IV.a', 'VIII.p')
    nightfall: boolean     // Is it night?
  }
  ```
- **Note**: Triggers music/ambience updates on client

**`bgm`**
- **Purpose**: Background music change notification
- **Server Source**: Various locations when player changes location/state
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 21
- **Format**:
  ```javascript
  {
    msg: 'bgm',
    x: number,             // Player X position
    y: number,             // Player Y position
    z: number,             // Z-level
    b: number              // Building ID (optional, if indoors)
  }
  ```

### Chat Messages

**`addToChat`**
- **Purpose**: Add message to chat display
- **Server Source**: Various locations via `socket.write(JSON.stringify({msg: 'addToChat', message: ...}))`
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 345
- **Format**:
  ```javascript
  {
    msg: 'addToChat',
    message: string        // HTML-formatted chat message
  }
  ```

**`spectatorChatMessage`**
- **Purpose**: Chat message visible only to spectators
- **Server Source**: Line ~6762 in `lambic.js`
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 409
- **Format**:
  ```javascript
  {
    msg: 'spectatorChatMessage',
    message: string        // HTML-formatted chat message
  }
  ```

**`npcSpeaking`**
- **Purpose**: NPC speech bubble display
- **Server Source**: NPC dialogue system
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 396
- **Format**:
  ```javascript
  {
    msg: 'npcSpeaking',
    id: string,            // NPC entity ID
    show: boolean          // Show or hide speech bubble
  }
  ```

**`spectatorEvent`**
- **Purpose**: Game event for spectator camera director
- **Server Source**: Event system
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 424
- **Format**:
  ```javascript
  {
    msg: 'spectatorEvent',
    event: object          // Event data for camera director
  }
  ```

### UI Data Messages

**`buildMenuData`**
- **Purpose**: Building menu data response
- **Server Source**: Line ~7797 in `lambic.js`
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 451
- **Format**:
  ```javascript
  {
    msg: 'buildMenuData',
    buildings: array,      // Available building types with costs
    playerWood: number,    // Player's wood resource
    playerStone: number    // Player's stone resource
  }
  ```

**`worldMapData`**
- **Purpose**: World map data response
- **Server Source**: Line ~7992 in `lambic.js`
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 431
- **Format**:
  ```javascript
  {
    msg: 'worldMapData',
    terrain: array,        // Terrain tilemap data
    mapSize: number,       // Map size in tiles
    playerX: number,       // Player X position
    playerY: number,       // Player Y position
    playerZ: number,       // Player Z-level
    tileSize: number,      // Tile size in pixels
    features: array        // Geographic features
  }
  ```

**`caveMapData`**
- **Purpose**: Cave map data response
- **Server Source**: Line ~8033 in `lambic.js`
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 441
- **Format**:
  ```javascript
  {
    msg: 'caveMapData',
    terrain: array,        // Cave terrain tilemap data
    blockingItems: object, // Items blocking tiles
    mapSize: number,       // Map size in tiles
    playerX: number,       // Player X position
    playerY: number,       // Player Y position
    playerZ: number,       // Player Z-level
    tileSize: number       // Tile size in pixels
  }
  ```

**`buildPreviewData`**
- **Purpose**: Building preview data for cursor-following preview
- **Server Source**: Line ~7916 in `lambic.js`
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 476
- **Format**:
  ```javascript
  {
    msg: 'buildPreviewData',
    buildingType: string,  // Building type identifier
    valid: array,          // Valid placement tiles
    clearable: array,      // Clearable tiles
    blocked: array         // Blocked tiles
  }
  ```

**`buildValidationData`**
- **Purpose**: Building placement validation at specific tile
- **Server Source**: Line ~7951 in `lambic.js`
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 483
- **Format**:
  ```javascript
  {
    msg: 'buildValidationData',
    buildingType: string,  // Building type identifier
    tileX: number,         // Tile column
    tileY: number,         // Tile row
    plot: array,           // Plot tiles with statuses
    canBuild: boolean      // Can build at this location?
  }
  ```

**`resourceScoreboard` / `resourceScoreboardUpdate`**
- **Purpose**: Faction resource scoreboard data
- **Server Source**: Line ~7566 in `lambic.js`
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 468
- **Format**:
  ```javascript
  {
    msg: 'resourceScoreboard' | 'resourceScoreboardUpdate',
    data: object           // Faction resource data
  }
  ```

### Interaction UI Messages

**`openMarket`**
- **Purpose**: Open market UI with orderbook data
- **Server Source**: Market interaction system
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 529
- **Format**:
  ```javascript
  {
    msg: 'openMarket',
    orderbook: object,     // Market orderbook data
    playerInventory: object // Player inventory
  }
  ```

**`openDock`**
- **Purpose**: Open dock UI with ship data
- **Server Source**: Dock interaction system
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 542
- **Format**:
  ```javascript
  {
    msg: 'openDock',
    ships: array,          // Available ships
    playerInventory: object // Player inventory
  }
  ```

**`openDeposit`**
- **Purpose**: Open deposit UI with building and resource data
- **Server Source**: Building deposit interaction
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 555
- **Format**:
  ```javascript
  {
    msg: 'openDeposit',
    buildingId: string,    // Building ID
    buildingType: string,  // Building type
    stores: object,        // Building resource stores
    playerInventory: object // Player inventory
  }
  ```

**`openChest`**
- **Purpose**: Open chest inventory window
- **Server Source**: Chest interaction system
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 568
- **Format**:
  ```javascript
  {
    msg: 'openChest',
    chestId: string,       // Chest entity ID
    chestType: string,     // Chest type ('Chest' or 'LockedChest')
    inventory: object,     // Chest inventory
    playerInventory: object // Player inventory
  }
  ```

**`openHouseCreation`**
- **Purpose**: Open house creation UI
- **Server Source**: House creation system
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 588
- **Format**:
  ```javascript
  {
    msg: 'openHouseCreation',
    availableFlags: array  // Available faction flags
  }
  ```

### State Change Messages

**`gearUpdate`**
- **Purpose**: Equipment/inventory/class update notification
- **Server Source**: Equipment change events
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 493
- **Format**:
  ```javascript
  {
    msg: 'gearUpdate',
    gear: object,          // Updated gear object
    inventory: object,     // Updated inventory object
    class: string          // Updated class (optional)
  }
  ```

**`ghostMode`**
- **Purpose**: Ghost mode state change (death/respawn)
- **Server Source**: Line ~2833, ~2906 in `lambic.js`
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 1360
- **Format**:
  ```javascript
  {
    msg: 'ghostMode',
    active: boolean        // true = entering ghost mode, false = respawning
  }
  ```

**`godMode`**
- **Purpose**: God mode camera state change
- **Server Source**: God mode command system
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 1335
- **Format**:
  ```javascript
  {
    msg: 'godMode',
    active: boolean,       // true = entering, false = exiting
    cameraX: number,       // Camera X position (if entering)
    cameraY: number,       // Camera Y position (if entering)
    cameraZ: number,       // Camera Z-level (if entering)
    factionHQs: array      // Faction headquarters (if entering)
  }
  ```

**`newFaction`**
- **Purpose**: Faction data update (houses/kingdoms)
- **Server Source**: Line ~5020 in `lambic.js`, sent on connection and when factions change
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 1533
- **Format**:
  ```javascript
  {
    msg: 'newFaction',
    houseList: object,     // House list data
    kingdomList: object    // Kingdom list data
  }
  ```

### Ship & Boarding Messages

**`boardShip`**
- **Purpose**: Player boarding ship notification
- **Server Source**: Ship boarding system
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 658
- **Format**:
  ```javascript
  {
    msg: 'boardShip',
    shipId: string,        // Ship entity ID
    isNavigator: boolean   // Is player the navigator?
  }
  ```

**`disembarkShip`**
- **Purpose**: Player disembarking ship notification
- **Server Source**: Ship disembark system
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 597
- **Format**:
  ```javascript
  {
    msg: 'disembarkShip',
    newSelfId: string      // Player entity ID after disembark
  }
  ```

**`fishCatch`**
- **Purpose**: Fish catch notification (visual feedback)
- **Server Source**: Fishing system
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 640
- **Format**:
  ```javascript
  {
    msg: 'fishCatch',
    emoji: string          // Emoji to display (e.g., '🐟')
  }
  ```

### Map Edit Messages

**`tileEdit`**
- **Purpose**: Single tile change notification
- **Server Source**: Line ~860 in `lambic.js` (via `emit()`)
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 731
- **Format**:
  ```javascript
  {
    msg: 'tileEdit',
    l: number,             // Layer index
    c: number,             // Column
    r: number,             // Row
    tile: number           // New tile value
  }
  ```

**`layerEdit`**
- **Purpose**: Entire layer change notification
- **Server Source**: Layer modification system
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 737
- **Format**:
  ```javascript
  {
    msg: 'layerEdit',
    l: number,             // Layer index
    layer: array           // New layer data
  }
  ```

**`mapEdit`**
- **Purpose**: Complete world map change notification
- **Server Source**: Full map modification
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 741
- **Format**:
  ```javascript
  {
    msg: 'mapEdit',
    world: array           // New world data
  }
  ```

**`buildingPreview`**
- **Purpose**: Building preview rendering data
- **Server Source**: Building preview system
- **Client Handler**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) line 745
- **Format**:
  ```javascript
  {
    msg: 'buildingPreview',
    // Building preview data
  }
  ```

---

## 5. Data Synchronization

### Entity Synchronization Overview

The game uses a two-phase synchronization approach:
1. **Init Pack**: Full entity state sent once on connection
2. **Update Pack**: Delta updates sent every frame (60 FPS)

### Entity Types

The following entity types are synchronized:
- **Players**: Player characters, NPCs, ships, fauna (deer, boar, wolf, falcon, sheep)
- **Arrows**: Projectiles in flight
- **Items**: Dropped items, chests, containers
- **Lights**: Light sources (torches, fires, etc.)
- **Buildings**: Structures, interactable buildings
- **Weather**: Weather effects (fog, storms)

### Init Pack System

**Purpose**: Send complete entity state when client first connects.

**Server Methods**: Each entity type has a `getAllInitPack()` static method:
- `Player.getAllInitPack()` - Line ~5058 in `lambic.js`
- `Arrow.getAllInitPack()` - Line ~10543 in `lambic.js`
- `Item.getAllInitPack()` - Line ~10697 in `lambic.js`
- `Light.getAllInitPack()` - Line ~13171 in `lambic.js`
- `Building.getAllInitPack()` - Line ~1797 in `server/js/Entity.js`

**Client Handling**: Entities are created from init pack in `SocketMessageHandler.handleInit()` (line 755).

**Format**: Arrays of full entity data objects (all properties included).

### Update Pack System

**Purpose**: Send incremental changes every frame.

**Server Methods**: Each entity type has a `getUpdatePack()` instance method that returns only changed properties:
- `Player.getUpdatePack()` - Line ~4773 in `lambic.js`
- `Arrow.getUpdatePack()` - Line ~10509 in `lambic.js`
- `Item.getUpdatePack()` - Line ~10608 in `lambic.js`
- `Light.getUpdatePack()` - Line ~13136 in `lambic.js`
- `Building.getUpdatePack()` - Line 252 in `server/js/Entity.js`

**Client Handling**: Entities are updated from update packs in `SocketMessageHandler.handleUpdate()` (line 901).

**Format**: Arrays of partial entity data objects (only changed properties).

### Update Optimization Mechanisms

#### Spatial Filtering

**Purpose**: Only send entities near players to reduce bandwidth.

**Implementation**: [`server/js/core/OptimizedGameLoop.js`](server/js/core/OptimizedGameLoop.js) line 214
- Filter radius: 1500 pixels (viewport is ~1000 pixels)
- Entities outside radius excluded from update packs
- Always includes viewer's own entity
- Always includes falcons (for smooth flight)

**Code Location**: `spatialFilterEntities()` method in `OptimizedGameLoop`

#### Delta Compression

**Purpose**: Track previous entity states and only send changed properties.

**Implementation**: [`server/js/core/OptimizedGameLoop.js`](server/js/core/OptimizedGameLoop.js) line 38-39
- Previous states stored in `previousEntityStates` Map
- Only properties that changed are included in update pack
- Reduces packet size significantly for stationary entities

**Code Location**: `compressEntityPack()` method in `OptimizedGameLoop`

#### Frequency Optimization

**Purpose**: Send non-critical entity updates less frequently.

**Implementation**: [`server/js/core/OptimizedGameLoop.js`](server/js/core/OptimizedGameLoop.js) line 217-244
- **Critical entities** (60 FPS): Players, entities in combat, entities with paths, falcons
- **Non-critical entities** (30 FPS): Idle NPCs, stationary entities
- Non-critical updates sent every 2nd frame
- Reduces bandwidth by ~50% for idle NPCs

**Code Location**: `sendUpdates()` method in `OptimizedGameLoop`

#### Packet Splitting

**Purpose**: Split large packets across multiple frames to avoid overwhelming clients.

**Implementation**: [`server/js/core/OptimizedGameLoop.js`](server/js/core/OptimizedGameLoop.js) line 307-335
- Maximum packet size: 20 KB
- Large packets split into chunks
- First chunk sent immediately
- Remaining chunks queued and sent one per frame
- Prevents network congestion and client lag spikes

**Code Location**: `sendUpdates()` method in `OptimizedGameLoop`

### Update Loop

#### Server Update Loop

**Location**: [`server/js/core/OptimizedGameLoop.js`](server/js/core/OptimizedGameLoop.js)

**Process**:
1. **Fixed Timestep Update** (60 FPS):
   - Process pathfinding queue
   - Update game state (time, etc.)
   - Update social system
   - Call entity update methods (`Player.update()`, `Arrow.update()`, etc.)
   - Collect update packs
   - Apply optimizations (spatial filtering, delta compression, frequency optimization)
   - Check packet size and split if needed
   - Send update packets via `emit()`

2. **Render Update** (variable timestep):
   - Update viewport bounds
   - Send render update packets (FPS stats, etc.)

**Entity Update Methods**:
- `Player.update()` - Line ~5130 in `lambic.js` (coordinator function)
- `Arrow.update()` - Arrow entity updates
- `Item.update()` - Item entity updates
- `Light.update()` - Light entity updates
- `Building.update()` - Building entity updates
- `Weather.getAllUpdatePack()` - Weather entity updates

#### Client Update Processing

**Location**: [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) `handleUpdate()` method (line 901)

**Process**:
1. Receive update packet
2. Iterate through entity update packs
3. Update existing entities or create new ones (fallback)
4. Apply throttling for non-visual updates (500ms interval)
5. Handle sprite updates for class/ghost changes
6. Process weather updates
7. Update UI displays if needed

**Update Throttling**:
- Visual updates (position, movement, combat): Every frame
- Non-visual updates (name, house, kingdom, rank): Every 500ms (2 Hz)
- Exception: Inventory always updates immediately (important for chest transfers)

### Entity Update Pack Contents

#### Player Update Pack
```javascript
{
  id: string,              // Entity ID
  x: number,               // X position
  y: number,               // Y position
  z: number,               // Z-level
  facing: string,          // Facing direction
  angle: number,           // Angle (for ships)
  hp: number,              // Health
  hpMax: number,           // Max health
  spirit: number,          // Spirit
  spiritMax: number,       // Max spirit
  breath: number,          // Breath (underwater)
  breathMax: number,       // Max breath
  pressingUp: boolean,     // Movement input states
  pressingDown: boolean,
  pressingLeft: boolean,
  pressingRight: boolean,
  pressingAttack: boolean,
  working: boolean,        // Activity states
  combat: object,          // Combat state
  fleeing: boolean,
  chopping: boolean,
  mining: boolean,
  farming: boolean,
  building: boolean,
  fishing: boolean,
  stealthed: boolean,      // Visibility states
  revealed: boolean,
  innaWoods: boolean,
  onMtn: boolean,
  class: string,           // Character class
  ghost: boolean,          // Ghost state
  inventory: object,       // Inventory (always updated)
  gear: object,            // Equipment (throttled)
  name: string,            // Name (throttled)
  house: number,           // House ID (throttled)
  kingdom: number,         // Kingdom ID (throttled)
  rank: number,            // Rank (throttled)
  kills: number,           // Kills (throttled)
  skulls: number,          // Skulls (throttled)
  spriteSize: number,      // Sprite size
  spriteScale: number,     // Sprite scale
  isBoarded: boolean,      // Ship boarding state
  boardedShip: string,     // Ship ID if boarded
  sailPoints: object,      // Ship-specific: sail points
  shipMode: string,        // Ship-specific: mode
  shipType: string,        // Ship-specific: type
  action: string           // Current action
}
```

#### Arrow Update Pack
```javascript
{
  id: string,              // Entity ID
  angle: number,           // Angle
  x: number,               // X position
  y: number,               // Y position
  z: number                // Z-level
}
```

#### Item Update Pack
```javascript
{
  id: string,              // Entity ID
  x: number,               // X position
  y: number,               // Y position
  z: number,               // Z-level
  innaWoods: boolean,      // Visibility state
  sunk: boolean            // Sunk state
}
```

#### Light Update Pack
```javascript
{
  id: string,              // Entity ID
  x: number,               // X position
  y: number,               // Y position
  z: number,               // Z-level
  radius: number           // Light radius
}
```

#### Building Update Pack
```javascript
{
  id: string,              // Entity ID
  hp: number,              // Health
  occ: number              // Occupancy count
}
```

#### Weather Update Pack
```javascript
{
  id: string,              // Entity ID
  x: number,               // X position
  y: number,               // Y position
  weatherType: string,     // 'fog' or 'storm'
  intensity: number        // Intensity (0.0-1.0)
}
```

---

## 6. Initialization Flow

The complete initialization flow from client connection to gameplay:

### Phase 1: Connection Establishment

```
1. Client loads page
2. SocketManager.init() creates SockJS connection to 'http://localhost:2000/io'
3. Server accepts connection and assigns socket ID
4. Socket added to SOCKET_LIST
5. Client socket.onopen event fires
```

### Phase 2: Preview Data (Pre-Authentication)

```
1. Client sends: {msg: 'requestPreviewData'}
2. Server responds: {msg: 'previewData', world: ..., pack: {...}}
3. Client receives previewData
4. Client loads world tilemap data
5. Client creates NPC/falcon entities for cinematic camera
6. Login camera system starts
```

### Phase 3: Authentication

**Sign-In Flow**:
```
1. User enters credentials and clicks sign-in
2. Client sends: {msg: 'signIn', name: ..., password: ...}
3. Server validates password via isValidPassword()
4. If valid:
   - Server calls Player.onConnect(socket, name)
   - Server sends: {msg: 'signInResponse', success: true, world: ..., ...}
5. If invalid:
   - Server sends: {msg: 'signInResponse', success: false}
```

**Spectate Flow**:
```
1. User enters credentials and selects spectate
2. Client sends: {msg: 'spectate', name: ..., password: ...}
3. Server validates password
4. If valid:
   - Server creates spectator entry (no Player entity)
   - Server sends: {msg: 'spectateResponse', success: true, world: ..., ...}
5. If invalid:
   - Server sends: {msg: 'spectateResponse', success: false}
```

### Phase 4: World Data Transfer

```
1. Server sends signInResponse/spectateResponse with:
   - world: Complete tilemap data
   - tileSize: Tile size in pixels
   - mapSize: Map size in tiles
   - tempus: Current time phase
   - nightfall: Is it night?
2. Client receives and stores world data
3. Client updates canvas size based on tileSize
4. Client stops login camera (if was playing)
```

### Phase 5: Entity Initialization

```
1. Server sends: {msg: 'init', selfId: ..., pack: {...}}
   - selfId: Player's entity ID (null for spectators)
   - pack: Complete entity state (players, arrows, items, lights, buildings)
2. Client receives init message
3. Client clears all existing entities
4. Client creates new entities from init pack:
   - Player entities created via new Player(data)
   - Arrow entities created via new Arrow(data)
   - Item entities created via new Item(data)
   - Light entities created via new Light(data)
   - Building entities created via new Building(data)
5. Client sets selfId from init message
6. Client starts AudioManager (for players)
```

### Phase 6: Gameplay Loop

```
1. Server begins sending update messages every frame (60 FPS)
2. Client processes update messages and updates entities
3. Client renders game state
4. User interacts with game
5. Client sends action messages to server
6. Server processes actions and broadcasts updates
7. Loop continues...
```

### Special Cases

**Spectator Initialization**:
- No `selfId` in init message
- No player entity created
- Spectate camera system activated
- No AudioManager started (music handled by camera)

**Reconnection**:
- If client reconnects, goes through full initialization flow
- Old entities cleared, new entities created
- Player position restored from server state

---

## 7. Authentication System

### Database

User data is stored using the database system in [`server/js/Database.js`](server/js/Database.js).

**Storage Format**: JSON file-based database
- User accounts stored in database
- Passwords stored as plaintext (security consideration)
- Username uniqueness enforced

### Sign-In Flow

**Client**: [`client/js/core/LoginHandler.js`](client/js/core/LoginHandler.js)

**Server**: Line ~6645 in `lambic.js`

**Process**:
1. Client sends `signIn` message with name and password
2. Server calls `isValidPassword(data, callback)`
3. Database checks username and password match
4. If valid:
   - Server calls `Player.onConnect(socket, data.name)`
   - Creates player entity if doesn't exist
   - Loads player data from database
   - Sends `signInResponse` with success: true and world data
5. If invalid:
   - Sends `signInResponse` with success: false

**Player.onConnect()** (Line ~4930 in `lambic.js`):
- Creates or loads player entity
- Sets socket.id as player ID
- Initializes player state
- Sends init pack with all entities
- Sends welcome message

### Sign-Up Flow

**Client**: [`client/js/core/LoginHandler.js`](client/js/core/LoginHandler.js)

**Server**: Line ~6666 in `lambic.js`

**Process**:
1. Client sends `signUp` message with name and password
2. Server calls `isUsernameTaken(data.name, callback)`
3. Database checks if username exists
4. If taken:
   - Sends `signUpResponse` with success: false
5. If available:
   - Server calls `addUser(data, callback)`
   - Creates new user account in database
   - Sends `signUpResponse` with success: true

### Spectate Mode

**Purpose**: View-only mode for observing gameplay without participating.

**Client**: [`client/js/core/LoginHandler.js`](client/js/core/LoginHandler.js)

**Server**: Line ~6680 in `lambic.js`

**Process**:
1. Client sends `spectate` message with name and password
2. Server validates password (same authentication as sign-in)
3. If valid:
   - Creates spectator entry in `global.spectators` object
   - Does NOT create Player entity
   - Sends `spectateResponse` with success: true and world data
   - Sends init pack with all entities (no selfId)
   - Sends spectator welcome message
4. If invalid:
   - Sends `spectateResponse` with success: false

**Spectator Features**:
- Full world visibility
- Camera control (spectate camera system)
- Chat with other spectators
- No player entity
- No game actions allowed

### Authentication State Management

**Server**:
- Socket ID used as player ID after authentication
- `SOCKET_LIST[socket.id]` provides socket access
- `Player.list[socket.id]` provides player entity access
- Spectators tracked separately in `global.spectators`

**Client**:
- `selfId` variable stores player's entity ID
- `window.selfId` provides global access
- `null` for spectators
- Used to identify controlled entity for camera, input, etc.

---

## 8. Game State Management

### Server Game State

**Location**: [`server/js/core/GameState.js`](server/js/core/GameState.js)

**Managed State**:
- World tilemap data (multiple layers)
- Time system (tempus, day/night cycle)
- Entity lists (Player.list, Arrow.list, Item.list, etc.)
- Game configuration (mapSize, tileSize, etc.)

### World Data Structure

The world is represented as a multi-dimensional array:

```javascript
world[layer][row][column] = tileValue
```

**Layers**:
- Layer 0: Overworld terrain (z=0)
- Layer 1: Cave terrain (z=-1)
- Layer 2: Underwater (z=-3)
- Layer 3: Building floor 1 (z=1)
- Layer 4: Building stairs/walls (z=1)
- Layer 5: Building floor 2 (z=2)
- Layer 6: Resource layer (forest density, etc.)
- Layer 7: Mining resources
- Layer 8: Cellar terrain (z=-2)

**Tile Values**: Defined in `TERRAIN` constant (line ~61 in `lambic.js`)
- Water, forest types, rocks, mountains, buildings, etc.

### Tilemap System Integration

**Location**: [`server/js/core/TilemapIntegration.js`](server/js/core/TilemapIntegration.js)

The tilemap system provides:
- Pathfinding matrices for each layer
- Walkability checks
- Pathfinding algorithm integration
- Tile change synchronization

### Time System

**Tempus (Day/Night Cycle)**:
- 24-hour cycle divided into phases (e.g., 'IV.a', 'VIII.p')
- Each phase represents a specific time of day
- Synchronized via `tempus` messages
- Affects music, ambience, NPC behavior, visibility

**Nightfall**:
- Boolean flag indicating if it's night
- Sent with `tempus` messages
- Affects music selection, ambience, gameplay mechanics

**Time Updates**:
- Server updates time in game loop
- Broadcasts `tempus` message when phase changes
- Clients update music/ambience based on time

### Entity Lists

**Global Entity Storage**:
- `Player.list`: All player entities (players, NPCs, ships, fauna)
- `Arrow.list`: All arrow entities
- `Item.list`: All item entities
- `Light.list`: All light entities
- `Building.list`: All building entities
- `Weather.list`: All weather entities

**Entity Access**:
- Entities accessed by ID: `Player.list[entityId]`
- Entities added when created: `Player.list[newId] = newEntity`
- Entities removed when deleted: `delete Player.list[entityId]`

### State Synchronization

**Server → Client**:
- World data sent on connection (signInResponse)
- Entity state sent via init pack
- Entity updates sent via update packets (60 FPS)
- Tile changes broadcast via tileEdit/layerEdit/mapEdit

**Client → Server**:
- Actions sent immediately (clickNavigate, workAtTile, etc.)
- Server validates and applies changes
- Server broadcasts results to all clients

---

## 9. Special Communication Patterns

### Real-time Updates

These messages are sent immediately when events occur:

**Movement Updates**:
- Player position synchronized every frame
- Movement input sent on key press/release
- Pathfinding results sent immediately

**Combat Updates**:
- Combat state synchronized every frame
- Damage calculations server-side
- Combat animations client-side prediction

**Chat Messages**:
- Chat messages broadcast immediately
- No batching or queuing
- Visible to all players in range

**Inventory Changes**:
- Inventory updates sent immediately (no throttling)
- Important for chest transfers and real-time operations
- Gear changes trigger `gearUpdate` message

### Request-Response Patterns

These follow a request → response pattern:

**UI Data Requests**:
- Client requests data: `requestBuildMenu`, `requestWorldMap`, etc.
- Server processes request
- Server sends response: `buildMenuData`, `worldMapData`, etc.
- Client displays data in UI

**Command Execution**:
- Client sends: `{msg: 'evalCmd', cmd: '/command args'}`
- Server executes command via `EvalCmd()` function
- Server sends result via `addToChat` message
- Client displays result in chat

**Interactive Actions**:
- Client sends interaction request: `interact`, `interactWithPath`
- Server validates interaction (proximity, permissions, etc.)
- Server sends UI open message: `openChest`, `openMarket`, etc.
- Client opens appropriate UI

### Event-Driven Messages

These messages are triggered by game events:

**Tile Changes**:
- `tileEdit`: Single tile change (broadcast to all clients)
- `layerEdit`: Entire layer change
- `mapEdit`: Complete world change
- Sent automatically when tile changes occur

**Building Changes**:
- Building state changes trigger building update packs
- Building creation/deletion triggers remove messages
- Building occupancy changes trigger building updates

**Faction Changes**:
- `newFaction`: Sent when houses/kingdoms change
- Includes complete house and kingdom lists
- Sent on connection and when factions update

**NPC Events**:
- `npcSpeaking`: NPC speech bubble display
- Triggered by dialogue system
- Sent to nearby players only

### Broadcast vs. Targeted Messages

**Broadcast Messages** (via `emit()`):
- Sent to all connected clients
- Used for: game state updates, chat, tile changes, time updates
- Examples: `update`, `addToChat`, `tempus`, `tileEdit`

**Targeted Messages** (via `socket.write()`):
- Sent to specific client
- Used for: authentication responses, UI data, player-specific events
- Examples: `signInResponse`, `buildMenuData`, `gearUpdate`, `openChest`

**Area Messages**:
- Sent to players in specific area
- Used for: local chat, NPC speech, nearby events
- Implementation: Iterate through players, check distance, send to nearby

---

## 10. Error Handling & Edge Cases

### Connection Drops

**Server-Side Handling**:
- `socket.on('close')` event handler (line ~8845)
- Removes socket from `SOCKET_LIST`
- Cleans up player entity via `Player.onDisconnect()`
- Removes spectator entry if applicable
- Prevents memory leaks from orphaned connections

**Client-Side Handling**:
- `socket.onclose` event handler in `SocketManager`
- Resets `selfId` to null
- Connection cleanup handled by SockJS library
- Manual reconnection would require page refresh

**Reconnection Behavior**:
- Client must reload page to reconnect
- Goes through full initialization flow
- Server creates new player entity or restores existing
- No automatic reconnection currently implemented

### Message Queuing

**Client-Side Queuing**:
- `pendingMessages` array in `SocketManager.js` (line 8)
- Messages received before `SocketMessageHandler` is ready are queued
- Processed once handler becomes available (max 5 second wait)
- Prevents message loss during initialization

**Server-Side Handling**:
- No message queuing on server
- Messages processed immediately when received
- Invalid messages ignored (no error sent to client)

### Entity Creation from Update Packs

**Fallback Mechanism**:
- If entity doesn't exist on client but appears in update pack
- Client creates entity from update pack data (line 922-989 in `SocketMessageHandler.js`)
- Important for entities created after client connected
- Handles cases where init pack was missed
- Only for fauna entities (Deer, Boar, Wolf, Falcon, Sheep)

**Entity Validation**:
- Client validates entity data before creation
- Skips entities with invalid/missing class property
- Logs warnings for debugging

### Packet Loss Mitigation

**Current Implementation**:
- No explicit packet loss detection
- No sequence numbers or acknowledgments
- Relies on TCP reliability (SockJS over TCP)
- Update packets sent every frame (60 FPS)
- Missing packets result in slightly stale data until next update

**Implicit Recovery**:
- Full state resynchronized every frame via update packets
- Entity removals handled separately via `remove` messages
- Tile changes broadcast immediately (not dependent on update packets)

### Invalid Message Handling

**Server-Side**:
- Messages from non-authenticated connections ignored (except `requestPreviewData`, `signIn`, `signUp`, `spectate`)
- Invalid JSON parsed with try-catch (line 6559)
- Unknown message types logged but not processed
- No error messages sent to client for invalid messages

**Client-Side**:
- Invalid JSON parsed with try-catch (line 46 in `SocketMessageHandler`)
- Unknown message types ignored (no handler matches)
- Missing message properties handled gracefully (optional checks)

### Entity State Desynchronization

**Prevention**:
- Server is authoritative source of truth
- Client predictions corrected by server updates
- Full state resynchronized every frame

**Recovery**:
- Entity updates include all critical state
- Position, health, inventory synchronized every frame
- Client entity state overwritten by server data

**Edge Cases**:
- Client entity missing but server has entity: Created from update pack
- Client entity exists but server removed: Handled via `remove` message
- Entity ID mismatch: Handled by entity ID-based lookup

### Spectator Edge Cases

**No Player Entity**:
- Spectators don't have a player entity
- `selfId` is null for spectators
- Camera system handles spectator mode separately
- No input handling for spectators (except camera controls)

**Spectator Chat**:
- Separate chat channel (`spectatorChat` message)
- Only visible to other spectators
- Stored in `global.spectators` object

### Ship Boarding Edge Cases

**Navigator vs. Passenger**:
- Navigator: Controls ship, `selfId` switches to ship ID
- Passenger: Marked as boarded but `selfId` stays as player ID
- Different message handling for each case

**Disembark Recovery**:
- `disembarkShip` message sent when player disembarks
- `selfId` switched back to player ID
- Player entity made visible again
- Audio updated for new location

---

## 11. Performance Considerations

### Update Throttling Strategies

**Server-Side Throttling**:

1. **Entity Update Frequency** (Line ~5192-5246 in `lambic.js`):
   - Players: Every frame (60 FPS)
   - NPCs in combat or with paths: Every frame
   - Working NPCs: Every 3rd frame (20 FPS)
   - Idle fauna: Every 2nd frame (30 FPS)
   - Idle serfs: Every 4th frame (15 FPS)
   - Idle NPCs: Every 2nd frame (30 FPS)
   - Falcons: Every frame (smooth flight animation)

2. **Update Pack Frequency** (Line ~217-244 in `OptimizedGameLoop.js`):
   - Critical entities: 60 FPS (players, combat, paths, falcons)
   - Non-critical entities: 30 FPS (idle NPCs)

3. **Non-Visual Update Throttling** (Client-side, line ~1114-1127 in `SocketMessageHandler.js`):
   - Visual updates (position, movement): Every frame
   - Non-visual updates (name, house, kingdom): Every 500ms (2 Hz)
   - Exception: Inventory always updates immediately

**Benefits**:
- Reduces server CPU usage for idle entities
- Reduces network bandwidth (~50% for idle NPCs)
- Maintains smooth gameplay for active entities

### Packet Size Management

**Maximum Packet Size**: 20 KB (configurable in `OptimizedGameLoop.js` line 51)

**Packet Splitting**:
- Large packets automatically split into chunks
- First chunk sent immediately
- Remaining chunks queued and sent one per frame
- Prevents network congestion and client lag spikes

**Size Optimization**:
- Delta compression (only changed properties)
- Spatial filtering (only nearby entities)
- Frequency optimization (non-critical entities less frequently)

**Monitoring**:
- Packet sizes tracked in `packetSizeHistory`
- Total bytes sent tracked
- Packet count tracked
- Used for performance analysis

### Network Bandwidth Optimization

**Spatial Filtering** (1500px radius):
- Only entities near players included in updates
- Reduces packet size significantly for large maps
- Viewport is ~1000px, 1500px provides margin

**Delta Compression**:
- Previous entity states tracked
- Only changed properties included
- Reduces packet size for stationary entities

**Frequency Optimization**:
- Critical entities at 60 FPS
- Non-critical entities at 30 FPS
- Reduces bandwidth by ~50% for idle NPCs

**Entity Type Optimization**:
- Different entity types have different update frequencies
- Based on entity activity and importance
- Balances bandwidth and gameplay smoothness

### Client-Side Update Batching

**Update Processing**:
- Updates processed in single batch per frame
- Entity updates applied in order
- Sprite updates batched (only on class/ghost change)
- UI updates deferred until after entity updates

**Performance HUD Integration**:
- Update packets tracked for performance monitoring
- Frame time tracking
- Entity count tracking
- Used for debugging performance issues

### Server-Side Performance Monitoring

**Performance Metrics Tracked**:

1. **Frame Time** (`OptimizedGameLoop.js`):
   - Frame time history (60 samples = 1 second)
   - Average frame time
   - Frame budget tracking (16.67ms for 60 FPS)

2. **Packet Statistics** (`OptimizedGameLoop.js`):
   - Packet size history (300 samples = 5 seconds)
   - Total bytes sent
   - Packet count
   - Average packet size

3. **Entity Update Times** (`lambic.js` line ~5130):
   - Per-entity-type update times
   - Slow entity tracking (>1ms)
   - Entity count by type
   - Performance profiling data

4. **Memory Usage** (`OptimizedGameLoop.js`):
   - Memory history (60 samples = 1 minute)
   - RSS, heap total, heap used, external memory
   - Garbage collection triggers (if available)

**Performance Logging**:
- Logged periodically (once per tempus hour)
- Includes entity counts, update times, packet sizes
- Used for identifying performance bottlenecks

### Optimization Trade-offs

**Latency vs. Bandwidth**:
- Higher update frequency = lower latency but higher bandwidth
- Current: 60 FPS for critical, 30 FPS for non-critical
- Balances responsiveness and network usage

**Accuracy vs. Performance**:
- Full state sync = accurate but expensive
- Delta compression = efficient but more complex
- Current: Delta compression with fallback to full state

**Smoothness vs. CPU Usage**:
- Higher update frequency = smoother but more CPU
- Entity throttling reduces CPU for idle entities
- Maintains smoothness for active gameplay

---

## Conclusion

This document provides a comprehensive overview of all systems related to server-client communication in the Lambic game. The architecture uses SockJS for real-time bidirectional communication, with a sophisticated update system that optimizes bandwidth while maintaining smooth gameplay. The message protocol is JSON-based with clear request-response patterns for UI interactions and real-time updates for game state synchronization.

Key strengths of the system:
- Efficient update optimization (spatial filtering, delta compression, frequency optimization)
- Robust error handling and edge case management
- Clear separation between broadcast and targeted messages
- Comprehensive entity synchronization with fallback mechanisms
- Performance monitoring and optimization strategies

Areas for potential improvement:
- Automatic reconnection handling
- Explicit packet loss detection and recovery
- Message queuing on server for high-load scenarios
- More granular update frequency control
- Compression of large data structures (world data, etc.)

---

## Appendix: File References

### Server Files
- [`lambic.js`](lambic.js) - Main server file, socket handling, entity definitions
- [`server/js/core/OptimizedGameLoop.js`](server/js/core/OptimizedGameLoop.js) - Game loop and update broadcasting
- [`server/js/core/GameState.js`](server/js/core/GameState.js) - Game state management
- [`server/js/Entity.js`](server/js/Entity.js) - Entity base classes and update pack methods
- [`server/js/Database.js`](server/js/Database.js) - User database operations

### Client Files
- [`client/js/core/SocketManager.js`](client/js/core/SocketManager.js) - Socket connection management
- [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) - Message routing and handling
- [`client/js/client.js`](client/js/client.js) - Client game logic, input handling
- [`client/js/core/InputHandler.js`](client/js/core/InputHandler.js) - Input event handling
- [`client/js/core/LoginHandler.js`](client/js/core/LoginHandler.js) - Authentication UI and logic
- [`client/js/ui/*.js`](client/js/ui/) - UI component message handling

### Key Constants and Functions
- `SOCKET_LIST`: Global server socket tracking
- `emit()`: Server broadcast function (line ~907)
- `Player.onConnect()`: Player connection handler (line ~4930)
- `Player.update()`: Entity update coordinator (line ~5130)
- `OptimizedGameLoop.sendUpdates()`: Update broadcasting (line ~166)

