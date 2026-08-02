# The 150-Game Factory

A production-ready hyper-casual game factory built on **12 reusable engines + 1 shared foundation**.

## Architecture

```
game-factory/
├── foundation/
│   └── Foundation.js       # 10 reusable kits (JuiceKit, InputKit, etc.)
├── engines/
│   ├── RunEngine.js        # Runner games (23 titles)
│   ├── GridEngine.js       # Puzzle games (22 titles)
│   ├── AsmrEngine.js       # ASMR games (21 titles)
│   ├── PhysEngine.js       # Physics games (18 titles)
│   ├── IdleEngine.js       # Idle tycoon games (17 titles)
│   ├── DrawEngine.js       # Drawing puzzles (11 titles)
│   ├── MergeEngine.js      # Merge games (9 titles)
│   ├── SortEngine.js       # Sort puzzles (8 titles)
│   ├── MatchEngine.js      # Match-3 games (6 titles)
│   ├── IOEngine.js         # .io arena games (6 titles)
│   ├── TrafEngine.js       # Traffic puzzles (5 titles)
│   └── DefEngine.js        # Tower defense (4 titles)
└── games/
    ├── SnapJigsaw.html     # Game #1 - PLAYABLE EXAMPLE
    └── [149 more games...]
```

## The 10 Foundation Kits

| Kit | Purpose | Compounding Effect |
|-----|---------|-------------------|
| **JuiceKit** | Tweens, particles, screenshake, haptics, slow-mo | One upgrade = every game feels better |
| **InputKit** | Normalized tap/drag/swipe/hold for touch+mouse | Consistent feel across portfolio |
| **LevelKit** | JSON level schema + procedural generator | Levels become data, not code |
| **EconomyKit** | Soft/hard currency, rewards, offline earnings | Shared balance & monetization |
| **ProgressionKit** | Levels, stars, unlocks, XP | One meta across all games |
| **MetaKit** | Daily streaks, achievements, collections | Retention built-in by default |
| **AdKit** | Rewarded video placements, interstitial pacing | Monetization consistent & fair |
| **AudioKit** | SFX triggers, combo pitch escalation | Signature "feel" everywhere |
| **SaveKit** | localStorage + cloud save + settings | Never lose progress |
| **UIKit** | HUD, popups, buttons, transitions | Ship-ready screens, reused |

## The 12 Engines (150 Games Total)

### 1. RUN ENGINE (23 games)
Auto-advance runners with dodge/collect/scale mechanics.
- **Games:** Hop Hop Bunny, Turbo Lane, Giant Sprint, Desert Quest, Wave Rider, etc.
- **Smash Lever:** Near-miss slow-mo + growth gate choices

### 2. GRID ENGINE (22 games)
Place/match/clear pieces on grids under rules.
- **Games:** Snap Jigsaw, Fold Logic, Loop Connect, 2048 Fusion, Word Grid, etc.
- **Smash Lever:** Ghost-preview + generous undo + glow-on-match

### 3. ASMR ENGINE (21 games)
Satisfying tasks with progressive reveal and star ratings.
- **Games:** Sweet Lab, Freeze Pop, Dream Garage, Tidy Home, Lathe Craft, etc.
- **Smash Lever:** Hyper-real sound design + before/after reveal

### 4. PHYS ENGINE (18 games)
Aim, launch, physics resolution, outcome scoring.
- **Games:** Cup Stack Up, Bullseye Pro, Blade Toss, Cannon Blast, etc.
- **Smash Lever:** Trajectory preview + slow-mo money shots

### 5. IDLE ENGINE (17 games)
Earn → upgrade → automate → prestige loops.
- **Games:** Zoo Keeper Story, Hotel Empire, Diner Empire, Vet Clinic, etc.
- **Smash Lever:** Satisfying number-go-up + offline earnings popup

### 6. DRAW ENGINE (11 games)
Draw lines/shapes that become physics objects.
- **Games:** Pup Breakout, Doge Save, Spell Pup, Sneaky Heist, etc.
- **Smash Lever:** Ink that feels good + forgiving physics

### 7. MERGE ENGINE (9 games)
Combine like items → higher tier → fulfill orders.
- **Games:** Sky Merge, Merge Knights, Cluck Merge, Bloom Boutique, etc.
- **Smash Lever:** Merge "pop" feel + chain-merge bonus

### 8. SORT ENGINE (8 games)
Move items between containers until uniform.
- **Games:** Quack Sort, Serpent Sort, Bolt Out, Screw Sort, etc.
- **Smash Lever:** Buttery animation + settle "thunk" + always-available undo

