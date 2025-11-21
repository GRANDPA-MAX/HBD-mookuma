// entry_effects.js

(function () {
    // Check config
    if (typeof ENABLE_ENTRY_EFFECTS === 'undefined' || !ENABLE_ENTRY_EFFECTS) return;

    const canvas = document.getElementById('effects-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width, height;
    let mouseX = 0;
    let mouseY = 0;
    let particles = []; // For confetti/smoke
    let candleLit = true;

    // Resize
    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    // Mouse Track
    window.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    // Click to blow candle
    canvas.addEventListener('click', (e) => {
        // Cake position: Left side
        const cakeX = width * 0.25;
        const cakeY = height * 0.6;
        const candleTipX = cakeX;
        const candleTipY = cakeY - 130; // Approx top of candle

        // Check distance to candle flame area
        const dist = Math.hypot(e.clientX - candleTipX, e.clientY - candleTipY);

        // If close enough and lit, blow it out
        if (dist < 150 && candleLit) {
            candleLit = false;
            playPopSound();
            // Celebration Confetti!
            spawnConfetti(cakeX, cakeY - 100);
            // Smoke
            for (let i = 0; i < 20; i++) {
                particles.push(new Particle(candleTipX, candleTipY, 'smoke'));
            }
        } else if (dist < 150 && !candleLit) {
            // Relight
            candleLit = true;
            for (let i = 0; i < 10; i++) {
                particles.push(new Particle(candleTipX, candleTipY, 'spark'));
            }
        }
    });

    function spawnConfetti(x, y) {
        for (let i = 0; i < 100; i++) {
            particles.push(new Particle(x, y, 'confetti'));
        }
    }

    class Particle {
        constructor(x, y, type) {
            this.x = x;
            this.y = y;
            this.type = type;

            if (type === 'flame') {
                this.size = Math.random() * 5 + 5;
                this.vx = (Math.random() - 0.5) * 1;
                this.vy = -Math.random() * 3 - 2;
                this.life = Math.random() * 20 + 10;
                this.color = `hsl(${Math.random() * 40 + 10}, 100%, 60%)`;
            } else if (type === 'smoke') {
                this.size = Math.random() * 10 + 5;
                this.vx = (Math.random() - 0.5) * 3;
                this.vy = -Math.random() * 2 - 1;
                this.life = Math.random() * 60 + 40;
                this.color = `rgba(220, 220, 220, 0.4)`;
            } else if (type === 'spark') {
                this.size = Math.random() * 3 + 1;
                this.vx = (Math.random() - 0.5) * 5;
                this.vy = (Math.random() - 0.5) * 5;
                this.life = Math.random() * 15 + 5;
                this.color = '#FFF';
            } else if (type === 'confetti') {
                this.size = Math.random() * 8 + 4;
                this.vx = (Math.random() - 0.5) * 15;
                this.vy = (Math.random() - 1) * 15; // Upwards mostly
                this.gravity = 0.5;
                this.life = Math.random() * 100 + 60;
                this.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
                this.rotation = Math.random() * Math.PI * 2;
                this.rotationSpeed = (Math.random() - 0.5) * 0.2;
            }
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.life--;

            if (this.type === 'confetti') {
                this.vy += this.gravity;
                this.rotation += this.rotationSpeed;
                this.vx *= 0.95; // Air resistance
            } else {
                this.size *= 0.95;
            }
        }

        draw(ctx) {
            ctx.save();
            ctx.translate(this.x, this.y);
            if (this.rotation) ctx.rotate(this.rotation);

            ctx.fillStyle = this.color;

            if (this.type === 'confetti') {
                ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    // --- VECTOR DRAWING FUNCTIONS ---

    function drawStylizedCake(ctx, x, y) {
        const scale = 1.8;

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);

        // -- SHADOW --
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(0, 60, 90, 25, 0, 0, Math.PI * 2);
        ctx.fill();

        // -- BOTTOM LAYER --
        // Base
        const gradBottom = ctx.createLinearGradient(-70, 0, 70, 0);
        gradBottom.addColorStop(0, '#CE93D8'); // Darker Purple
        gradBottom.addColorStop(0.5, '#E1BEE7'); // Light Purple
        gradBottom.addColorStop(1, '#CE93D8');

        ctx.fillStyle = gradBottom;
        ctx.beginPath();
        ctx.moveTo(-80, 10);
        ctx.lineTo(-80, 50);
        ctx.bezierCurveTo(-80, 75, 80, 75, 80, 50); // Bottom curve
        ctx.lineTo(80, 10);
        ctx.fill();

        // Top of Bottom Layer (Surface)
        ctx.fillStyle = '#F3E5F5';
        ctx.beginPath();
        ctx.ellipse(0, 10, 80, 25, 0, 0, Math.PI * 2);
        ctx.fill();

        // -- TOP LAYER --
        // Base
        const gradTop = ctx.createLinearGradient(-60, -50, 60, -50);
        gradTop.addColorStop(0, '#F48FB1'); // Pink
        gradTop.addColorStop(0.5, '#F8BBD0');
        gradTop.addColorStop(1, '#F48FB1');

        ctx.fillStyle = gradTop;
        ctx.beginPath();
        ctx.moveTo(-65, -40);
        ctx.lineTo(-65, 10);
        ctx.bezierCurveTo(-65, 30, 65, 30, 65, 10);
        ctx.lineTo(65, -40);
        ctx.fill();

        // -- ICING DRIPS (Top Layer) --
        ctx.fillStyle = '#FFF'; // White Icing
        ctx.beginPath();
        ctx.ellipse(0, -40, 65, 20, 0, 0, Math.PI * 2); // Top surface
        ctx.fill();

        // Drips
        ctx.beginPath();
        ctx.moveTo(-65, -40);
        // Create wavy drips
        for (let i = 0; i < 6; i++) {
            let startX = -65 + (i * 21.6);
            let endX = startX + 21.6;
            let dripHeight = (i % 2 === 0) ? 15 : 25;
            ctx.bezierCurveTo(startX + 5, -40 + dripHeight, endX - 5, -40 + dripHeight, endX, -40);
        }
        ctx.lineTo(65, -40);
        ctx.fill();

        // -- DECORATIONS --
        // Cherry on top? Or Sprinkles? Let's do sprinkles.
        const sprinkles = [
            { x: -20, y: -45, c: '#FFEB3B' }, { x: 10, y: -50, c: '#4CAF50' },
            { x: 30, y: -40, c: '#2196F3' }, { x: -40, y: -35, c: '#FF5722' },
            { x: 0, y: -35, c: '#9C27B0' }
        ];
        for (let s of sprinkles) {
            ctx.fillStyle = s.c;
            ctx.beginPath();
            ctx.ellipse(s.x, s.y, 3, 1.5, Math.random(), 0, Math.PI * 2);
            ctx.fill();
        }

        // -- CANDLE --
        ctx.fillStyle = '#80DEEA'; // Cyan
        ctx.fillRect(-6, -80, 12, 40);
        // Stripes
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-6, -75); ctx.lineTo(6, -70);
        ctx.moveTo(-6, -65); ctx.lineTo(6, -60);
        ctx.moveTo(-6, -55); ctx.lineTo(6, -50);
        ctx.stroke();

        // Wick
        ctx.fillStyle = '#333';
        ctx.fillRect(-1, -85, 2, 5);

        ctx.restore();

        // Flame
        if (candleLit) {
            const flameX = x;
            const flameY = y - 85 * scale;
            // Add flame particles
            particles.push(new Particle(flameX, flameY, 'flame'));
            particles.push(new Particle(flameX, flameY, 'flame'));
        }
    }

    function drawEmojiFace(ctx, cx, cy) {
        const size = 140; // Radius

        // Calculate "Look" direction based on mouse
        // Limit the eye movement to keep it inside the face
        const maxLook = 25;
        const dx = mouseX - cx;
        const dy = mouseY - cy;
        const dist = Math.hypot(dx, dy);
        const moveScale = Math.min(dist, 300) / 300; // 0 to 1 based on distance

        const angle = Math.atan2(dy, dx);
        const lookX = Math.cos(angle) * maxLook * moveScale;
        const lookY = Math.sin(angle) * maxLook * moveScale;

        ctx.save();
        ctx.translate(cx, cy);

        // -- FACE BASE (Sphere look) --
        const grad = ctx.createRadialGradient(-size / 3, -size / 3, size / 5, 0, 0, size);
        grad.addColorStop(0, '#FFEB3B'); // Highlight
        grad.addColorStop(0.8, '#FBC02D'); // Main Yellow
        grad.addColorStop(1, '#F57F17'); // Shadow Edge

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();

        // -- SHADOW/GLOW --
        // Inner glow for 3D feel
        ctx.shadowColor = 'rgba(0,0,0,0.1)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // -- EYES --
        // Eyes move slightly in direction of mouse (Parallax)
        const eyeOffsetX = 45;
        const eyeOffsetY = -20;
        const eyeWidth = 20;
        const eyeHeight = 30;

        ctx.fillStyle = '#3E2723'; // Dark Brown/Black

        // Left Eye
        ctx.beginPath();
        ctx.ellipse(-eyeOffsetX + lookX, eyeOffsetY + lookY, eyeWidth, eyeHeight, 0, 0, Math.PI * 2);
        ctx.fill();

        // Right Eye
        ctx.beginPath();
        ctx.ellipse(eyeOffsetX + lookX, eyeOffsetY + lookY, eyeWidth, eyeHeight, 0, 0, Math.PI * 2);
        ctx.fill();

        // -- MOUTH --
        // Smile that rotates slightly
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#3E2723';

        ctx.beginPath();
        // Dynamic smile: gets bigger when looking up?
        // Let's keep it simple but 3D.
        // The mouth moves less than eyes for depth effect
        const mouthX = lookX * 0.8;
        const mouthY = lookY * 0.8 + 40;

        ctx.arc(mouthX, mouthY, 50, 0.2, Math.PI - 0.2);
        ctx.stroke();

        // -- BLUSH --
        ctx.fillStyle = 'rgba(233, 30, 99, 0.2)'; // Pinkish transparent
        ctx.beginPath();
        ctx.ellipse(-60 + lookX * 0.5, 20 + lookY * 0.5, 25, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(60 + lookX * 0.5, 20 + lookY * 0.5, 25, 15, 0, 0, Math.PI * 2);
        ctx.fill();

        // -- HIGHLIGHT --
        // White reflection
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.ellipse(-size / 2, -size / 2, 30, 15, -Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // --- SOUND & VISUALS ---
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();

    function playPopSound() {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    }

    function drawVisualCue(ctx, targetX, targetY) {
        if (!candleLit) return;

        const textX = targetX + 120;
        const textY = targetY + 10;

        ctx.save();

        // Text
        ctx.font = "bold 16px 'Courier New', monospace";
        ctx.fillStyle = "#FFD700"; // Gold color
        ctx.textAlign = "left";
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 4;
        ctx.fillText("CLICK HERE", textX, textY);

        // Arrow
        ctx.strokeStyle = "#FFD700";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 4;

        ctx.beginPath();
        ctx.moveTo(textX - 10, textY - 5); // Start near text
        // Quadratic curve to the flame
        ctx.quadraticCurveTo(targetX + 60, targetY + 20, targetX + 20, targetY);
        ctx.stroke();

        // Arrowhead
        ctx.beginPath();
        ctx.moveTo(targetX + 20, targetY);
        ctx.lineTo(targetX + 30, targetY - 5);
        ctx.moveTo(targetX + 20, targetY);
        ctx.lineTo(targetX + 32, targetY + 8);
        ctx.stroke();

        ctx.restore();
    }

    function loop() {
        const entryScreen = document.getElementById('entry-screen');
        if (!entryScreen || !entryScreen.classList.contains('active')) {
            setTimeout(() => requestAnimationFrame(loop), 500);
            return;
        }

        ctx.clearRect(0, 0, width, height);

        // Draw Cake (Left)
        drawStylizedCake(ctx, width * 0.25, height * 0.6);

        // Visual Cue (Targeting the flame)
        // Cake is at width * 0.25, height * 0.6
        // Flame is approx at y - 150
        drawVisualCue(ctx, width * 0.25, height * 0.6 - 150);

        // Draw Emoji (Right)
        drawEmojiFace(ctx, width * 0.75, height * 0.6);

        // Update/Draw Particles
        for (let i = particles.length - 1; i >= 0; i--) {
            let p = particles[i];
            p.update();
            p.draw(ctx);
            if (p.life <= 0) particles.splice(i, 1);
        }

        requestAnimationFrame(loop);
    }

    // Start loop
    loop();

})();
