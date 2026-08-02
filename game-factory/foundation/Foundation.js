/**
 * FOUNDATION LAYER - 10 Reusable Kits
 * Import once, use across all 150 games
 * Every kit exposes simple API + JSON config
 */

const Foundation = (() => {
    // ========== JUICEKIT ==========
    const JuiceKit = {
        config: {
            particleCount: 20,
            screenshakeIntensity: 5,
            slowMoDuration: 300,
            hapticStrength: 'light'
        },

        state: {
            particles: [],
            tweens: [],
            timeScale: 1.0,
            screenshake: { x: 0, y: 0, intensity: 0 }
        },

        init(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
        },

        tween(obj, prop, target, duration, ease = 'easeOut') {
            const start = obj[prop];
            const change = target - start;
            const startTime = Date.now();
            
            const easingFunctions = {
                easeOut: t => t * (2 - t),
                easeIn: t => t * t,
                easeInOut: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
                bounce: t => {
                    if (t < 1/2.75) return 7.5625*t*t;
                    if (t < 2/2.75) return 7.5625*(t-=1.5/2.75)*t+0.75;
                    if (t < 2.5/2.75) return 7.5625*(t-=2.25/2.75)*t+0.9375;
                    return 7.5625*(t-=2.625/2.75)*t+0.984375;
                }
            };

            const tween = {
                obj, prop, start, change,
                duration, ease: easingFunctions[ease] || easingFunctions.easeOut,
                startTime, onComplete: null
            };
            this.state.tweens.push(tween);
            return tween;
        },

        particles(x, y, color, count = null, type = 'burst') {
            const c = count || this.config.particleCount;
            for (let i = 0; i < c; i++) {
                const angle = (Math.PI * 2 / c) * i + Math.random() * 0.5;
                const speed = 2 + Math.random() * 4;
                this.state.particles.push({
                    x, y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 1.0,
                    decay: 0.02 + Math.random() * 0.03,
                    color,
                    size: 2 + Math.random() * 4,
                    type
                });
            }
        },

        screenshake(intensity = null, duration = 200) {
            this.state.screenshake.intensity = intensity || this.config.screenshakeIntensity;
            setTimeout(() => { this.state.screenshake.intensity = 0; }, duration);
        },

        slowMo(duration = null) {
            const d = duration || this.config.slowMoDuration;
            this.state.timeScale = 0.3;
            setTimeout(() => { this.state.timeScale = 1.0; }, d);
        },

        haptic(pattern = 'light') {
            if (navigator.vibrate) {
                const patterns = {
                    light: [10],
                    medium: [20],
                    heavy: [30],
                    success: [50, 50, 50],
                    error: [100, 50, 100]
                };
                navigator.vibrate(patterns[pattern] || patterns.light);
            }
        },

        update() {
            const now = Date.now();
            
            // Update tweens
            this.state.tweens = this.state.tweens.filter(t => {
                const elapsed = now - t.startTime;
                const progress = Math.min(elapsed / t.duration, 1);
                const eased = t.ease(progress);
                t.obj[t.prop] = t.start + t.change * eased;
                
                if (progress >= 1 && t.onComplete) t.onComplete();
                return progress < 1;
            });

            // Update particles
            this.state.particles = this.state.particles.filter(p => {
                p.x += p.vx * this.state.timeScale;
                p.y += p.vy * this.state.timeScale;
                p.vy += 0.1 * this.state.timeScale; // gravity
                p.life -= p.decay * this.state.timeScale;
                return p.life > 0;
            });

            // Update screenshake
            if (this.state.screenshake.intensity > 0) {
                this.state.screenshake.x = (Math.random() - 0.5) * this.state.screenshake.intensity;
                this.state.screenshake.y = (Math.random() - 0.5) * this.state.screenshake.intensity;
            } else {
                this.state.screenshake.x = 0;
                this.state.screenshake.y = 0;
            }
        },

        render() {
            const ctx = this.ctx;
            
            // Render particles
            this.state.particles.forEach(p => {
                ctx.globalAlpha = p.life;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                if (p.type === 'star') {
                    this.drawStar(ctx, p.x, p.y, 5, p.size, p.size/2);
                } else {
                    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
            ctx.globalAlpha = 1.0;
        },

        drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
            let rot = Math.PI / 2 * 3;
            let x = cx, y = cy;
            let step = Math.PI / spikes;

            ctx.beginPath();
            ctx.moveTo(cx, cy - outerRadius);
            for (let i = 0; i < spikes; i++) {
                x = cx + Math.cos(rot) * outerRadius;
                y = cy + Math.sin(rot) * outerRadius;
                ctx.lineTo(x, y);
                rot += step;

                x = cx + Math.cos(rot) * innerRadius;
                y = cy + Math.sin(rot) * innerRadius;
                ctx.lineTo(x, y);
                rot += step;
            }
            ctx.lineTo(cx, cy - outerRadius);
            ctx.closePath();
            ctx.fill();
        }
    };

    // ========== INPUTKIT ==========
    const InputKit = {
        config: {
            tapThreshold: 10,
            swipeThreshold: 30,
            holdDuration: 300
        },

        state: {
            isDown: false,
            startX: 0, startY: 0,
            currentX: 0, currentY: 0,
            lastTap: 0,
            holdTimer: null,
            gestures: []
        },

        init(canvas) {
            this.canvas = canvas;
            
            const getPos = (e) => {
                const rect = canvas.getBoundingClientRect();
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                return {
                    x: clientX - rect.left,
                    y: clientY - rect.top
                };
            };

            canvas.addEventListener('mousedown', (e) => {
                const pos = getPos(e);
                this.state.isDown = true;
                this.state.startX = pos.x;
                this.state.startY = pos.y;
                this.state.currentX = pos.x;
                this.state.currentY = pos.y;
                this.state.holdTimer = setTimeout(() => {
                    if (this.state.isDown) this.trigger('hold', { x: pos.x, y: pos.y });
                }, this.config.holdDuration);
            });

            canvas.addEventListener('mousemove', (e) => {
                if (!this.state.isDown) return;
                const pos = getPos(e);
                this.state.currentX = pos.x;
                this.state.currentY = pos.y;
            });

            canvas.addEventListener('mouseup', (e) => {
                if (!this.state.isDown) return;
                clearTimeout(this.state.holdTimer);
                this.state.isDown = false;
                
                const dx = this.state.currentX - this.state.startX;
                const dy = this.state.currentY - this.state.startY;
                const distance = Math.sqrt(dx*dx + dy*dy);
                const pos = getPos(e);

                if (distance < this.config.tapThreshold) {
                    const now = Date.now();
                    if (now - this.state.lastTap < 300) {
                        this.trigger('doubletap', pos);
                    } else {
                        this.trigger('tap', pos);
                    }
                    this.state.lastTap = now;
                } else if (distance > this.config.swipeThreshold) {
                    const angle = Math.atan2(dy, dx);
                    const directions = ['right', 'down', 'left', 'up'];
                    const index = Math.round(((angle + Math.PI/4) % (Math.PI*2)) / (Math.PI/2));
                    this.trigger('swipe', { ...pos, direction: directions[(index+4)%4] });
                }
                
                this.trigger('release', pos);
            });

            // Touch events
            canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const pos = getPos(e);
                this.state.isDown = true;
                this.state.startX = pos.x;
                this.state.startY = pos.y;
                this.state.currentX = pos.x;
                this.state.currentY = pos.y;
                this.state.holdTimer = setTimeout(() => {
                    if (this.state.isDown) this.trigger('hold', pos);
                }, this.config.holdDuration);
            }, { passive: false });

            canvas.addEventListener('touchmove', (e) => {
                e.preventDefault();
                if (!this.state.isDown) return;
                const pos = getPos(e);
                this.state.currentX = pos.x;
                this.state.currentY = pos.y;
                this.trigger('drag', { 
                    x: pos.x, y: pos.y,
                    deltaX: pos.x - this.state.startX,
                    deltaY: pos.y - this.state.startY
                });
            }, { passive: false });

            canvas.addEventListener('touchend', (e) => {
                e.preventDefault();
                clearTimeout(this.state.holdTimer);
                this.state.isDown = false;
                
                const dx = this.state.currentX - this.state.startX;
                const dy = this.state.currentY - this.state.startY;
                const distance = Math.sqrt(dx*dx + dy*dy);
                const pos = getPos(e);

                if (distance < this.config.tapThreshold) {
                    const now = Date.now();
                    if (now - this.state.lastTap < 300) {
                        this.trigger('doubletap', pos);
                    } else {
                        this.trigger('tap', pos);
                    }
                    this.state.lastTap = now;
                } else if (distance > this.config.swipeThreshold) {
                    const angle = Math.atan2(dy, dx);
                    const directions = ['right', 'down', 'left', 'up'];
                    const index = Math.round(((angle + Math.PI/4) % (Math.PI*2)) / (Math.PI/2));
                    this.trigger('swipe', { ...pos, direction: directions[(index+4)%4] });
                }
                
                this.trigger('release', pos);
            });

            this.listeners = {};
        },

        on(event, callback) {
            if (!this.listeners[event]) this.listeners[event] = [];
            this.listeners[event].push(callback);
        },

        trigger(event, data) {
            if (this.listeners[event]) {
                this.listeners[event].forEach(cb => cb(data));
            }
        },

        getDragDelta() {
            return {
                x: this.state.currentX - this.state.startX,
                y: this.state.currentY - this.state.startY
            };
        },

        isDragging() {
            return this.state.isDown;
        }
    };

    // ========== LEVELKIT ==========
    const LevelKit = {
        config: {
            totalLevels: 100,
            difficultyCurve: 'exponential'
        },

        state: {
            currentLevel: 1,
            stars: {},
            completed: []
        },

        schema: {
            level: {
                id: 'number',
                difficulty: 'number',
                params: 'object',
                goal: 'object',
                constraints: 'object'
            }
        },

        generate(engine, count = 100) {
            const levels = [];
            for (let i = 1; i <= count; i++) {
                const difficulty = this.calculateDifficulty(i);
                levels.push({
                    id: i,
                    difficulty,
                    params: engine.generateParams(difficulty),
                    goal: engine.generateGoal(difficulty),
                    constraints: engine.generateConstraints(difficulty)
                });
            }
            return levels;
        },

        calculateDifficulty(level) {
            // L1-10 teach, L11-40 flow, L41+ ramp
            if (level <= 10) return 0.1 + (level - 1) * 0.05;
            if (level <= 40) return 0.55 + (level - 10) * 0.02;
            return 1.15 + (level - 40) * 0.03;
        },

        load(levelData) {
            this.state.currentLevel = levelData.id;
            return levelData;
        },

        complete(levelId, stars = 3) {
            this.state.completed.push(levelId);
            this.state.stars[levelId] = stars;
            SaveKit.save('levelProgress', this.state);
        },

        getNextLevel() {
            return this.state.currentLevel + 1;
        },

        isReliefLevel(level) {
            return level % 7 === 0; // Relief every ~7 levels
        }
    };

    // ========== ECONOMYKIT ==========
    const EconomyKit = {
        config: {
            softCurrency: 'coins',
            hardCurrency: 'gems',
            exchangeRate: 100
        },

        state: {
            coins: 0,
            gems: 0,
            lifetimeEarnings: 0,
            totalSpent: 0
        },

        init() {
            const saved = SaveKit.load('economy');
            if (saved) Object.assign(this.state, saved);
        },

        earn(amount, type = 'coins', multiplier = 1) {
            const total = amount * multiplier;
            this.state[type] += total;
            this.state.lifetimeEarnings += total;
            MetaKit.onEarn(type, total);
            SaveKit.save('economy', this.state);
            return total;
        },

        spend(amount, type = 'coins') {
            if (this.state[type] >= amount) {
                this.state[type] -= amount;
                this.state.totalSpent += amount;
                SaveKit.save('economy', this.state);
                return true;
            }
            return false;
        },

        getBalance(type = 'coins') {
            return this.state[type];
        },

        calculateOfflineEarnings(rate, timeAway) {
            const hours = timeAway / 3600000;
            return Math.floor(rate * hours * 0.5); // 50% efficiency offline
        },

        formatNumber(num) {
            if (num >= 1000000) return (num/1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num/1000).toFixed(1) + 'K';
            return num.toString();
        }
    };

    // ========== PROGRESSIONKIT ==========
    const ProgressionKit = {
        config: {
            xpPerLevel: 100,
            maxLevel: 1000
        },

        state: {
            level: 1,
            xp: 0,
            xpToNext: 100
        },

        init() {
            const saved = SaveKit.load('progression');
            if (saved) Object.assign(this.state, saved);
        },

        addXP(amount) {
            this.state.xp += amount;
            let leveledUp = false;
            
            while (this.state.xp >= this.state.xpToNext && this.state.level < this.config.maxLevel) {
                this.state.xp -= this.state.xpToNext;
                this.state.level++;
                this.state.xpToNext = Math.floor(this.state.xpToNext * 1.1);
                leveledUp = true;
            }
            
            SaveKit.save('progression', this.state);
            if (leveledUp) MetaKit.onLevelUp(this.state.level);
            return leveledUp;
        },

        getProgress() {
            return this.state.xp / this.state.xpToNext;
        }
    };

    // ========== METAKIT ==========
    const MetaKit = {
        config: {
            dailyStreakBonus: 1.5,
            maxStreakBonus: 3.0
        },

        state: {
            dailyStreak: 0,
            lastLogin: null,
            achievements: [],
            collections: {},
            seasonPassXP: 0
        },

        init() {
            const saved = SaveKit.load('meta');
            if (saved) Object.assign(this.state, saved);
            this.checkDailyStreak();
        },

        checkDailyStreak() {
            const today = new Date().toDateString();
            const last = this.state.lastLogin;
            
            if (last !== today) {
                const yesterday = new Date(Date.now() - 86400000).toDateString();
                if (last === yesterday) {
                    this.state.dailyStreak++;
                } else if (last !== today) {
                    this.state.dailyStreak = 1;
                }
                this.state.lastLogin = today;
                SaveKit.save('meta', this.state);
            }
        },

        getStreakMultiplier() {
            return Math.min(
                this.config.dailyStreakBonus + (this.state.dailyStreak - 1) * 0.1,
                this.config.maxStreakBonus
            );
        },

        unlockAchievement(id) {
            if (!this.state.achievements.includes(id)) {
                this.state.achievements.push(id);
                SaveKit.save('meta', this.state);
                return true;
            }
            return false;
        },

        addToCollection(category, item) {
            if (!this.state.collections[category]) {
                this.state.collections[category] = [];
            }
            if (!this.state.collections[category].includes(item)) {
                this.state.collections[category].push(item);
                SaveKit.save('meta', this.state);
                return true;
            }
            return false;
        },

        onEarn(currency, amount) {
            // Hook for achievements based on earnings
        },

        onLevelUp(level) {
            // Hook for level-up achievements
        }
    };

    // ========== ADKIT ==========
    const AdKit = {
        config: {
            interstitialInterval: 3,
            rewardedVideoPlacements: ['revive', 'bonus', 'skip'],
            noAdTimer: 30000
        },

        state: {
            levelsSinceLastAd: 0,
            lastInterstitial: 0,
            noAdUntil: 0
        },

        shouldShowInterstitial() {
            if (Date.now() < this.state.noAdUntil) return false;
            this.state.levelsSinceLastAd++;
            return this.state.levelsSinceLastAd >= this.config.interstitialInterval;
        },

        showInterstitial() {
            this.state.levelsSinceLastAd = 0;
            this.state.lastInterstitial = Date.now();
            // Placeholder - integrate with actual ad network
            console.log('[ADKIT] Interstitial ad shown');
        },

        showRewardedVideo(plACEMENT, onSuccess) {
            // Placeholder - integrate with actual ad network
            console.log(`[ADKIT] Rewarded video: ${plACEMENT}`);
            // Simulate successful watch
            setTimeout(() => {
                onSuccess();
            }, 1000);
        },

        enableNoAds(duration = null) {
            this.state.noAdUntil = Date.now() + (duration || this.config.noAdTimer);
        }
    };

    // ========== AUDIOKIT ==========
    const AudioKit = {
        config: {
            masterVolume: 0.7,
            sfxVolume: 0.8,
            musicVolume: 0.5
        },

        state: {
            sounds: {},
            music: null,
            comboPitch: 0
        },

        init() {
            // Create audio context for synthesized sounds
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        },

        playTone(frequency, type = 'sine', duration = 0.1, volume = 0.3) {
            if (!this.audioCtx) return;
            
            const oscillator = this.audioCtx.createOscillator();
            const gainNode = this.audioCtx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioCtx.destination);
            
            oscillator.frequency.value = frequency + this.state.comboPitch;
            oscillator.type = type;
            
            gainNode.gain.setValueAtTime(volume * this.config.sfxVolume, this.audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);
            
            oscillator.start(this.audioCtx.currentTime);
            oscillator.stop(this.audioCtx.currentTime + duration);
        },

        playSFX(name) {
            const sounds = {
                pop: () => this.playTone(800, 'sine', 0.1),
                match: () => {
                    this.playTone(600 + this.state.comboPitch * 100, 'square', 0.15);
                    setTimeout(() => this.playTone(900 + this.state.comboPitch * 100, 'square', 0.15), 50);
                },
                win: () => {
                    [523, 659, 784, 1047].forEach((freq, i) => {
                        setTimeout(() => this.playTone(freq, 'sine', 0.3, 0.4), i * 100);
                    });
                },
                fail: () => this.playTone(200, 'sawtooth', 0.4, 0.3),
                coin: () => {
                    this.playTone(1200, 'sine', 0.1, 0.3);
                    setTimeout(() => this.playTone(1600, 'sine', 0.2, 0.3), 50);
                },
                combo: () => this.playTone(400 + this.state.comboPitch * 200, 'triangle', 0.1)
            };
            
            if (sounds[name]) sounds[name]();
        },

        setComboPitch(pitch) {
            this.state.comboPitch = Math.min(pitch, 12); // Max 12 semitones up
        },

        resetComboPitch() {
            this.state.comboPitch = 0;
        },

        playMusic(track) {
            // Placeholder for music system
            console.log('[AUDIOKIT] Playing music:', track);
        }
    };

    // ========== SAVEKIT ==========
    const SaveKit = {
        config: {
            prefix: 'gameFactory_',
            autoSave: true
        },

        save(key, data) {
            try {
                localStorage.setItem(this.config.prefix + key, JSON.stringify(data));
            } catch (e) {
                console.warn('Save failed:', e);
            }
        },

        load(key) {
            try {
                const data = localStorage.getItem(this.config.prefix + key);
                return data ? JSON.parse(data) : null;
            } catch (e) {
                console.warn('Load failed:', e);
                return null;
            }
        },

        delete(key) {
            localStorage.removeItem(this.config.prefix + key);
        },

        clearAll() {
            Object.keys(localStorage)
                .filter(k => k.startsWith(this.config.prefix))
                .forEach(k => localStorage.removeItem(k));
        },

        cloudSave(data) {
            // Placeholder for cloud save integration
            console.log('[SAVEKIT] Cloud save:', data);
        },

        cloudLoad() {
            // Placeholder for cloud load integration
            return null;
        }
    };

    // ========== UITKIT ==========
    const UIKit = {
        config: {
            colors: {
                primary: '#4CAF50',
                secondary: '#FF9800',
                accent: '#2196F3',
                background: '#1a1a2e',
                text: '#ffffff'
            },
            fonts: {
                main: 'Arial Black, sans-serif',
                numbers: 'Impact, sans-serif'
            }
        },

        state: {
            overlays: [],
            transitions: []
        },

        init(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
        },

        drawButton(x, y, width, height, text, onClick, style = {}) {
            const ctx = this.ctx;
            const colors = { ...this.config.colors, ...style };
            
            // Button background
            ctx.fillStyle = colors.bg || colors.primary;
            this.roundRect(ctx, x, y, width, height, 10);
            ctx.fill();
            
            // Border
            ctx.strokeStyle = colors.border || '#ffffff';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // Text
            ctx.fillStyle = colors.text || this.config.colors.text;
            ctx.font = `bold ${style.fontSize || 20}px ${this.config.fonts.main}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, x + width/2, y + height/2);
            
            // Store click handler
            if (!this.buttons) this.buttons = [];
            this.buttons.push({ x, y, width, height, onClick });
        },

        roundRect(ctx, x, y, w, h, r) {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
        },

        drawHUD(data) {
            const ctx = this.ctx;
            const w = this.canvas.width;
            
            // Level indicator
            ctx.fillStyle = this.config.colors.text;
            ctx.font = `bold 24px ${this.config.fonts.main}`;
            ctx.textAlign = 'left';
            ctx.fillText(`Level ${data.level || 1}`, 20, 40);
            
            // Score/Coins
            if (data.score !== undefined) {
                ctx.textAlign = 'center';
                ctx.fillText(`${data.score}`, w/2, 40);
            }
            
            // Stars
            if (data.stars !== undefined) {
                ctx.textAlign = 'right';
                ctx.fillText('★'.repeat(data.stars), w - 20, 40);
            }
        },

        showPopup(title, message, buttons = []) {
            const ctx = this.ctx;
            const w = this.canvas.width;
            const h = this.canvas.height;
            
            // Overlay
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(0, 0, w, h);
            
            // Popup box
            const pw = 400, ph = 300;
            const px = w/2 - pw/2, py = h/2 - ph/2;
            
            ctx.fillStyle = '#2a2a4e';
            this.roundRect(ctx, px, py, pw, ph, 20);
            ctx.fill();
            
            ctx.strokeStyle = '#4a4a8e';
            ctx.lineWidth = 4;
            ctx.stroke();
            
            // Title
            ctx.fillStyle = this.config.colors.text;
            ctx.font = `bold 32px ${this.config.fonts.main}`;
            ctx.textAlign = 'center';
            ctx.fillText(title, w/2, py + 60);
            
            // Message
            ctx.font = `20px ${this.config.fonts.main}`;
            ctx.fillText(message, w/2, py + 120);
            
            // Buttons
            buttons.forEach((btn, i) => {
                const bx = w/2 - 100;
                const by = py + 180 + i * 60;
                this.drawButton(bx, by, 200, 50, btn.text, btn.onClick);
            });
        },

        showLevelComplete(stars, rewards, onNext) {
            const ctx = this.ctx;
            const w = this.canvas.width;
            const h = this.canvas.height;
            
            // Celebration overlay
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fillRect(0, 0, w, h);
            
            // Stars animation
            for (let i = 0; i < stars; i++) {
                setTimeout(() => {
                    JuiceKit.particles(w/2, h/2 - 50, '#FFD700', 30, 'star');
                    AudioKit.playSFX('win');
                }, i * 300);
            }
            
            // Title
            ctx.fillStyle = '#FFD700';
            ctx.font = `bold 48px ${this.config.fonts.main}`;
            ctx.textAlign = 'center';
            ctx.fillText('LEVEL COMPLETE!', w/2, h/2 - 100);
            
            // Stars
            ctx.font = '60px Arial';
            ctx.fillText('★'.repeat(stars), w/2, h/2 - 20);
            
            // Rewards
            if (rewards.coins) {
                ctx.fillStyle = '#FFD700';
                ctx.font = 'bold 28px ' + this.config.fonts.numbers;
                ctx.fillText(`+${rewards.coins} Coins`, w/2, h/2 + 50);
            }
            
            // Next button (pulsing)
            const pulse = () => {
                const scale = 1 + Math.sin(Date.now() / 200) * 0.1;
                this.drawButton(
                    w/2 - 100, h/2 + 100, 200, 60,
                    'NEXT LEVEL', onNext, { fontSize: 24 }
                );
                requestAnimationFrame(pulse);
            };
            pulse();
        },

        handleInput(x, y) {
            if (this.buttons) {
                this.buttons.forEach(btn => {
                    if (x >= btn.x && x <= btn.x + btn.width &&
                        y >= btn.y && y <= btn.y + btn.height) {
                        btn.onClick();
                    }
                });
            }
        }
    };

    // Export all kits
    return {
        JuiceKit,
        InputKit,
        LevelKit,
        EconomyKit,
        ProgressionKit,
        MetaKit,
        AdKit,
        AudioKit,
        SaveKit,
        UIKit
    };
})();

// Auto-initialize when loaded
if (typeof window !== 'undefined') {
    window.Foundation = Foundation;
}
