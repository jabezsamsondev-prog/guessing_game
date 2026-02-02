// Game State
const state = {
  level: "easy",
  codeLength: 4,
  maxChances: 10,
  chancesLeft: 10,
  secretCode: [],
  currentInput: [],
  gameActive: false,
  soundEnabled: true,
};

const LEVELS = {
  easy: { len: 4, chances: 10 },
  medium: { len: 6, chances: 8 },
  hard: { len: 8, chances: 6 },
};

// DOM Elements
const screens = {
  start: document.getElementById("start-screen"),
  game: document.getElementById("game-screen"),
};

const ui = {
  diffButtons: document.querySelectorAll(".diff-btn"),
  displayAttempts: document.getElementById("chances-display"),
  historyContainer: document.getElementById("history-container"),
  inputRow: document.getElementById("current-input-row"),
  keys: document.querySelectorAll(".key"),
  resultOverlay: document.getElementById("result-overlay"),
  resultTitle: document.getElementById("result-title"),
  resultMessage: document.getElementById("result-message"),
  codeReveal: document.getElementById("code-reveal"),
  restartBtn: document.getElementById("restart-btn"),
  quitBtn: document.getElementById("quit-btn"),
  soundBtn: document.getElementById("sound-btn"),
  soundIconOn: document.getElementById("sound-icon-on"),
  soundIconOff: document.getElementById("sound-icon-off"),
};

// Audio Context
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = new AudioContext();

function playTone(freq, type, duration) {
  if (!state.soundEnabled) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  osc.start();
  gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(
    0.001,
    audioCtx.currentTime + duration,
  );
  osc.stop(audioCtx.currentTime + duration);
}

const sounds = {
  click: () => playTone(800, "sine", 0.1),
  enter: () => playTone(600, "triangle", 0.15),
  error: () => playTone(150, "sawtooth", 0.3),
  win: () => {
    [440, 554, 659, 880].forEach((f, i) =>
      setTimeout(() => playTone(f, "sine", 0.4), i * 150),
    );
  },
  lose: () => {
    [300, 200, 100].forEach((f, i) =>
      setTimeout(() => playTone(f, "sawtooth", 0.4), i * 200),
    );
  },
};

// Initialization
function init() {
  setupEventListeners();
}

function setupEventListeners() {
  // Difficulty Selection
  ui.diffButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const level = btn.dataset.level;
      startGame(level);
      sounds.click();
    });
  });

  // Keypad - click
  ui.keys.forEach((key) => {
    key.addEventListener("click", (e) => {
      // Prevent double firing on some touch devices
      e.preventDefault();
      handleKeyInput(key.dataset.val || key.id);
    });
  });

  // Keypad - keyboard
  document.addEventListener("keydown", (e) => {
    if (!state.gameActive) return;
    if (!isNaN(e.key)) handleKeyInput(e.key);
    if (e.key === "Backspace") handleKeyInput("clear-btn");
    if (e.key === "Enter") handleKeyInput("submit-guess");
  });

  // Controls
  ui.restartBtn.addEventListener("click", () => {
    resetGame(); // Go back to start screen or restart same level? Let's go to start screen for ease
    sounds.click();
  });

  ui.quitBtn.addEventListener("click", () => {
    resetGame();
    sounds.click();
  });

  ui.soundBtn.addEventListener("click", toggleSound);
}

function toggleSound() {
  state.soundEnabled = !state.soundEnabled;
  ui.soundIconOn.classList.toggle("hidden");
  ui.soundIconOff.classList.toggle("hidden");
}

function startGame(level) {
  // Set State
  state.level = level;
  state.codeLength = LEVELS[level].len;
  state.maxChances = LEVELS[level].chances;
  state.chancesLeft = state.maxChances;
  state.currentInput = [];
  state.gameActive = true;

  // Generate Code
  state.secretCode = Array.from({ length: state.codeLength }, () =>
    Math.floor(Math.random() * 10),
  ); // 0-9
  console.log("Secret Code (Dev):", state.secretCode);

  // Update UI
  ui.displayAttempts.innerText = state.chancesLeft;
  ui.historyContainer.innerHTML =
    '<div class="empty-state">Start guessing...</div>';

  renderInputSlots();

  // Switch Screens
  screens.start.classList.remove("active");
  setTimeout(() => screens.start.classList.add("hidden"), 400);

  screens.game.classList.remove("hidden");
  // slight delay to allow display reset
  requestAnimationFrame(() => {
    screens.game.classList.add("active");
  });
}

function resetGame() {
  state.gameActive = false;
  ui.resultOverlay.classList.add("hidden");

  screens.game.classList.remove("active");
  setTimeout(() => screens.game.classList.add("hidden"), 400);

  screens.start.classList.remove("hidden");
  requestAnimationFrame(() => {
    screens.start.classList.add("active");
  });
}