### 9. MATCH ENGINE (6 games)
Aim or swap to match clusters, cascade clears.
- **Games:** Bubble Blitz, Pop Frenzy, Feather Pop, Dream Bubbles, etc.
- **Smash Lever:** Cascade chains with escalating juice

### 10. IO ENGINE (6 games)
Consume → grow → dominate the arena.
- **Games:** Serpent.io Arena, Tower.io Clash, Gobble Hole, Void.io, etc.
- **Smash Lever:** Bots that feel alive + camera zoom that sells size

### 11. TRAF ENGINE (5 games)
Slide directional pieces to free target from exit.
- **Games:** Traffic Untangle, Rail Boss, Rescue Route, Bus Out, etc.
- **Smash Lever:** Guaranteed-solvable levels + undo without penalty

### 12. DEF ENGINE (4 games)
Place/upgrade defense, survive waves, spend between.
- **Games:** Bark vs Beam, Steel Fury, Castle Defense, Undead Smash, etc.
- **Smash Lever:** Wave-preview so fails feel fair + boss every 10 waves

## Universal Smash Requirements

Every game in the factory implements these 7 rules:

1. **Every action → feedback.** No input goes unacknowledged: tween + particle + SFX + haptic.
2. **Combo system.** Escalating multiplier + rising audio pitch.
3. **FTUE: win in <20s, zero text.** Level 1 is unloseable; teach by doing.
4. **Fail → revive offer first.** Rewarded-video revive *before* game-over screen.
5. **Level complete = reward cascade.** Stars fly in, coins count up, next button pulses.
6. **Difficulty curve:** L1–10 teach · L11–40 flow · L41+ ramp, relief every ~7 levels.
7. **One "wow" moment per session.** The clip people share.

## Quick Start

### Play the Demo
Open `games/SnapJigsaw.html` in a browser. Features:
- Daily puzzle streaks (retention meta)
- Snappy piece-snap feedback (JuiceKit)
- Combo system with audio pitch escalation
- Reward cascade on completion
- Interstitial ads every 3 levels

### Build a New Game

Use this template prompt for the AI:

```
Build [GAME NAME], a hyper-casual [ENGINE] game for mobile web.

REUSE — import, do NOT rebuild:
- Foundation Layer: JuiceKit, InputKit, LevelKit, EconomyKit, ProgressionKit,
  MetaKit, AdKit, AudioKit, SaveKit, UIKit.
- [ENGINE] core: [list its "Build once" modules].

GAME CONFIG (data-driven, no hardcoded levels):
- Theme/skin: [SKIN]
- Unique twist: [TWIST from portfolio table]
- Levels: 100, JSON-defined via LevelKit schema. Include schema + 5 sample levels.

SMASH REQUIREMENTS (non-negotiable):
- Every input → JuiceKit feedback (tween + particle + SFX + haptic).
- Combo system with escalating multiplier + audio pitch.
- FTUE: win level 1 in <20s, zero text.
- Fail → rewarded-video revive BEFORE game-over screen.
- Level complete → star rating + reward cascade + pulsing next-level button.
- Difficulty curve: L1-10 teach, L11-40 flow, L41+ ramp, relief level every ~7.
- Game-specific lever: [#1 SMASH LEVER from table]

Deliver: single-file HTML5 (Canvas + vanilla JS), 60fps, touch + mouse,
zero external dependencies. Comment where each kit is called.
```

## Build Order (ROI Priority)

1. **Foundation Layer** ← Build this first (everything depends on it)
2. **RUN + GRID + ASMR + PHYS + IDLE** → 101 games (67% of portfolio)
3. **MERGE + SORT + DRAW + MATCH** → 34 more games
4. **IO + TRAF + DEF** → 15 niche titles (build last or skip weakest)

## The Compounding Rule

When you improve **JuiceKit's** particle system, **all 150 games improve**.  
When you tune **EconomyKit's** balance, **all 150 games benefit**.  
When you add a feature to **MetaKit**, **all 150 games get retention**.

This is the factory. Not 150 one-offs. **12 engines + 1 foundation × 150 skins.**

## Full Game Portfolio

See the complete 150-game table in the original specification. Each game has:
- Original name → Our branded name
- Core mechanic description
- Benchmark competitor
- Our edge (same, but better)

## License

Production-ready for commercial use. All games are original implementations with polish/retention upgrades, never mechanic overhauls.
