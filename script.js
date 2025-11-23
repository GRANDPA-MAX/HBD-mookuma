// --- CONFIGURATION ---
const PASSWORDS = {
    GAME: '2203',
    ADMIN: '5555' // Now Secret Message Zone
};

const GAME_CONFIG = {
    LANES: 4,
    TILE_SPEED: 2.5,
    SPAWN_RATE: 80,
    BALL_RADIUS: 15,
    HIT_ZONE_Y_OFFSET: 100
};

const DIFFICULTY_SETTINGS = {
    easy: { speed: 2, spawnRate: 100 },
    medium: { speed: 3, spawnRate: 70 },
    hard: { speed: 5, spawnRate: 40 }
};

// --- STATE ---
let currentPasswordInput = "";
let gameRunning = false;
let gamePaused = false;
let uploadedImages = []; // Kept for compatibility if we re-add upload later, but currently unused
let gameLoopId;
let score = 0;
let frames = 0;
let shownMessages = new Set();
let nextNoteTimeout;
let totalGained = 0;
let totalLost = 0;
let availableImagePool = [];
let lastShownImage = null;

// Timer State
let gameTimerInterval;
let gameTimeSeconds = 0;

// Message State
let currentMessageText = null;
let messageHideTimeout;

// Game Objects
let tiles = [];
let ball = {
    lane: 1,
    y: 0,
    targetLane: 1,
    x: 0
};

// --- DOM ELEMENTS ---
const screens = {
    entry: document.getElementById('entry-screen'),
    game: document.getElementById('game-screen'),
    secret: document.getElementById('secret-screen')
};
const passwordDisplay = document.getElementById('password-display');
const errorMsg = document.getElementById('error-msg');
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreVal = document.getElementById('score-val');
const timeVal = document.getElementById('time-val');
const difficultySelect = document.getElementById('difficulty-select');
const pauseBtn = document.getElementById('pause-btn');
const messageContainer = document.getElementById('message-container');

// --- DIFFICULTY LOGIC ---
if (difficultySelect) {
    difficultySelect.addEventListener('change', (e) => {
        const level = e.target.value;
        const settings = DIFFICULTY_SETTINGS[level];
        GAME_CONFIG.TILE_SPEED = settings.speed;
        GAME_CONFIG.SPAWN_RATE = settings.spawnRate;
        difficultySelect.blur();
    });
}

// --- ENTRY SCREEN LOGIC ---
function pressKey(key) {
    initAudio();
    playTone(800 + (Math.random() * 200), 0.1, 'sine');

    errorMsg.textContent = "";
    if (key === 'C') {
        currentPasswordInput = "";
    } else {
        if (currentPasswordInput.length < 4) {
            currentPasswordInput += key;
        }
    }
    updatePasswordDisplay();
}

function updatePasswordDisplay() {
    passwordDisplay.textContent = currentPasswordInput.padEnd(4, '-');
}

function submitPassword() {
    if (currentPasswordInput === PASSWORDS.GAME) {
        showScreen('game-screen');
        startGame();
    } else if (currentPasswordInput === PASSWORDS.ADMIN) {
        showScreen('secret-screen');
        initSecretVideo();
    } else {
        playTone(150, 0.5, 'sawtooth');
        errorMsg.textContent = "WRONG PASSWORD!";
        currentPasswordInput = "";
        updatePasswordDisplay();
    }
}

// --- NAVIGATION ---
function showScreen(screenId) {
    Object.values(screens).forEach(s => {
        if (s) s.classList.remove('active');
    });
    const screen = document.getElementById(screenId);
    if (screen) screen.classList.add('active');

    if (screenId !== 'game-screen') {
        stopGame();
    }

    // Stop video if leaving secret screen
    if (screenId !== 'secret-screen') {
        const video = document.getElementById('secret-video');
        if (video) {
            video.pause();
            video.currentTime = 0;
        }
    }
}