function renderInputSlots() {
  ui.inputRow.innerHTML = "";
  for (let i = 0; i < state.codeLength; i++) {
    const slot = document.createElement("div");
    slot.className = "input-slot";

    if (state.currentInput[i] !== undefined) {
      slot.textContent = state.currentInput[i];
      slot.classList.add("filled");
    }

    // Highlight logic (active slot)
    if (
      i === state.currentInput.length &&
      state.currentInput.length < state.codeLength
    ) {
      slot.classList.add("active");
    }

    ui.inputRow.appendChild(slot);
  }
}

function handleKeyInput(val) {
  if (!state.gameActive) return;

  if (val === "clear-btn") {
    if (state.currentInput.length > 0) {
      state.currentInput.pop();
      sounds.click();
      renderInputSlots();
    }
    return;
  }

  if (val === "submit-guess") {
    if (state.currentInput.length === state.codeLength) {
      submitGuess();
    } else {
      ui.inputRow.classList.add("shake");
      sounds.error();
      setTimeout(() => ui.inputRow.classList.remove("shake"), 400);
    }
    return;
  }

  // Number input
  if (state.currentInput.length < state.codeLength) {
    state.currentInput.push(parseInt(val));
    sounds.click();
    renderInputSlots();
  }
}

function submitGuess() {
  sounds.enter();
  const guess = [...state.currentInput];
  const target = [...state.secretCode];

  // Calculate results (Wordle style logic)
  const result = new Array(state.codeLength).fill("absent");
  const targetFreq = {};

  // Frequency map of target
  target.forEach((num) => (targetFreq[num] = (targetFreq[num] || 0) + 1));

  // 1. Find Greens (Exact matches)
  guess.forEach((num, i) => {
    if (num === target[i]) {
      result[i] = "correct";
      targetFreq[num]--;
    }
  });

  // 2. Find Yellows (Present but wrong spot)
  guess.forEach((num, i) => {
    if (result[i] !== "correct") {
      if (targetFreq[num] > 0) {
        result[i] = "present";
        targetFreq[num]--;
      }
    }
  });

  // Add to History
  addGuessToHistory(guess, result);

  // Check Win
  const isWin = result.every((r) => r === "correct");

  if (isWin) {
    endGame(true);
  } else {
    state.chancesLeft--;
    ui.displayAttempts.textContent = state.chancesLeft;

    if (state.chancesLeft <= 0) {
      endGame(false);
    } else {
      // Reset input
      state.currentInput = [];
      renderInputSlots();
      // Scroll history
      setTimeout(() => {
        ui.historyContainer.scrollTop = ui.historyContainer.scrollHeight;
      }, 100);
    }
  }
}

function addGuessToHistory(guess, result) {
  // Clear empty state if first guess
  const emptyState = ui.historyContainer.querySelector(".empty-state");
  if (emptyState) emptyState.remove();

  const row = document.createElement("div");
  row.className = "guess-row";

  guess.forEach((num, i) => {
    const box = document.createElement("div");
    box.className = `digit-box ${result[i]}`;
    box.textContent = num;
    row.appendChild(box);
  });

  ui.historyContainer.appendChild(row);
}

function endGame(isWin) {
    state.gameActive = false;
    
    if (isWin) {
        sounds.win();
        ui.resultTitle.textContent = "ACCESS GRANTED";
        ui.resultTitle.className = "win-text";
        ui.resultMessage.textContent = "You cracked the code!";
        fireConfetti();
    } else {
        sounds.lose();
        ui.resultTitle.textContent = "ACCESS DENIED";
        ui.resultTitle.className = "lose-text";
        ui.resultMessage.textContent = "Don't give up! Give it another shot.";
    }

    // Reveal Code
    ui.codeReveal.innerHTML = '';
    state.secretCode.forEach(num => {
        const span = document.createElement('div');
        span.className = 'digit-box correct'; // show all as correct style
        span.textContent = num;
        ui.codeReveal.appendChild(span);
    });

    // Show Overlay
    setTimeout(() => {
        ui.resultOverlay.classList.remove('hidden');
    }, 800);
}

// Simple Confetti Effect
function fireConfetti() {
    createParticles();
}

function createParticles() {
    const colors = ['#00f2ff', '#bd00ff', '#00ff9d', '#ffffff'];
    for (let i = 0; i < 100; i++) {
        const p = document.createElement('div');
        p.style.position = 'fixed';
        p.style.width = Math.random() * 8 + 4 + 'px';
        p.style.height = Math.random() * 8 + 4 + 'px';
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        p.style.left = '50%';
        p.style.top = '50%';
        p.style.borderRadius = '50%';
        p.style.pointerEvents = 'none';
        p.style.zIndex = '1000';
        document.body.appendChild(p);

        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * 10 + 5;
        const tx = Math.cos(angle) * 300 * Math.random();
        const ty = Math.sin(angle) * 300 * Math.random();

        p.animate([
            { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
            { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0)`, opacity: 0 }
        ], {
            duration: 1000 + Math.random() * 1000,
            easing: 'cubic-bezier(0, .9, .57, 1)',
            fill: 'forwards'
        }).onfinish = () => p.remove();
    }
}

init();
