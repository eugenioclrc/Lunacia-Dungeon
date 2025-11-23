# Code Review: Refactoring to Single-Player Dungeon Game

## Overview
This review identifies issues that need to be addressed when refactoring from a **multiplayer snake game** to a **single-player dungeon game with EOA**.

---

## 🔴 Critical Issues

### 1. **Multiplayer Room System** (`game/rooms.ts`)
**Problem:** The room system is designed for matchmaking with host/guest players.

**Issues:**
- `joinRoom()` expects two players (host/guest)
- `isRoomReady` checks for both players
- Room cleanup logic assumes two players
- `getAvailableRooms()` filters for rooms waiting for a second player

**Needs:**
- Single player per room (no matchmaking)
- Remove guest/host distinction
- Simplify room lifecycle: CREATE → PLAYING → FINISHED

**Location:** `game/rooms.ts:87-155`

---

### 2. **App Session Creation** (`nitrolite/session-create.ts`)
**Problem:** App session expects 2 participants (participantA and participantB).

**Issues:**
- Line 33: Function signature has `participantA` only, but code references `participantB` (line 197)
- Line 72: `participants: [formattedA, serverAddress]` - only 2 participants (should be 1 player + server)
- Line 73: `weights: [0, 100]` - player has 0% weight (should player have some control?)
- Line 50: References `pending.participantB` which doesn't exist in single-player
- Line 210: Returns `participants: [formattedA, formattedB, serverAddress]` - `formattedB` undefined

**Needs:**
- Single participant (player EOA)
- Server has control (100% weight) OR player has some voting power
- Remove all `participantB` references

**Location:** `nitrolite/session-create.ts:33-218`

---

### 3. **Signature Collection** (`nitrolite/session-signatures.ts`)
**Problem:** Expects 2 player signatures.

**Issues:**
- Line 38: `addAppSessionSignature()` checks for 2 signatures (`pending.signatures.size === 2`)
- Line 71: Logs "Total signatures collected: ${pending.signatures.size}/2"
- Line 91: `if (pending.signatures.size !== 2)` throws error
- Line 98: References `pending.participantB` which won't exist
- Line 109: Tries to get `sigB` from `pending.participantB`
- Line 117-118: Logs participant B
- Line 124-126: Logs signature B
- Line 137-140: Signature array includes `sigB` which won't exist

**Needs:**
- Only 1 player signature needed
- Remove participantB signature collection
- Update signature array to `[sigPlayer, sigServer]`

**Location:** `nitrolite/session-signatures.ts:38-266`

---

### 4. **Game State Structure** (`game/game-init.ts`, `game/game-movement.ts`)
**Problem:** Game state still has snake-based structure and multiplayer concepts.

**Issues:**
- `game-init.ts:38`: `createGame(hostEoa)` - only takes one player (good!), but:
  - Line 87: Has duplicate `player` property
  - Returns dungeon map structure (good start!)
  - But game-movement.ts still expects snake structure

**Needs:**
- Remove snake references
- Use actor-based system (already started in `game-init.ts`)
- Single player actor (player) vs enemies
- Combat system instead of collision detection

**Location:** `game/game-init.ts:38-90`

---

### 5. **Movement Logic** (`game/game-movement.ts`)
**Problem:** Entire file is snake-based movement and collision.

**Issues:**
- `changeDirection()` expects `gameState.snakes[playerId]` (line 113)
- `updateGame()` moves snakes, checks snake collisions (lines 146-232)
- `checkOtherSnakeCollision()` - not needed for single player
- `checkFoodCollision()` - food system not needed for dungeon

**Needs:**
- Replace with dungeon movement (player actor moves on map)
- Enemy AI movement
- Combat resolution
- Remove snake/food logic

**Location:** `game/game-movement.ts` (entire file)

---

### 6. **Game Formatting** (`game/game-format.ts`)
**Problem:** Formats snake game state.

**Issues:**
- Line 20: `snakes: gameState.snakes` - no snakes in dungeon
- Line 21: `food: gameState.food` - no food in dungeon
- Line 34-39: `formatGameOverMessage()` references `gameState.snakes.player1/player2`

**Needs:**
- Format dungeon map, actors, player stats
- Game over based on player death or dungeon completion

**Location:** `game/game-format.ts` (entire file)

---

### 7. **WebSocket Handlers** (`websocket/handlers/room.ts`, `websocket/handlers/game.ts`)
**Problem:** Handlers expect multiplayer flow.

**Issues:**
- `room.ts:89`: Logs `host` and `guest` players
- `room.ts:92-98`: Generates app session with `participantB` (guest)
- `room.ts:102-113`: Sends signature request to guest
- `game.ts:85-86`: Checks for both host and guest
- `game.ts:92`: Creates game with two players
- `game.ts:145-152`: Determines winner based on player1/player2

**Needs:**
- Single player flow: join → sign → start
- Remove guest/host distinction
- Single player game initialization