// --- GAME ENGINE ---
function resizeCanvas() {
    const maxWidth = 600;
    canvas.width = Math.min(window.innerWidth, maxWidth);
    canvas.height = window.innerHeight;
    ball.y = canvas.height - GAME_CONFIG.HIT_ZONE_Y_OFFSET;
}

function startGame() {
    if (gameRunning) return;
    gameRunning = true;
    gamePaused = false;
    score = 0;
    totalGained = 0;
    totalLost = 0;
    frames = 0;
    gameTimeSeconds = 0;
    tiles = [];
    ball.lane = 1;
    ball.targetLane = 1;
    scoreVal.innerText = score;
    updateTimerDisplay();
    shownMessages.clear();
    availableImagePool = [];
    lastShownImage = null;
    currentMessageText = null;

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    canvas.addEventListener('mousedown', handleInput);
    canvas.addEventListener('touchstart', handleInput, { passive: false });
    window.addEventListener('keydown', handleKeyInput);

    initAudio();
    startMusic();
    startTimer();

    gameLoop();
}

function stopGame() {
    gameRunning = false;
    cancelAnimationFrame(gameLoopId);
    window.removeEventListener('resize', resizeCanvas);
    canvas.removeEventListener('mousedown', handleInput);
    canvas.removeEventListener('touchstart', handleInput);
    window.removeEventListener('keydown', handleKeyInput);

    if (nextNoteTimeout) clearTimeout(nextNoteTimeout);
    if (musicInterval) clearInterval(musicInterval);
    stopTimer();
}

