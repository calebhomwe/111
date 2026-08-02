/**
 * RUN ENGINE - For auto-advance runner games
 * Core: auto-advance → dodge/collect → scale up → cash out
 * Used by: 23 games including Hop Hop Bunny, Turbo Lane, Giant Sprint, etc.
 */

const RunEngine = (() => {
    return {
        config: {
            laneCount: 3,
            baseSpeed: 5,
            speedIncrease: 0.1,
            scaleGrowth: 0.1
        },

        state: {
            player: null,
            lanes: [],
            obstacles: [],
            gates: [],
            collectibles: [],
            score: 0,
            speed: 5,
            distance: 0,
            combo: 0,
            isPlaying: false
        },

        init(canvas, Foundation) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.Foundation = Foundation;
            
            // Initialize foundation kits
            Foundation.JuiceKit.init(canvas);
            Foundation.InputKit.init(canvas);
            Foundation.UIKit.init(canvas);
            
            this.setupInput();
        },

        setupInput() {
            const { InputKit } = this.Foundation;
            
            InputKit.on('tap', (pos) => {
                if (!this.state.isPlaying) return;
                
                const laneWidth = this.canvas.width / this.config.laneCount;
                const targetLane = Math.floor(pos.x / laneWidth);
                this.movePlayerToLane(targetLane);
            });
            
            InputKit.on('swipe', (data) => {
                if (!this.state.isPlaying) return;
                
                const currentLane = this.state.player.lane;
                if (data.direction === 'left' && currentLane > 0) {
                    this.movePlayerToLane(currentLane - 1);
                } else if (data.direction === 'right' && currentLane < this.config.laneCount - 1) {
                    this.movePlayerToLane(currentLane + 1);
                }
            });
        },

        movePlayerToLane(lane) {
            const player = this.state.player;
            const laneWidth = this.canvas.width / this.config.laneCount;
            const targetX = lane * laneWidth + laneWidth / 2;
            
            // Tween movement
            this.Foundation.JuiceKit.tween(player, 'x', targetX, 150, 'easeOut');
            player.lane = lane;
            
            // Juice
            this.Foundation.JuiceKit.particles(player.x, player.y + player.height/2, '#4CAF50', 10);
            this.Foundation.AudioKit.playSFX('pop');
        },

        start(config) {
            const w = this.canvas.width;
            const h = this.canvas.height;
            
            this.state = {
                player: {
                    x: w / 2,
                    y: h - 100,
                    width: 40,
                    height: 40,
                    lane: 1,
                    scale: 1,
                    color: config.playerColor || '#4CAF50'
                },
                lanes: [],
                obstacles: [],
                gates: [],
                collectibles: [],
                score: 0,
                speed: this.config.baseSpeed,
                distance: 0,
                combo: 0,
                isPlaying: true,
                level: config.level || 1
            };
            
            // Create lanes
            for (let i = 0; i < this.config.laneCount; i++) {
                this.state.lanes.push({
                    x: i * (w / this.config.laneCount),
                    width: w / this.config.laneCount
                });
            }
            
            this.Foundation.EconomyKit.init();
            this.Foundation.MetaKit.init();
            
            // FTUE: Level 1 is unloseable, win in <20s
            if (this.state.level === 1) {
                this.Foundation.AudioKit.playSFX('win');
            }
        },

        spawnObstacle() {
            const lane = Math.floor(Math.random() * this.config.laneCount);
            const laneWidth = this.canvas.width / this.config.laneCount;
            
            this.state.obstacles.push({
                x: lane * laneWidth + laneWidth / 2,
                y: -50,
                width: 40,
                height: 40,
                lane,
                type: Math.random() > 0.7 ? 'big' : 'normal'
            });
        },

        spawnGate() {
            const lane = Math.floor(Math.random() * this.config.laneCount);
            const laneWidth = this.canvas.width / this.config.laneCount;
            const operations = ['multiply', 'add', 'subtract'];
            const operation = operations[Math.floor(Math.random() * operations.length)];
            const value = Math.floor(Math.random() * 10) + 2;
            
            this.state.gates.push({
                x: lane * laneWidth + laneWidth / 2,
                y: -50,
                width: laneWidth - 20,
                height: 60,
                lane,
                operation,
                value,
                color: operation === 'multiply' ? '#FF9800' : operation === 'add' ? '#4CAF50' : '#f44336'
            });
        },

        spawnCollectible() {
            const lane = Math.floor(Math.random() * this.config.laneCount);
            const laneWidth = this.canvas.width / this.config.laneCount;
            
            this.state.collectibles.push({
                x: lane * laneWidth + laneWidth / 2,
                y: -30,
                radius: 15,
                lane,
                value: 10
            });
        },

        update(deltaTime) {
            if (!this.state.isPlaying) return;
            
            const { JuiceKit } = this.Foundation;
            JuiceKit.update();
            
            // Move player forward (auto-advance)
            this.state.distance += this.state.speed * deltaTime / 16;
            this.state.score = Math.floor(this.state.distance / 10);
            
            // Increase speed gradually
            this.state.speed += this.config.speedIncrease * deltaTime / 16;
            
            // Spawn entities
            if (Math.random() < 0.02) this.spawnObstacle();
            if (Math.random() < 0.015) this.spawnGate();
            if (Math.random() < 0.03) this.spawnCollectible();
            
            // Update obstacles
            this.state.obstacles = this.state.obstacles.filter(obs => {
                obs.y += this.state.speed * deltaTime / 16;
                
                // Collision detection
                if (this.checkCollision(this.state.player, obs)) {
                    this.Foundation.JuiceKit.screenshake(10);
                    this.Foundation.JuiceKit.particles(obs.x, obs.y, '#f44336', 20);
                    this.Foundation.AudioKit.playSFX('fail');
                    
                    // Revive offer before game over
                    this.Foundation.AdKit.showRewardedVideo('revive', () => {
                        this.state.obstacles = this.state.obstacles.filter(o => o !== obs);
                        this.Foundation.JuiceKit.slowMo();
                    });
                    
                    return false;
                }
                
                return obs.y < this.canvas.height + 50;
            });
            
            // Update gates
            this.state.gates = this.state.gates.filter(gate => {
                gate.y += this.state.speed * deltaTime / 16;
                
                // Gate collision
                if (this.checkCollision(this.state.player, gate)) {
                    this.applyGateEffect(gate);
                    this.Foundation.JuiceKit.particles(gate.x, gate.y, gate.color, 30);
                    this.Foundation.AudioKit.playSFX('match');
                    return false;
                }
                
                return gate.y < this.canvas.height + 50;
            });
            
            // Update collectibles
            this.state.collectibles = this.state.collectibles.filter(col => {
                col.y += this.state.speed * deltaTime / 16;
                
                // Collection
                const dx = this.state.player.x - col.x;
                const dy = this.state.player.y - col.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                if (dist < this.state.player.width/2 + col.radius) {
                    this.Foundation.EconomyKit.earn(col.value);
                    this.Foundation.JuiceKit.particles(col.x, col.y, '#FFD700', 15);
                    this.Foundation.AudioKit.playSFX('coin');
                    this.state.combo++;
                    this.Foundation.AudioKit.setComboPitch(this.state.combo);
                    return false;
                }
                
                return col.y < this.canvas.height + 50;
            });
            
            // Reset combo pitch when not collecting
            if (this.state.combo > 0 && Math.random() < 0.01) {
                this.state.combo = 0;
                this.Foundation.AudioKit.resetComboPitch();
            }
        },

        checkCollision(a, b) {
            return a.x - a.width/2 < b.x + b.width/2 &&
                   a.x + a.width/2 > b.x - b.width/2 &&
                   a.y - a.height/2 < b.y + b.height/2 &&
                   a.y + a.height/2 > b.y - b.height/2;
        },

        applyGateEffect(gate) {
            const player = this.state.player;
            
            switch(gate.operation) {
                case 'multiply':
                    player.scale *= gate.value;
                    break;
                case 'add':
                    player.scale += gate.value * this.config.scaleGrowth;
                    break;
                case 'subtract':
                    player.scale = Math.max(0.5, player.scale - gate.value * this.config.scaleGrowth);
                    break;
            }
            
            // Visual feedback
            player.width = 40 * player.scale;
            player.height = 40 * player.scale;
            
            // Near-miss bonus
            if (player.scale >= 10) {
                this.Foundation.MetaKit.unlockAchievement('giant_10');
            }
        },

        render() {
            const ctx = this.ctx;
            const w = this.canvas.width;
            const h = this.canvas.height;
            const { JuiceKit, UIKit } = this.Foundation;
            
            // Clear with screenshake offset
            ctx.save();
            ctx.translate(JuiceKit.state.screenshake.x, JuiceKit.state.screenshake.y);
            
            // Background
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(-10, -10, w+20, h+20);
            
            // Draw lanes
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            this.state.lanes.forEach(lane => {
                ctx.beginPath();
                ctx.moveTo(lane.x, 0);
                ctx.lineTo(lane.x, h);
                ctx.stroke();
            });
            
            // Draw collectibles
            this.state.collectibles.forEach(col => {
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.arc(col.x, col.y, col.radius, 0, Math.PI * 2);
                ctx.fill();
                
                // Glow
                ctx.shadowColor = '#FFD700';
                ctx.shadowBlur = 10;
                ctx.fill();
                ctx.shadowBlur = 0;
            });
            
            // Draw gates
            this.state.gates.forEach(gate => {
                ctx.fillStyle = gate.color;
                ctx.fillRect(gate.x - gate.width/2, gate.y, gate.width, gate.height);
                
                // Operation text
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 24px Arial Black';
                ctx.textAlign = 'center';
                const opSymbol = gate.operation === 'multiply' ? '×' : gate.operation === 'add' ? '+' : '-';
                ctx.fillText(`${opSymbol}${gate.value}`, gate.x, gate.y + gate.height/2 + 8);
            });
            
            // Draw obstacles
            this.state.obstacles.forEach(obs => {
                ctx.fillStyle = obs.type === 'big' ? '#f44336' : '#ff5722';
                ctx.fillRect(obs.x - obs.width/2, obs.y, obs.width, obs.height);
            });
            
            // Draw player
            const player = this.state.player;
            ctx.fillStyle = player.color;
            ctx.save();
            ctx.translate(player.x, player.y);
            ctx.scale(player.scale, player.scale);
            ctx.fillRect(-player.width/2, -player.height/2, player.width, player.height);
            ctx.restore();
            
            // Render juice
            JuiceKit.render();
            
            // HUD
            UIKit.drawHUD({
                level: this.state.level,
                score: this.state.score,
                stars: 3
            });
            
            // Combo indicator
            if (this.state.combo > 1) {
                ctx.fillStyle = '#FF9800';
                ctx.font = 'bold 20px Arial Black';
                ctx.textAlign = 'center';
                ctx.fillText(`COMBO x${this.state.combo}`, w/2, 80);
            }
            
            ctx.restore();
        },

        completeLevel() {
            this.state.isPlaying = false;
            
            const stars = this.state.score > 1000 ? 3 : this.state.score > 500 ? 2 : 1;
            const coins = this.Foundation.EconomyKit.getBalance();
            
            this.Foundation.LevelKit.complete(this.state.level, stars);
            
            this.Foundation.UIKit.showLevelComplete(stars, {
                coins: coins
            }, () => {
                // Next level
                const nextLevel = this.Foundation.LevelKit.getNextLevel();
                this.start({ level: nextLevel });
            });
        }
    };
})();

if (typeof window !== 'undefined') {
    window.RunEngine = RunEngine;
}