**Location:** 
- `websocket/handlers/room.ts:84-118`
- `websocket/handlers/game.ts:45-121, 134-195`

---

### 8. **Main Server** (`index.ts`)
**Problem:** Signature flow expects two players.

**Issues:**
- Line 90-119: Handles signature from participant B (guest), then requests from participant A (host)
- Line 190: Creates game with `room.players.host, room.players.guest`

**Needs:**
- Single signature flow: player signs → server creates session
- Single player game creation

**Location:** `index.ts:55-217`

---

### 9. **Session Storage** (`nitrolite/session-storage.ts`)
**Problem:** References participantB in logging.

**Issues:**
- Line 46: Logs `participantB` which won't exist

**Needs:**
- Remove participantB references

**Location:** `nitrolite/session-storage.ts:42-49`

---

### 10. **Session Update/Close** (`nitrolite/session-update.ts`, `nitrolite/session-close.ts`)
**Problem:** Both files reference participantB and player2.

**Issues:**
- Multiple references to `participantB`, `player2`, two-player payout logic

**Needs:**
- Single player payout
- Remove player2 references

**Location:** Both files have extensive participantB references

---

## 🟡 Medium Priority Issues

### 11. **Game Constants** (`game/game-constants.ts`)
**Problem:** Still has snake-specific constants and typedefs.

**Issues:**
- Line 6: Comment says "Snake game"
- Lines 19-21: `INITIAL_SNAKE_LENGTH`, `MIN_FOOD_COUNT` - not needed
- Lines 38-43: `Snake` typedef - not needed
- Lines 45-57: `GameState` typedef references snakes and two players

**Needs:**
- Update comments
- Remove snake constants
- Update GameState typedef for dungeon

**Location:** `game/game-constants.ts`

---

### 12. **Game Food** (`game/game-food.ts`)
**Problem:** Entire file is for food spawning (not needed for dungeon).

**Issues:**
- Food system not relevant for dungeon game

**Needs:**
- Remove or repurpose for item/treasure spawning

**Location:** `game/game-food.ts`

---

### 13. **Snake Coordinator** (`game/snake.ts`)
**Problem:** File is a coordinator for snake game modules.

**Issues:**
- All exports are snake-related
- Comments describe snake game rules

**Needs:**
- Rename to `dungeon.ts` or similar
- Update exports for dungeon game
- Update comments

**Location:** `game/snake.ts`

---

## 🟢 Low Priority / Cleanup

### 14. **Comments and Documentation**
- Update all file headers from "VIPER DUEL" / "SNAKE GAME" to "DUNGEON GAME"
- Update README.md if it exists
- Update function documentation

### 15. **Variable Naming**
- Rename `snakes` → `actors` or `entities`
- Rename `player1`/`player2` → `player`
- Rename `host`/`guest` → `player`

---

## ✅ What's Already Good

1. **Dungeon Map Generation** (`game/game-init.ts:45-56`)
   - Already using ROT.js for dungeon generation
   - Actor system started (lines 14-32, 58-73)

2. **Single Player in createGame()** (`game/game-init.ts:38`)
   - Function already takes only one EOA parameter

3. **Authentication** (`nitrolite/auth.ts`)
   - EOA-based auth should work fine for single player

---

## 📋 Refactoring Checklist

### Phase 1: Remove Multiplayer Concepts
- [ ] Remove guest/host from room system
- [ ] Update app session to single participant
- [ ] Fix signature collection (1 signature instead of 2)
- [ ] Update WebSocket handlers for single player flow

### Phase 2: Remove Snake Game Logic
- [ ] Replace movement system with dungeon movement
- [ ] Remove snake collision detection
- [ ] Remove food system (or repurpose)
- [ ] Update game state structure

### Phase 3: Implement Dungeon Game
- [ ] Complete actor system (player + enemies)
- [ ] Implement combat system
- [ ] Add dungeon progression (levels, completion)
- [ ] Update game formatting

### Phase 4: Cleanup
- [ ] Update all comments and documentation
- [ ] Rename files (snake.ts → dungeon.ts)
- [ ] Update constants and types
- [ ] Remove unused code

---

## 🚨 Critical Bugs Found

1. **`session-create.ts:197`**: References `formattedB` which is never defined (will crash)
2. **`session-create.ts:210`**: Returns `formattedB` in participants array (undefined)
3. **`game-init.ts:87`**: Duplicate `player` property in return object
4. **`session-signatures.ts:109`**: Tries to get signature from `pending.participantB` which won't exist

---

## Recommendations

1. **Start with app session refactoring** - This is the foundation that everything else depends on
2. **Simplify room system** - Single player = simpler room lifecycle
3. **Build dungeon game incrementally** - Start with movement, then combat, then progression
4. **Test signature flow** - Ensure single signature collection works end-to-end
5. **Update types** - Fix TypeScript/JSDoc types to match new structure