// --- TIMER LOGIC ---
function updateTimerDisplay() {
    if (!timeVal) return;
    const hours = Math.floor(gameTimeSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((gameTimeSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (gameTimeSeconds % 60).toString().padStart(2, '0');
    timeVal.textContent = `${hours}:${minutes}:${seconds}`;
}

function startTimer() {
    stopTimer();
    gameTimerInterval = setInterval(() => {
        if (!gamePaused && gameRunning) {
            gameTimeSeconds++;
            updateTimerDisplay();
        }
    }, 1000);
}

function stopTimer() {
    if (gameTimerInterval) clearInterval(gameTimerInterval);
}

// --- PAUSE LOGIC ---
function togglePause() {
    if (!gameRunning) return;
    gamePaused = !gamePaused;
    pauseBtn.textContent = gamePaused ? "▶" : "❚❚";

    if (gamePaused) {
        // PAUSE
        if (nextNoteTimeout) clearTimeout(nextNoteTimeout);
        if (musicInterval) clearInterval(musicInterval);
        stopTimer();

        // Handle Message & Score Summary
        let content = "";

        // If a message is currently showing, keep it and append score
        if (currentMessageText) {
            // Clear the hide timeout so it stays visible
            if (messageHideTimeout) clearTimeout(messageHideTimeout);

            content += `<div style="margin-bottom: 15px; font-size: 16px;">${currentMessageText}</div>`;
            content += `<hr style="border: 1px dashed #FFB7B2; margin: 10px 0; opacity: 0.5;">`;
        }

        // Add Score Summary
        content += `
            <div style="text-align: center;">
                <div style="font-size: 12px; margin-bottom: 5px;">PAUSED</div>
                <div style="font-size: 12px; margin-bottom: 10px;">TIME: ${timeVal.textContent}</div>
                <div style="font-size: 18px; margin-bottom: 10px;">SCORE: ${score}</div>
                <span style="color: #4CAF50; font-size: 12px;">+${totalGained} GAINED</span><br>
                <span style="color: #ff6b6b; font-size: 12px;">-${totalLost} LOST</span>
            </div>
        `;

        messageContainer.innerHTML = content;
        messageContainer.classList.add('show');

    } else {
        // RESUME
        startMusic();
        startTimer();
        gameLoop();

        // Restore Message State
        if (currentMessageText) {
            // Restore just the message text
            messageContainer.textContent = currentMessageText;
            // Restart the hide timer
            if (messageHideTimeout) clearTimeout(messageHideTimeout);
            messageHideTimeout = setTimeout(() => {
                messageContainer.classList.remove('show');
                currentMessageText = null;
            }, 5000);
        } else {
            // No message was showing, just hide container
            messageContainer.classList.remove('show');
        }
    }
}

if (pauseBtn) {
    pauseBtn.addEventListener('click', (e) => {
        e.target.blur();
        togglePause();
    });
}

function handleKeyInput(e) {
    if (!gameRunning) return;

    if (e.code === 'Space') {
        togglePause();
        return;
    }

    if (gamePaused) return;

    if (e.key === 'ArrowLeft') {
        if (ball.targetLane > 0) ball.targetLane--;
    } else if (e.key === 'ArrowRight') {
        if (ball.targetLane < GAME_CONFIG.LANES - 1) ball.targetLane++;
    }
}

function handleInput(e) {
    if (gamePaused) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = clientX - rect.left;

    const laneWidth = canvas.width / GAME_CONFIG.LANES;
    const clickedLane = Math.floor(x / laneWidth);

    if (clickedLane >= 0 && clickedLane < GAME_CONFIG.LANES) {
        ball.targetLane = clickedLane;
    }
}

function gameLoop() {
    if (!gameRunning) return;
    if (gamePaused) return;

    update();
    draw();

    gameLoopId = requestAnimationFrame(gameLoop);
}

function update() {
    frames++;

    ball.lane += (ball.targetLane - ball.lane) * 0.2;

    if (frames % GAME_CONFIG.SPAWN_RATE === 0) {
        const lane = Math.floor(Math.random() * GAME_CONFIG.LANES);
        const isGift = Math.random() < 0.1;

        tiles.push({
            lane: lane,
            y: -100,
            width: canvas.width / GAME_CONFIG.LANES,
            height: 80,
            active: true,
            isGift: isGift,
            color: isGift ? '#FFD700' : `hsl(${Math.random() * 360}, 70%, 80%)`
        });
    }

    for (let i = tiles.length - 1; i >= 0; i--) {
        let t = tiles[i];
        t.y += GAME_CONFIG.TILE_SPEED;

        if (t.active &&
            t.y + t.height > ball.y - GAME_CONFIG.BALL_RADIUS &&
            t.y < ball.y + GAME_CONFIG.BALL_RADIUS) {

            if (Math.round(ball.lane) === t.lane) {
                t.active = false;

                if (t.isGift) {
                    score += 5;
                    totalGained += 5;
                    showScoreFeedback(5);
                    spawnSurpriseImage();
                    playTone(1200, 0.1, 'sine');
                    playTone(1500, 0.1, 'sine');
                } else {
                    score++;
                    totalGained++;
                    showScoreFeedback(1);
                }
                scoreVal.innerText = score;
                t.color = '#fff';
            }
        }

        if (t.y > canvas.height) {
            if (t.active) {
                if (!t.isGift) {
                    score--;
                    totalLost++;
                    scoreVal.innerText = score;
                    showScoreFeedback(-1);
                }
            }
            tiles.splice(i, 1);
        }
    }

    checkMessages();
}

function checkMessages() {
    if (typeof ENABLE_MILESTONE_MESSAGES !== 'undefined' && !ENABLE_MILESTONE_MESSAGES) return;
    if (typeof MILESTONE_MESSAGES !== 'undefined') {
        MILESTONE_MESSAGES.forEach(msg => {
            if (score >= msg.score && !shownMessages.has(msg.score)) {
                showMessage(msg.text);
                shownMessages.add(msg.score);
            }
        });
    }
}

function showMessage(text) {
    currentMessageText = text;
    messageContainer.textContent = text;
    messageContainer.classList.add('show');

    if (messageHideTimeout) clearTimeout(messageHideTimeout);
    messageHideTimeout = setTimeout(() => {
        messageContainer.classList.remove('show');
        currentMessageText = null;
    }, 5000);
}

function spawnSurpriseImage() {
    if (typeof ENABLE_SURPRISE_IMAGES !== 'undefined' && !ENABLE_SURPRISE_IMAGES) return;
    const container = document.getElementById('background-popups');
    const img = document.createElement('img');
    img.classList.add('popup-img');

    let allImages = [];
    if (typeof LOCAL_IMAGES !== 'undefined') {
        allImages = allImages.concat(LOCAL_IMAGES.map(f => 'assets/' + f));
    }
    if (uploadedImages.length > 0) {
        allImages = allImages.concat(uploadedImages);
    }

    if (allImages.length === 0) {
        img.src = 'assets/sample.png';
    } else {
        if (availableImagePool.length === 0) {
            availableImagePool = [...allImages];
        }

        let selectedImage;
        if (availableImagePool.length === 1) {
            selectedImage = availableImagePool[0];
            availableImagePool = [];
        } else {
            let attempts = 0;
            do {
                const randomIndex = Math.floor(Math.random() * availableImagePool.length);
                selectedImage = availableImagePool[randomIndex];
                attempts++;
            } while (selectedImage === lastShownImage && attempts < 10 && availableImagePool.length > 1);

            availableImagePool = availableImagePool.filter(i => i !== selectedImage);
        }

        lastShownImage = selectedImage;
        img.src = selectedImage;
    }

    img.style.left = Math.random() * 80 + '%';
    container.appendChild(img);

    setTimeout(() => {
        img.remove();
    }, 15000);
}

function showScoreFeedback(amount) {
    const feedback = document.createElement('div');
    feedback.classList.add('score-feedback');
    feedback.textContent = amount > 0 ? `+${amount}` : amount;
    feedback.classList.add(amount > 0 ? 'positive' : 'negative');

    document.querySelector('.score').appendChild(feedback);

    setTimeout(() => {
        feedback.remove();
    }, 1000);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const laneWidth = canvas.width / GAME_CONFIG.LANES;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    for (let i = 1; i < GAME_CONFIG.LANES; i++) {
        ctx.beginPath();
        ctx.moveTo(i * laneWidth, 0);
        ctx.lineTo(i * laneWidth, canvas.height);
        ctx.stroke();
    }

    tiles.forEach(t => {
        if (!t.active) return;

        ctx.fillStyle = t.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = t.color;

        const x = t.lane * laneWidth + 10;
        const w = laneWidth - 20;
        ctx.fillRect(x, t.y, w, t.height);

        if (t.isGift) {
            ctx.fillStyle = '#FFF';
            ctx.font = '30px "Press Start 2P"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 4;
            ctx.fillText('?', x + w / 2, t.y + t.height / 2);
            ctx.shadowBlur = 0;

            const drawSparkle = (cx, cy, size, opacity) => {
                ctx.globalAlpha = opacity;
                ctx.fillStyle = '#FFF';
                ctx.fillRect(cx - size, cy - 1, size * 2, 2);
                ctx.fillRect(cx - 1, cy - size, 2, size * 2);
                ctx.globalAlpha = 1.0;
            };

            const sparkle1Opacity = Math.abs(Math.sin(frames * 0.1)) * 0.8;
            drawSparkle(x + 10, t.y + 10, 3, sparkle1Opacity);

            const sparkle2Opacity = Math.abs(Math.sin((frames + 20) * 0.15)) * 0.9;
            drawSparkle(x + w - 10, t.y + 8, 2.5, sparkle2Opacity);

            const sparkle3Opacity = Math.abs(Math.sin((frames + 40) * 0.2)) * 0.7;
            drawSparkle(x + w - 8, t.y + t.height - 12, 2, sparkle3Opacity);

            const sparkle4Opacity = Math.abs(Math.cos(frames * 0.12)) * 0.75;
            drawSparkle(x + 8, t.y + t.height - 10, 2.5, sparkle4Opacity);
        }

        ctx.shadowBlur = 0;
    });

    const ballX = (ball.lane * laneWidth) + (laneWidth / 2);

    ctx.fillStyle = '#FFB7B2';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#FFB7B2';
    ctx.beginPath();
    ctx.arc(ballX, ball.y, GAME_CONFIG.BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.moveTo(0, ball.y);
    ctx.lineTo(canvas.width, ball.y);
    ctx.stroke();
}

// --- AUDIO ENGINE ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;
let musicInterval;
let noteIndex = 0;

const NOTES = {
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23,
    'G4': 392.00, 'A4': 440.00, 'B4': 493.88, 'C5': 523.25,
    'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99
};

const SONG = [
    ['C4', 0.5], ['C4', 0.5], ['D4', 1], ['C4', 1], ['F4', 1], ['E4', 2],
    ['C4', 0.5], ['C4', 0.5], ['D4', 1], ['C4', 1], ['G4', 1], ['F4', 2],
    ['C4', 0.5], ['C4', 0.5], ['C5', 1], ['A4', 1], ['F4', 1], ['E4', 1], ['D4', 1],
    ['A4', 0.5], ['A4', 0.5], ['F4', 1], ['C4', 1], ['G4', 1], ['F4', 2]
];

function initAudio() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playTone(freq, duration, type = 'square') {
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = type;
    osc.frequency.value = freq;

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start();

    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    osc.stop(audioCtx.currentTime + duration);
}

function startMusic() {
    if (musicInterval) clearInterval(musicInterval);
    if (nextNoteTimeout) clearTimeout(nextNoteTimeout);

    musicInterval = setInterval(() => {
        if (!gameRunning) {
            clearInterval(musicInterval);
            return;
        }
    }, 1000);

    playNextNote();
}

function playNextNote() {
    if (!gameRunning || gamePaused) return;

    const noteData = SONG[noteIndex % SONG.length];
    const noteName = noteData[0];
    const beats = noteData[1];

    if (NOTES[noteName]) {
        const duration = beats * (0.5 / (GAME_CONFIG.TILE_SPEED / 2.5));
        playTone(NOTES[noteName], duration);
    }

    noteIndex++;

    const msPerBeat = 400 / (GAME_CONFIG.TILE_SPEED / 2.5);
    nextNoteTimeout = setTimeout(playNextNote, beats * msPerBeat);
}

// --- SECRET VIDEO LOGIC ---
function initSecretVideo() {
    const video = document.getElementById('secret-video');
    const playBtn = document.getElementById('vid-play-btn');
    const seekBar = document.getElementById('vid-seek-bar');
    const replayBtn = document.getElementById('vid-replay-btn');

    if (!video) return;

    // Set Source
    if (typeof SECRET_VIDEO_FILE !== 'undefined') {
        video.src = 'assets/' + SECRET_VIDEO_FILE;
    } else {
        video.src = 'assets/video1.mp4'; // Fallback
    }

    // Play/Pause Toggle
    playBtn.onclick = function () {
        if (video.paused) {
            video.play();
            playBtn.textContent = "❚❚";
        } else {
            video.pause();
            playBtn.textContent = "▶";
        }
    };

    // Replay
    replayBtn.onclick = function () {
        video.currentTime = 0;
        video.play();
        playBtn.textContent = "❚❚";
    };

    // Seek Bar Update
    video.ontimeupdate = function () {
        const value = (100 / video.duration) * video.currentTime;
        seekBar.value = value;
    };

    // Seek Bar Input
    seekBar.oninput = function () {
        const time = video.duration * (seekBar.value / 100);
        video.currentTime = time;
    };

    // Reset button when ended
    video.onended = function () {
        playBtn.textContent = "▶";
    };
}
