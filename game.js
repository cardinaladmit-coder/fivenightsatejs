/* Five Nights at EJ's
   Vanilla HTML/CSS/JS + Canvas. No build step.

   You can tweak difficulty and add/swap EJ threats from the CONFIG section below.
   Asset swaps:
   - Put your images in /assets using the filenames in ASSET_SLOTS and THREATS.
   - If a file is missing, the game auto-generates a labeled placeholder image at runtime.
*/

// -------------------------
// CONFIG (tune me)
// -------------------------

const CONFIG = {
  // Night length / clock pacing. The in-game clock goes 12 AM → 6 AM (6 "hours").
  NIGHT_DURATION_SECONDS: 240, // 4 minutes per night (was 300). Lower = faster nights.

  // Power model
  POWER_START: 100,
  POWER_DRAIN_BASE_PER_SEC: 0.045, // always draining a little
  POWER_DRAIN_CAMERA_PER_SEC: 0.12,
  POWER_DRAIN_DOOR_CLOSED_PER_SEC: 0.11, // per closed door
  POWER_DRAIN_LIGHT_ON_PER_SEC: 0.15, // per light
  POWER_DRAIN_SPIKE_DOOR_TOGGLE: 0.20,
  POWER_DRAIN_SPIKE_CAMERA_TOGGLE: 0.12,

  // How quickly nights get harder (also affects power drain a bit)
  NIGHT_DIFFICULTY_MULT: [1.0, 1.35, 1.7, 2.1, 2.5],

  // Threat movement timing (seconds). Each threat rolls a random delay per step.
  THREAT_MOVE_BASE_MIN_SEC: 5,
  THREAT_MOVE_BASE_MAX_SEC: 9,
  THREAT_MOVE_NIGHT_MULT: [1.0, 0.80, 0.65, 0.52, 0.42], // lower = faster movement

  // How long a threat waits at a door before attempting to enter (seconds).
  DOOR_WAIT_MIN_SEC: 1.5,
  DOOR_WAIT_MAX_SEC: 3.5,

  // How long EJ waits after a blocked door before trying again (seconds).
  DOOR_BOUNCE_MIN_SEC: 2,
  DOOR_BOUNCE_MAX_SEC: 4,

  // If the threat is at an open door, this is how long until you get got.
  OFFICE_ATTACK_GRACE_SEC: 0.35,

  // How long the full-screen jumpscare image stays up before game over (milliseconds).
  JUMPSCARE_DURATION_MS: 2500,

  // Camera feel
  CAMERA_STATIC_INTENSITY: 0.22,
  CAMERA_SCANLINE_INTENSITY: 0.22,
  CAMERA_FLICKER_CHANCE_PER_SEC: 0.12,

  // Input / UI
  DOUBLE_CLICK_PROTECTION_MS: 120,

  // Background music swells as EJ gets closer (never gets super loud).
  PROXIMITY_MUSIC_MIN_VOLUME: 0.07,
  PROXIMITY_MUSIC_MAX_VOLUME: 0.36,
  PROXIMITY_MUSIC_SMOOTH_SPEED: 2.8,
};

// Add/swap threats here (this is the main "dead simple" customization point).
// You can add more threats by appending objects (and adding the corresponding asset files).
const THREATS = [
  {
    id: "threat1",
    name: "EJ (Classic)",
    faceImg: "assets/ej_threat1.png",
    jumpscareImg: "assets/ej_jumpscare1.png",
    speed: 1.15,
  },
  {
    id: "threat2",
    name: "EJ (Goblin Mode)",
    faceImg: "assets/ej_threat2.png",
    jumpscareImg: "assets/ej_jumpscare2.png",
    speed: 1.3,
  },
  {
    id: "threat3",
    name: "EJ (Sneaky)",
    faceImg: "assets/ej_threat3.png",
    jumpscareImg: "assets/ej_jumpscare3.png",
    speed: 1.45,
  },
  {
    id: "threat4",
    name: "EJ (Turbo)",
    faceImg: "assets/ej_threat4.png",
    jumpscareImg: "assets/ej_jumpscare4.png",
    speed: 1.6,
  },
];

// Which (and how many) threats are active per night.
// Tweak this to make nights gentler or meaner.
const THREATS_PER_NIGHT = [3, 3, 4, 4, 4];

// All intro / end story text in one place. Edit these to change what players see.
const MESSAGES = {
  gameTitle: "Five Nights at EJ's",
  titleLine1: "FIVE NIGHTS",
  titleLine2: "AT EJ'S",
  titleHint: "Five nights. One office. Don't get touched.",
  getStartedLabel: "Let's Get Started",
  introSubtitle: "Survive 12 AM → 6 AM. Keep the doors shut. Keep the power up. Don't let EJ touch you.",
  nightCongrats: (nightNum) => `Congrats! You survived Night ${nightNum}.`,
  finalNightCongrats: "Congrats! You beat all 5 nights!",
  finalNightCleared: "EJ has been defeated (for now). Your valuables remain untouched.",
  winMessage: "Five nights down. EJ may return… but not tonight.",
  gameOver: (ejName) => `${ejName} reached your office. Unfortunate.`,
};

// Which two EJ photos appear on the title/cover screen (must match THREATS ids above).
// Uses ej_threat1.png and ej_threat2.png by default.
const TITLE_COVER_THREATS = ["threat1", "threat2"];

// Asset slots for environment. You can replace these files in /assets.
const ASSET_SLOTS = {
  titleBg: "assets/title_bg.png",
  winScreen: "assets/win_screen.png",
  gameOverBg: "assets/gameover_bg.png",
  officeBg: "assets/office_bg.png",
  hallways: "assets/hallways.png",
  doorLeft: "assets/door_left.png",
  doorRight: "assets/door_right.png",
  cameraMap: "assets/camera_map.png",
  rooms: [
    "assets/room_cam1.png",
    "assets/room_cam2.png",
    "assets/room_cam3.png",
    "assets/room_cam4.png",
    "assets/room_cam5.png",
    "assets/room_cam6.png",
    "assets/room_cam7.png",
    "assets/room_cam8.png",
  ],
};

// Optional audio files. If missing, the game will use WebAudio beeps.
const AUDIO_SLOTS = {
  ambient: "assets/audio/ambient_hum.mp3",
  bgMusic: "assets/audio/bg_music.mp3",
  door: "assets/audio/door_clunk.mp3",
  camera: "assets/audio/camera_blip.mp3",
  jumpscare: "assets/audio/jumpscare_stinger.mp3",
};

// -------------------------
// Minimal helpers
// -------------------------

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const chance = (p) => Math.random() < p;

function nowMs() {
  return performance.now();
}

function formatAmHour(hourIndex) {
  // hourIndex: 0..6 where 0 = 12AM, 1=1AM ... 6=6AM
  if (hourIndex === 0) return "12:00 AM";
  if (hourIndex < 12) return `${hourIndex}:00 AM`;
  return `${hourIndex - 12}:00 PM`;
}

// -------------------------
// Placeholder asset generator (so the game runs before you add real images)
// -------------------------

function makePlaceholderDataUrl(label, w = 960, h = 540, bg = "#223043") {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);

  // Simple “poster” gradient
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "rgba(255,255,255,0.10)");
  grad.addColorStop(1, "rgba(0,0,0,0.20)");
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);

  // Frame
  g.strokeStyle = "rgba(255,255,255,0.22)";
  g.lineWidth = Math.max(3, Math.floor(w * 0.008));
  g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);

  // Label text
  const pad = Math.floor(w * 0.06);
  const maxWidth = w - pad * 2;
  g.fillStyle = "rgba(255,255,255,0.92)";
  g.font = `700 ${Math.floor(w * 0.04)}px ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
  g.textAlign = "left";
  g.textBaseline = "top";
  g.fillText("PLACEHOLDER", pad, pad);

  g.fillStyle = "rgba(255,255,255,0.86)";
  g.font = `600 ${Math.floor(w * 0.030)}px ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
  wrapText(g, label, pad, pad + Math.floor(w * 0.06), maxWidth, Math.floor(w * 0.04));

  g.fillStyle = "rgba(168,255,106,0.75)";
  g.font = `600 ${Math.floor(w * 0.018)}px ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
  g.fillText("Drop your real image in /assets with this filename.", pad, h - pad - Math.floor(w * 0.024));

  return c.toDataURL("image/png");
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = (text || "").split(/\s+/g).filter(Boolean);
  let line = "";
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

function loadImageOrPlaceholder(src, placeholderLabel, { w = 960, h = 540, bg } = {}) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      const ph = new Image();
      ph.onload = () => resolve(ph);
      ph.src = makePlaceholderDataUrl(placeholderLabel, w, h, bg || "#23324a");
    };
    img.src = src;
  });
}

// Like loadImageOrPlaceholder, but returns null instead of an ugly placeholder box.
function loadImageOptional(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// -------------------------
// Sound (file if present, else synthesized beeps)
// -------------------------

class Sound {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this._musicNode = null;
    this._lastAmbientStart = 0;
    this.files = new Map(); // key => HTMLAudioElement
    this._bgMusicEl = null;
    this._bgMusicPlaying = false;
    this._proximityVolume = CONFIG.PROXIMITY_MUSIC_MIN_VOLUME;
    this._proximityOsc = null;
    this._proximityGain = null;
    this.unlocked = false;
    this._assetsReady = false;
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this.stopNightAudio();
    if (on) this.ensureAudioContext();
  }

  ensureAudioContext() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
  }

  async unlock() {
    // Call in a user gesture to allow audio on Safari/Chrome/mobile autoplay rules.
    this.unlocked = true;
    this.ensureAudioContext();
    if (this.ctx && this.ctx.state === "suspended") {
      try { await this.ctx.resume(); } catch {}
    }
  }

  waitForAudioReady(a, timeoutMs = 15000) {
    if (a.readyState >= 3) return Promise.resolve(true);
    return new Promise((resolve) => {
      const done = (ok) => {
        clearTimeout(timer);
        a.removeEventListener("canplaythrough", onReady);
        a.removeEventListener("loadeddata", onReady);
        a.removeEventListener("error", onErr);
        resolve(ok);
      };
      const onReady = () => done(true);
      const onErr = () => done(false);
      const timer = setTimeout(() => done(a.readyState >= 2), timeoutMs);
      a.addEventListener("canplaythrough", onReady, { once: true });
      a.addEventListener("loadeddata", onReady, { once: true });
      a.addEventListener("error", onErr, { once: true });
    });
  }

  async loadFile(key, src) {
    const a = new Audio();
    a.preload = "auto";
    a.volume = 0.65;
    this.files.set(key, a);
    a.src = src;
    await this.waitForAudioReady(a);
  }

  setAssetsReady(ready) {
    this._assetsReady = ready;
  }

  playFile(key, { volume = 0.75 } = {}) {
    if (!this.enabled) return false;
    const a = this.files.get(key);
    if (!a) return false;
    try {
      a.currentTime = 0;
      a.volume = volume;
      void a.play();
      return true;
    } catch {
      return false;
    }
  }

  beep({ freq = 440, ms = 90, type = "square", gain = 0.035 } = {}) {
    if (!this.enabled) return;
    this.ensureAudioContext();
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + ms / 1000 + 0.02);
  }

  doorClunk() {
    if (this.playFile("door")) return;
    this.beep({ freq: 120, ms: 120, type: "sawtooth", gain: 0.06 });
    setTimeout(() => this.beep({ freq: 70, ms: 140, type: "square", gain: 0.05 }), 40);
  }

  camBlip() {
    if (this.playFile("camera", { volume: 0.7 })) return;
    this.beep({ freq: 880, ms: 70, type: "square", gain: 0.03 });
    setTimeout(() => this.beep({ freq: 660, ms: 65, type: "square", gain: 0.025 }), 60);
  }

  jumpscareSting() {
    if (this.playFile("jumpscare", { volume: 1.0 })) return;
    this.beep({ freq: 55, ms: 280, type: "sawtooth", gain: 0.1 });
    setTimeout(() => this.beep({ freq: 110, ms: 240, type: "square", gain: 0.08 }), 80);
    setTimeout(() => this.beep({ freq: 220, ms: 220, type: "triangle", gain: 0.065 }), 140);
  }

  startAmbient() {
    if (!this.enabled) return;
    // If a file exists, loop it; else generate a gentle hum.
    if (this.playFile("ambient", { volume: 0.35 })) {
      const a = this.files.get("ambient");
      if (a) a.loop = true;
      return;
    }
    this.ensureAudioContext();
    if (!this.ctx) return;
    const since = nowMs() - this._lastAmbientStart;
    if (since < 800) return;
    this._lastAmbientStart = nowMs();
    this.stopAmbient();

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 56;
    g.gain.value = 0.018;

    // Add a slow wobble
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 0.18;
    lfoGain.gain.value = 4.0;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start();
    lfo.start();

    this._musicNode = { osc, g, lfo, lfoGain };
  }

  stopAmbient() {
    const a = this.files.get("ambient");
    if (a) {
      try { a.pause(); } catch {}
    }
    const n = this._musicNode;
    if (!n) return;
    try { n.osc.stop(); } catch {}
    try { n.lfo.stop(); } catch {}
    this._musicNode = null;
  }

  async startProximityMusic() {
    if (!this.enabled || !this.unlocked || !this._assetsReady) return false;

    const track = this.files.get("bgMusic");
    if (track) {
      if (this._bgMusicPlaying && !track.paused) return true;
      this._proximityVolume = CONFIG.PROXIMITY_MUSIC_MIN_VOLUME;
      track.loop = true;
      track.volume = this._proximityVolume;
      const ready = await this.waitForAudioReady(track, 12000);
      if (!ready) return false;
      try {
        await track.play();
        this._bgMusicEl = track;
        this._bgMusicPlaying = true;
        return true;
      } catch {
        this._bgMusicPlaying = false;
        this._bgMusicEl = null;
        return false;
      }
    }

    if (this._bgMusicPlaying && this._proximityOsc) return true;
    this._proximityVolume = CONFIG.PROXIMITY_MUSIC_MIN_VOLUME;
    this.ensureAudioContext();
    if (!this.ctx) return false;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 110;
    g.gain.value = this._proximityVolume * 0.055;
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start();
    this._proximityOsc = osc;
    this._proximityGain = g;
    this._bgMusicPlaying = true;
    return true;
  }

  setProximityLevel(level, dt) {
    if (!this.enabled || !this._bgMusicPlaying) return;
    const target = lerp(
      CONFIG.PROXIMITY_MUSIC_MIN_VOLUME,
      CONFIG.PROXIMITY_MUSIC_MAX_VOLUME,
      clamp(level, 0, 1),
    );
    const smooth = 1 - Math.exp(-CONFIG.PROXIMITY_MUSIC_SMOOTH_SPEED * dt);
    this._proximityVolume = lerp(this._proximityVolume, target, smooth);

    if (this._bgMusicEl) {
      this._bgMusicEl.volume = this._proximityVolume;
    }
    if (this._proximityGain) {
      this._proximityGain.gain.value = this._proximityVolume * 0.055;
    }
  }

  stopProximityMusic() {
    this._bgMusicPlaying = false;
    this._bgMusicEl = null;
    const track = this.files.get("bgMusic");
    if (track) {
      try { track.pause(); } catch {}
    }
    if (this._proximityOsc) {
      try { this._proximityOsc.stop(); } catch {}
      this._proximityOsc = null;
    }
    this._proximityGain = null;
  }

  stopNightAudio() {
    this.stopAmbient();
    this.stopProximityMusic();
  }
}

// -------------------------
// Rooms + map
// -------------------------

// Room ids are 0..7. Two special “door nodes” represent waiting at doors.
const ROOM = {
  BACKSTAGE: 0,
  STORAGE: 1,
  BREAK: 2,
  HALL_W: 3,
  HALL_E: 4,
  LOUNGE: 5,
  COPY: 6,
  KITCHEN: 7,
  DOOR_LEFT: 100,
  DOOR_RIGHT: 101,
  OFFICE: 999,
};

const ROOM_NAMES = [
  "Pigott Hall",
  "Main Quad",
  "Zephyr",
  "The Shed",
  "Roble",
  "Retreat House",
  "Mac's",
  "Old Union",
];

// Two main paths that converge toward each door.
// Threats start at BACKSTAGE and choose a lane; they might occasionally swap.
const PATHS = {
  LEFT: [ROOM.BACKSTAGE, ROOM.STORAGE, ROOM.HALL_W, ROOM.DOOR_LEFT, ROOM.OFFICE],
  RIGHT: [ROOM.BACKSTAGE, ROOM.BREAK, ROOM.HALL_E, ROOM.DOOR_RIGHT, ROOM.OFFICE],
  WANDER: [
    [ROOM.BACKSTAGE, ROOM.STORAGE, ROOM.LOUNGE, ROOM.HALL_W, ROOM.DOOR_LEFT, ROOM.OFFICE],
    [ROOM.BACKSTAGE, ROOM.BREAK, ROOM.KITCHEN, ROOM.HALL_E, ROOM.DOOR_RIGHT, ROOM.OFFICE],
    [ROOM.BACKSTAGE, ROOM.COPY, ROOM.HALL_W, ROOM.DOOR_LEFT, ROOM.OFFICE],
    [ROOM.BACKSTAGE, ROOM.COPY, ROOM.HALL_E, ROOM.DOOR_RIGHT, ROOM.OFFICE],
  ],
};

// -------------------------
// Game state + threat AI
// -------------------------

const STORAGE_KEY = "fnaej_progress_v1";

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { maxNightBeaten: 0 };
    const obj = JSON.parse(raw);
    return { maxNightBeaten: clamp(obj.maxNightBeaten || 0, 0, 5) };
  } catch {
    return { maxNightBeaten: 0 };
  }
}

function saveProgress(p) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {}
}

class Threat {
  constructor(def, lane, difficultyMult, nightIndex) {
    this.def = def;
    this.lane = lane; // "LEFT" | "RIGHT" | "WANDER"
    this.path = this.pickPath();
    this.pathIndex = 0; // starts at BACKSTAGE
    this.room = this.path[this.pathIndex];
    this.alive = true;
    this.waitingAtDoor = false;
    this.doorWaitUntil = 0;
    this.nextMoveAt = 0;
    this.nightIndex = nightIndex;

    // Effective speed: higher = faster movement.
    this.speed = (def.speed || 1) * difficultyMult;
    this.scheduleNextMove(0);
  }

  pickPath() {
    if (this.lane === "LEFT") return PATHS.LEFT.slice();
    if (this.lane === "RIGHT") return PATHS.RIGHT.slice();
    return PATHS.WANDER[Math.floor(Math.random() * PATHS.WANDER.length)].slice();
  }

  atLeftDoor() {
    return this.room === ROOM.DOOR_LEFT;
  }

  atRightDoor() {
    return this.room === ROOM.DOOR_RIGHT;
  }

  inOffice() {
    return this.room === ROOM.OFFICE;
  }

  scheduleNextMove(fromNowSec) {
    const baseMin = CONFIG.THREAT_MOVE_BASE_MIN_SEC;
    const baseMax = CONFIG.THREAT_MOVE_BASE_MAX_SEC;
    const nightMult = CONFIG.THREAT_MOVE_NIGHT_MULT[this.nightIndex] ?? 0.75;
    const delay = fromNowSec > 0 ? fromNowSec : rand(baseMin, baseMax) * nightMult * (1 / this.speed);
    this.nextMoveAt = performance.now() + delay * 1000;
  }

  step() {
    if (!this.alive) return;
    if (this.inOffice()) return;
    const nxt = this.pathIndex + 1;
    if (nxt >= this.path.length) return;
    this.pathIndex = nxt;
    this.room = this.path[this.pathIndex];
  }
}

class Game {
  constructor(canvas, overlayRoot) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.overlayRoot = overlayRoot;

    this.sound = new Sound();
    this.progress = loadProgress();

    this.assets = {
      // environment
      titleBg: null,
      winScreen: null,
      gameOverBg: null,
      officeBg: null,
      hallways: null,
      doorLeft: null,
      doorRight: null,
      cameraMap: null,
      rooms: [],
      // threats
      threatFaces: new Map(), // id => img
      jumpscares: new Map(), // id => img
    };

    // UI state
    this.mode = "TITLE"; // TITLE | PLAY | CAM | JUMPSCARE | GAMEOVER | NIGHTCLEAR | WIN
    this.camRoom = 0;
    this.camFlicker = 0;
    this.helpOpen = false;
    this.titleMenuOpen = false;

    // Night state
    this.nightIndex = 0; // 0..4
    this.power = CONFIG.POWER_START;
    this.leftDoorClosed = false;
    this.rightDoorClosed = false;
    this.leftLightOn = false;
    this.rightLightOn = false;
    this.usageLevel = 1;
    this.timeStartMs = 0;
    this.elapsedSec = 0;
    this.hourIndex = 0;
    this.attackCountdown = null; // { threatId, untilMs }
    this.lastScareThreatId = null;

    // Threats
    this.threats = [];

    // Input tracking
    this.pointer = { x: 0, y: 0, down: false, lastClickMs: 0 };

    // Office UI hitboxes (in canvas coordinates)
    this.officeButtons = this.makeOfficeButtons();

    // Camera overlay (separate canvas for crisp UI)
    this.cameraPanel = null;
    this.cameraFeedCanvas = null;
    this.cameraFeedCtx = null;

    this.bindInput();
    this.resizeForDpi();
    window.addEventListener("resize", () => this.resizeForDpi());
  }

  resizeForDpi() {
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const cssW = 960;
    const cssH = 540;
    this.canvas.width = cssW * dpr;
    this.canvas.height = cssH * dpr;
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  makeOfficeButtons() {
    // Layout is designed for 960x540 canvas coordinate space.
    // Doors are left/right. Buttons live in lower corners.
    return {
      left: {
        close: { x: 42, y: 408, w: 140, h: 46, label: "CLOSE" },
        light: { x: 42, y: 462, w: 140, h: 46, label: "LIGHT" },
      },
      right: {
        close: { x: 960 - 42 - 140, y: 408, w: 140, h: 46, label: "CLOSE" },
        light: { x: 960 - 42 - 140, y: 462, w: 140, h: 46, label: "LIGHT" },
      },
    };
  }

  bindInput() {
    const rectForEvent = (e) => this.canvas.getBoundingClientRect();
    const toCanvasXY = (e) => {
      const r = rectForEvent(e);
      const x = ((e.clientX - r.left) / r.width) * 960;
      const y = ((e.clientY - r.top) / r.height) * 540;
      return { x, y };
    };

    this.canvas.addEventListener("pointermove", (e) => {
      const p = toCanvasXY(e);
      this.pointer.x = p.x;
      this.pointer.y = p.y;
    });

    this.canvas.addEventListener("pointerdown", async (e) => {
      this.pointer.down = true;
      const clickMs = nowMs();
      if (clickMs - this.pointer.lastClickMs < CONFIG.DOUBLE_CLICK_PROTECTION_MS) return;
      this.pointer.lastClickMs = clickMs;
      await this.sound.unlock();
      const p = toCanvasXY(e);
      this.handleCanvasClick(p.x, p.y);
    });

    this.canvas.addEventListener("pointerup", () => {
      this.pointer.down = false;
    });

    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      if (e.key === "c" || e.key === "C") this.toggleCameras();
      if (e.key === "Escape") {
        if (this.mode === "CAM") this.toggleCameras();
        else if (this.helpOpen) this.toggleHelp(false);
      }
      if (this.mode === "PLAY") {
        if (e.key === "a" || e.key === "A") this.toggleDoor("left");
        if (e.key === "d" || e.key === "D") this.toggleDoor("right");
        if (e.key === "q" || e.key === "Q") this.setLight("left", !this.leftLightOn);
        if (e.key === "e" || e.key === "E") this.setLight("right", !this.rightLightOn);
      }
    });
  }

  handleCanvasClick(x, y) {
    if (this.mode !== "PLAY") return;
    const hit = (b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
    const L = this.officeButtons.left;
    const R = this.officeButtons.right;

    if (hit(L.close)) return this.toggleDoor("left");
    if (hit(R.close)) return this.toggleDoor("right");
    if (hit(L.light)) return this.setLight("left", !this.leftLightOn);
    if (hit(R.light)) return this.setLight("right", !this.rightLightOn);
  }

  async loadAssets() {
    // Environment
    this.assets.titleBg = await loadImageOptional(ASSET_SLOTS.titleBg);
    this.assets.winScreen = await loadImageOptional(ASSET_SLOTS.winScreen);
    this.assets.gameOverBg = await loadImageOptional(ASSET_SLOTS.gameOverBg);
    this.assets.officeBg = await loadImageOrPlaceholder(ASSET_SLOTS.officeBg, "office_bg.png", { w: 960, h: 540, bg: "#141a22" });
    this.assets.hallways = await loadImageOrPlaceholder(ASSET_SLOTS.hallways, "hallways.png", { w: 320, h: 540, bg: "#121820" });
    this.assets.doorLeft = await loadImageOrPlaceholder(ASSET_SLOTS.doorLeft, "door_left.png", { w: 320, h: 540, bg: "#1a1f2a" });
    this.assets.doorRight = await loadImageOrPlaceholder(ASSET_SLOTS.doorRight, "door_right.png", { w: 320, h: 540, bg: "#1a1f2a" });
    this.assets.cameraMap = await loadImageOrPlaceholder(ASSET_SLOTS.cameraMap, "camera_map.png", { w: 420, h: 280, bg: "#1a202b" });

    this.assets.rooms = [];
    for (let i = 0; i < ASSET_SLOTS.rooms.length; i++) {
      const src = ASSET_SLOTS.rooms[i];
      this.assets.rooms.push(await loadImageOrPlaceholder(src, `room_cam${i + 1}.png`, { w: 960, h: 540, bg: "#0f141b" }));
    }

    // Threat faces + jumpscares
    for (const t of THREATS) {
      this.assets.threatFaces.set(
        t.id,
        await loadImageOrPlaceholder(t.faceImg, t.faceImg.split("/").pop(), { w: 420, h: 420, bg: "#2a1933" }),
      );
      this.assets.jumpscares.set(
        t.id,
        await loadImageOrPlaceholder(t.jumpscareImg, t.jumpscareImg.split("/").pop(), { w: 960, h: 540, bg: "#330b0b" }),
      );
    }

    // Audio
    await this.sound.loadFile("ambient", AUDIO_SLOTS.ambient);
    await this.sound.loadFile("bgMusic", AUDIO_SLOTS.bgMusic);
    await this.sound.loadFile("door", AUDIO_SLOTS.door);
    await this.sound.loadFile("camera", AUDIO_SLOTS.camera);
    await this.sound.loadFile("jumpscare", AUDIO_SLOTS.jumpscare);
    this.sound.setAssetsReady(true);
    this.bindAudioUnlockHandlers();
    this.setAudioHintVisible(this.sound.enabled);
  }

  // -------------------------
  // Screens / overlays
  // -------------------------

  clearOverlays() {
    this.overlayRoot.innerHTML = "";
  }

  mountOverlay(html) {
    this.overlayRoot.innerHTML = html;
  }

  showTitle() {
    this.mode = "TITLE";
    this.titleMenuOpen = false;
    this.clearOverlays();
    this.updateChromeVisibility();
  }

  showTitleMenu() {
    this.mode = "TITLE";
    this.titleMenuOpen = true;
    this.updateChromeVisibility();
    const unlocked = this.progress.maxNightBeaten;
    const nightOptions = Array.from({ length: 5 }, (_, i) => {
      const nightNum = i + 1;
      const enabled = unlocked >= i;
      return `<button class="btn" type="button" data-night="${i}" ${enabled ? "" : "disabled"}>Night ${nightNum}${enabled ? "" : " (locked)"}</button>`;
    }).join("");

    this.mountOverlay(`
      <div class="overlay overlay-title-menu" role="dialog" aria-label="Title menu">
        <div class="panel panel-title-menu">
          <div class="panel-header">
            <div class="panel-title">${MESSAGES.gameTitle}</div>
            <div class="panel-actions">
              <button id="uiBackHome" class="btn" type="button">Back</button>
              <button id="uiSound" class="btn" type="button">SOUND: ${this.sound.enabled ? "ON" : "OFF"}</button>
            </div>
          </div>
          <div class="panel-body">
            <h1 class="title">${MESSAGES.gameTitle}</h1>
            <p class="subtitle">${MESSAGES.introSubtitle}</p>

            <div class="menu-grid">
              <div class="menu-row">
                <button id="uiStart" class="btn btn-primary" type="button">Start Night 1</button>
                <button id="uiContinue" class="btn" type="button" ${unlocked > 0 ? "" : "disabled"}>Continue (Night ${Math.min(unlocked + 1, 5)})</button>
                <button id="uiReset" class="btn" type="button">Reset Progress</button>
              </div>
              <div class="menu-row" style="align-items:center; gap:12px; flex-wrap:wrap;">
                <span class="hud-label">Night Select (unlocks as you win)</span>
              </div>
              <div class="menu-row" style="gap:10px; flex-wrap:wrap;">
                ${nightOptions}
              </div>
              <div class="menu-row">
                <button id="uiHow" class="btn" type="button">How to Play</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `);

    const $ = (id) => this.overlayRoot.querySelector(id);
    $("#uiBackHome")?.addEventListener("click", () => this.showTitle());
    $("#uiStart")?.addEventListener("click", async () => {
      await this.sound.unlock();
      this.startNight(0);
    });
    $("#uiContinue")?.addEventListener("click", async () => {
      await this.sound.unlock();
      const idx = clamp(this.progress.maxNightBeaten, 0, 4);
      this.startNight(idx);
    });
    $("#uiReset")?.addEventListener("click", () => {
      this.progress.maxNightBeaten = 0;
      saveProgress(this.progress);
      this.showTitleMenu();
    });
    $("#uiHow")?.addEventListener("click", () => this.toggleHelp(true));
    $("#uiSound")?.addEventListener("click", async () => {
      this.sound.setEnabled(!this.sound.enabled);
      if (this.sound.enabled) await this.ensureBackgroundMusic();
      else this.setAudioHintVisible(false);
      this.showTitleMenu();
    });
    this.overlayRoot.querySelectorAll("button[data-night]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await this.sound.unlock();
        const idx = parseInt(btn.getAttribute("data-night"), 10);
        this.startNight(idx);
      });
    });
  }

  toggleHelp(open) {
    this.helpOpen = open;
    if (!open) {
      // Return to previous overlay if we're on title; otherwise just close help.
      if (this.mode === "TITLE") {
        if (this.titleMenuOpen) this.showTitleMenu();
        else this.showTitle();
      }
      else this.clearOverlays();
      return;
    }
    this.mountOverlay(`
      <div class="overlay" role="dialog" aria-label="Help">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">How to Play</div>
            <div class="panel-actions">
              <button id="uiCloseHelp" class="btn btn-primary" type="button">Close</button>
            </div>
          </div>
          <div class="panel-body help">
            <p><strong>Goal:</strong> survive from <strong>12 AM</strong> to <strong>6 AM</strong>.</p>
            <p><strong>Cameras:</strong> hit <kbd>C</kbd> or click <strong>CAMERAS</strong> to watch rooms. Threats advance faster when you ignore them.</p>
            <p><strong>Doors:</strong> left and right each have a <strong>CLOSE</strong> and <strong>LIGHT</strong>. Close blocks EJ at that side. Light reveals if EJ is waiting.</p>
            <p><strong>Power:</strong> everything drains power. If power hits <strong>0%</strong>, doors open and you’re defenseless.</p>
            <p><strong>Audio cue:</strong> a background track plays quietly the whole time the game is open and <strong>slowly gets louder</strong> as EJ gets closer to your office during a night. It never gets super loud — but if the music swells, check your doors.</p>
            <p><strong>Keyboard:</strong> <kbd>A</kbd> left door, <kbd>D</kbd> right door, <kbd>Q</kbd> left light, <kbd>E</kbd> right light, <kbd>C</kbd> cameras, <kbd>Esc</kbd> close cameras/help.</p>
            <p style="color: rgba(255,214,90,0.92)"><strong>Pro tip:</strong> Don’t camp both doors closed. Use the lights to confirm, then close only when needed.</p>
          </div>
        </div>
      </div>
    `);
    this.overlayRoot.querySelector("#uiCloseHelp")?.addEventListener("click", () => this.toggleHelp(false));
  }

  showNightClear() {
    this.mode = "NIGHTCLEAR";
    this.titleMenuOpen = false;
    this.updateChromeVisibility();
    const nightNum = this.nightIndex + 1;
    const nextNight = nightNum + 1;
    const isWin = nightNum >= 5;
    this.mountOverlay(`
      <div class="overlay" role="dialog" aria-label="Night cleared">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">${isWin ? "Victory" : "Night Cleared"}</div>
            <div class="panel-actions">
              <button id="uiToTitle" class="btn" type="button">Title</button>
              <button id="uiNext" class="btn btn-primary" type="button">${isWin ? "You Win!" : `Start Night ${nextNight}`}</button>
            </div>
          </div>
          <div class="panel-body">
            <h2 class="congrats-title">${isWin ? MESSAGES.finalNightCongrats : MESSAGES.nightCongrats(nightNum)}</h2>
            <p class="subtitle">${isWin ? MESSAGES.finalNightCleared : "Keep your doors ready — EJ isn't giving up."}</p>
          </div>
        </div>
      </div>
    `);
    this.overlayRoot.querySelector("#uiToTitle")?.addEventListener("click", () => this.showTitle());
    this.overlayRoot.querySelector("#uiNext")?.addEventListener("click", () => {
      if (isWin) this.showWin();
      else this.startNight(this.nightIndex + 1);
    });
  }

  showWin() {
    this.mode = "WIN";
    this.titleMenuOpen = false;
    this.updateChromeVisibility();
    this.mountOverlay(`
      <div class="overlay" role="dialog" aria-label="Win screen">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">You Win</div>
            <div class="panel-actions">
              <button id="uiWinTitle" class="btn btn-primary" type="button">Back to Title</button>
            </div>
          </div>
          <div class="panel-body">
            <h2 class="congrats-title">${MESSAGES.finalNightCongrats}</h2>
            <p class="subtitle">${MESSAGES.winMessage}</p>
          </div>
        </div>
      </div>
    `);
    this.overlayRoot.querySelector("#uiWinTitle")?.addEventListener("click", () => this.showTitle());
  }

  showGameOver(threatId) {
    this.mode = "GAMEOVER";
    this.titleMenuOpen = false;
    this.updateChromeVisibility();
    const t = THREATS.find((x) => x.id === threatId);
    const name = t?.name || "EJ";
    this.mountOverlay(`
      <div class="overlay" role="dialog" aria-label="Game over">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">Game Over</div>
            <div class="panel-actions">
              <button id="uiRetry" class="btn btn-primary" type="button">Retry Night</button>
              <button id="uiGoTitle" class="btn" type="button">Title</button>
            </div>
          </div>
          <div class="panel-body">
            <p class="subtitle">${MESSAGES.gameOver(name)}</p>
          </div>
        </div>
      </div>
    `);
    this.overlayRoot.querySelector("#uiRetry")?.addEventListener("click", () => this.startNight(this.nightIndex));
    this.overlayRoot.querySelector("#uiGoTitle")?.addEventListener("click", () => this.showTitle());
  }

  // -------------------------
  // Cameras overlay
  // -------------------------

  openCameras() {
    if (this.mode !== "PLAY") return;
    this.mode = "CAM";
    this.sound.camBlip();
    this.power = clamp(this.power - CONFIG.POWER_DRAIN_SPIKE_CAMERA_TOGGLE, 0, 100);
    this.mountOverlay(`
      <div class="overlay" role="dialog" aria-label="Cameras">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">Security Cameras</div>
            <div class="panel-actions">
              <button id="uiCamClose" class="btn btn-primary" type="button">Close</button>
            </div>
          </div>
          <div class="panel-body cam-layout">
            <div class="cam-feed">
              <canvas id="camFeed" width="960" height="540" aria-label="Camera feed"></canvas>
              <div style="margin-top: 10px; display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
                <div class="hud-label">CLICK A ROOM • ESC TO CLOSE</div>
                <div class="hud-label" id="camRoomLabel"></div>
              </div>
            </div>
            <div class="cam-map">
              <div class="hud-label">MAP</div>
              <div style="margin-top:10px; border-radius: 12px; overflow:hidden; border:1px solid rgba(255,255,255,0.10);">
                <img id="camMapImg" alt="Camera map" style="width:100%; height:auto; display:block;" />
              </div>
              <div class="room-grid" id="roomGrid"></div>
              <div class="help" style="margin-top:10px; opacity:0.92">
                <p><strong>Tip:</strong> if you see an EJ in the hall near a door, get ready to close that side.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `);

    // Set map image src
    const mapImg = this.overlayRoot.querySelector("#camMapImg");
    if (mapImg) mapImg.src = this.assets.cameraMap?.src || "";

    this.cameraFeedCanvas = this.overlayRoot.querySelector("#camFeed");
    this.cameraFeedCtx = this.cameraFeedCanvas?.getContext("2d") || null;

    const grid = this.overlayRoot.querySelector("#roomGrid");
    const label = this.overlayRoot.querySelector("#camRoomLabel");
    if (label) label.textContent = `VIEW: ${ROOM_NAMES[this.camRoom]}`;

    if (grid) {
      grid.innerHTML = "";
      for (let i = 0; i < 8; i++) {
        const btn = document.createElement("button");
        btn.className = `room-btn ${i === this.camRoom ? "active" : ""}`;
        btn.textContent = `CAM ${i + 1}`;
        btn.addEventListener("click", () => {
          this.camRoom = i;
          this.sound.camBlip();
          this.overlayRoot.querySelectorAll(".room-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          const lbl = this.overlayRoot.querySelector("#camRoomLabel");
          if (lbl) lbl.textContent = `VIEW: ${ROOM_NAMES[this.camRoom]}`;
          this.camFlicker = 0.16;
        });
        grid.appendChild(btn);
      }
    }

    this.overlayRoot.querySelector("#uiCamClose")?.addEventListener("click", () => this.closeCameras());
  }

  closeCameras() {
    if (this.mode !== "CAM") return;
    this.mode = "PLAY";
    this.sound.camBlip();
    this.power = clamp(this.power - CONFIG.POWER_DRAIN_SPIKE_CAMERA_TOGGLE, 0, 100);
    this.clearOverlays();
    this.cameraFeedCanvas = null;
    this.cameraFeedCtx = null;
  }

  toggleCameras() {
    if (this.mode === "CAM") this.closeCameras();
    else if (this.mode === "PLAY") this.openCameras();
  }

  // -------------------------
  // Night lifecycle
  // -------------------------

  updateChromeVisibility() {
    const app = document.getElementById("app");
    const isTitleHome = this.mode === "TITLE" && !this.titleMenuOpen;
    const hideHud = this.mode === "TITLE" || this.mode === "WIN" || this.mode === "GAMEOVER" || this.mode === "NIGHTCLEAR";

    app?.classList.toggle("title-mode", isTitleHome);

    const getStarted = document.getElementById("btnGetStarted");
    if (getStarted) {
      getStarted.textContent = MESSAGES.getStartedLabel;
      getStarted.classList.toggle("ui-hidden", !isTitleHome);
    }
  }

  startNight(nightIndex) {
    this.helpOpen = false;
    this.clearOverlays();
    this.mode = "PLAY";
    this.titleMenuOpen = false;
    this.updateChromeVisibility();
    this.nightIndex = clamp(nightIndex, 0, 4);
    this.power = CONFIG.POWER_START;
    this.leftDoorClosed = false;
    this.rightDoorClosed = false;
    this.leftLightOn = false;
    this.rightLightOn = false;
    this.attackCountdown = null;
    this.camRoom = 0;
    this.camFlicker = 0;
    this.timeStartMs = performance.now();
    this.elapsedSec = 0;
    this.hourIndex = 0;

    const diff = CONFIG.NIGHT_DIFFICULTY_MULT[this.nightIndex] ?? 1;
    const activeCount = clamp(THREATS_PER_NIGHT[this.nightIndex] ?? 3, 1, THREATS.length);
    const defs = THREATS.slice(0, activeCount);

    // Mix lanes so pressure alternates.
    const lanes = ["LEFT", "RIGHT", "WANDER", "WANDER"];
    this.threats = defs.map((d, i) => new Threat(d, lanes[i % lanes.length], diff, this.nightIndex));

    this.ensureBackgroundMusic();
    this.updateHud();
  }

  setAudioHintVisible(show) {
    const el = document.getElementById("audioHint");
    if (el) el.classList.toggle("ui-hidden", !show);
  }

  async ensureBackgroundMusic() {
    if (!this.sound.enabled) {
      this.setAudioHintVisible(false);
      return false;
    }
    const started = await this.sound.startProximityMusic();
    this.setAudioHintVisible(this.sound.enabled && !started && this.sound.unlocked);
    return started;
  }

  bindAudioUnlockHandlers() {
    if (this._audioHandlersBound) return;
    this._audioHandlersBound = true;

    const tryAudio = () => {
      void (async () => {
        await this.sound.unlock();
        await this.ensureBackgroundMusic();
      })();
    };

    // pointerdown works better than click alone on phones/tablets.
    document.addEventListener("pointerdown", tryAudio, { passive: true });
    document.addEventListener("keydown", tryAudio);
  }

  getThreatProximity(th) {
    if (!th.alive) return 0;
    if (th.inOffice()) return 1;
    if (th.atLeftDoor() || th.atRightDoor()) return th.waitingAtDoor ? 0.92 : 0.86;
    const steps = Math.max(1, th.path.length - 1);
    return clamp(th.pathIndex / steps, 0, 0.78);
  }

  computeClosestThreatProximity() {
    let closest = 0;
    for (const th of this.threats) {
      closest = Math.max(closest, this.getThreatProximity(th));
    }
    return closest;
  }

  updateProximityMusic(dt) {
    const level = this.computeClosestThreatProximity();
    this.sound.setProximityLevel(level, dt);
  }

  clearNight() {
    const nightNum = this.nightIndex + 1;
    if (nightNum > this.progress.maxNightBeaten) {
      this.progress.maxNightBeaten = nightNum;
      saveProgress(this.progress);
    }
    if (nightNum >= 5) {
      this.showNightClear();
    } else {
      this.showNightClear();
    }
  }

  // -------------------------
  // Door / light actions
  // -------------------------

  toggleDoor(side) {
    if (this.power <= 0) return;
    if (side === "left") {
      this.leftDoorClosed = !this.leftDoorClosed;
      this.sound.doorClunk();
      this.power = clamp(this.power - CONFIG.POWER_DRAIN_SPIKE_DOOR_TOGGLE, 0, 100);
    } else {
      this.rightDoorClosed = !this.rightDoorClosed;
      this.sound.doorClunk();
      this.power = clamp(this.power - CONFIG.POWER_DRAIN_SPIKE_DOOR_TOGGLE, 0, 100);
    }
  }

  setLight(side, on) {
    if (this.power <= 0) on = false;
    if (side === "left") this.leftLightOn = on;
    else this.rightLightOn = on;
  }

  // -------------------------
  // Simulation update
  // -------------------------

  computeUsageLevel() {
    // 1..4 bars
    let bars = 1; // base
    if (this.mode === "CAM") bars += 1;
    if (this.leftDoorClosed) bars += 1;
    if (this.rightDoorClosed) bars += 1;
    if (this.leftLightOn) bars += 1;
    if (this.rightLightOn) bars += 1;
    return clamp(bars, 1, 4);
  }

  drainPower(dt) {
    if (this.power <= 0) return;
    const diff = CONFIG.NIGHT_DIFFICULTY_MULT[this.nightIndex] ?? 1;
    let drain = CONFIG.POWER_DRAIN_BASE_PER_SEC;
    if (this.mode === "CAM") drain += CONFIG.POWER_DRAIN_CAMERA_PER_SEC;
    if (this.leftDoorClosed) drain += CONFIG.POWER_DRAIN_DOOR_CLOSED_PER_SEC;
    if (this.rightDoorClosed) drain += CONFIG.POWER_DRAIN_DOOR_CLOSED_PER_SEC;
    if (this.leftLightOn) drain += CONFIG.POWER_DRAIN_LIGHT_ON_PER_SEC;
    if (this.rightLightOn) drain += CONFIG.POWER_DRAIN_LIGHT_ON_PER_SEC;

    // Nights 4-5 are slightly more punishing on power usage.
    const nightPunish = lerp(1.0, 1.14, clamp((this.nightIndex - 2) / 2, 0, 1));
    this.power = clamp(this.power - drain * dt * diff * nightPunish, 0, 100);
    if (this.power <= 0) {
      this.leftDoorClosed = false;
      this.rightDoorClosed = false;
      this.leftLightOn = false;
      this.rightLightOn = false;
      this.sound.beep({ freq: 90, ms: 280, type: "sine", gain: 0.06 });
    }
  }

  updateClock() {
    this.elapsedSec = (performance.now() - this.timeStartMs) / 1000;
    const t = clamp(this.elapsedSec / CONFIG.NIGHT_DURATION_SECONDS, 0, 1);
    const hours = Math.floor(t * 6); // 0..6
    this.hourIndex = clamp(hours, 0, 6);
    if (this.hourIndex >= 6) {
      this.clearNight();
    }
  }

  updateThreats() {
    if (this.mode !== "PLAY" && this.mode !== "CAM") return;
    const tNow = performance.now();

    // If a threat is currently attacking (at open door), handle grace window.
    if (this.attackCountdown && tNow >= this.attackCountdown.untilMs) {
      this.triggerJumpscare(this.attackCountdown.threatId);
      return;
    }

    // Threat movement: schedule and step.
    for (const th of this.threats) {
      if (!th.alive || th.inOffice()) continue;

      // Small chance to change route to keep you guessing.
      const swapChance = (this.nightIndex >= 2 ? 0.012 : 0.006) * (1 + (th.speed - 1) * 0.5);
      if (th.room !== ROOM.DOOR_LEFT && th.room !== ROOM.DOOR_RIGHT && chance(swapChance)) {
        th.lane = chance(0.5) ? "LEFT" : "RIGHT";
        th.path = th.pickPath();
        // Re-anchor to the closest index where the current room exists, else keep current index.
        const idx = th.path.indexOf(th.room);
        if (idx >= 0) th.pathIndex = idx;
      }

      if (tNow < th.nextMoveAt) continue;

      // If at door, start waiting behavior.
      if (th.atLeftDoor() || th.atRightDoor()) {
        if (!th.waitingAtDoor) {
          th.waitingAtDoor = true;
          const wait = rand(CONFIG.DOOR_WAIT_MIN_SEC, CONFIG.DOOR_WAIT_MAX_SEC) * (1 / th.speed);
          th.doorWaitUntil = tNow + wait * 1000;
          th.scheduleNextMove(wait);
          continue;
        }
        if (tNow < th.doorWaitUntil) {
          th.scheduleNextMove((th.doorWaitUntil - tNow) / 1000);
          continue;
        }

        // Attempt entry: if door closed, bounce back; else start attack grace.
        if (th.atLeftDoor()) {
          if (this.leftDoorClosed) {
            th.waitingAtDoor = false;
            th.room = ROOM.HALL_W;
            th.pathIndex = Math.max(0, th.path.indexOf(ROOM.HALL_W));
            th.scheduleNextMove(rand(CONFIG.DOOR_BOUNCE_MIN_SEC, CONFIG.DOOR_BOUNCE_MAX_SEC));
          } else {
            this.startAttackGrace(th.def.id);
          }
        } else if (th.atRightDoor()) {
          if (this.rightDoorClosed) {
            th.waitingAtDoor = false;
            th.room = ROOM.HALL_E;
            th.pathIndex = Math.max(0, th.path.indexOf(ROOM.HALL_E));
            th.scheduleNextMove(rand(CONFIG.DOOR_BOUNCE_MIN_SEC, CONFIG.DOOR_BOUNCE_MAX_SEC));
          } else {
            this.startAttackGrace(th.def.id);
          }
        }
        continue;
      }

      // Normal movement forward
      th.step();
      th.scheduleNextMove(0);
    }
  }

  startAttackGrace(threatId) {
    if (this.power <= 0) {
      // Power out: no grace, you are cooked.
      this.triggerJumpscare(threatId);
      return;
    }
    // If you’re actively holding the correct door closed, cancel.
    const th = this.threats.find((x) => x.def.id === threatId);
    if (!th) return;
    if (th.atLeftDoor() && this.leftDoorClosed) return;
    if (th.atRightDoor() && this.rightDoorClosed) return;

    // Start (or refresh) a brief grace window to react.
    const untilMs = performance.now() + CONFIG.OFFICE_ATTACK_GRACE_SEC * 1000;
    this.attackCountdown = { threatId, untilMs };
    // A subtle warning beep.
    this.sound.beep({ freq: 210, ms: 70, type: "square", gain: 0.025 });
  }

  triggerJumpscare(threatId) {
    this.mode = "JUMPSCARE";
    this.lastScareThreatId = threatId;
    this.attackCountdown = null;
    this.sound.jumpscareSting();

    // Show jumpscare, then game over overlay.
    setTimeout(() => {
      if (this.mode === "JUMPSCARE") this.showGameOver(threatId);
    }, CONFIG.JUMPSCARE_DURATION_MS);
  }

  updateHud() {
    const hudNight = document.getElementById("hudNight");
    const hudTime = document.getElementById("hudTime");
    const hudPower = document.getElementById("hudPower");
    const barsWrap = document.getElementById("hudUsageBars");

    if (hudNight) hudNight.textContent = String(this.nightIndex + 1);
    if (hudTime) hudTime.textContent = formatAmHour(this.hourIndex);
    if (hudPower) hudPower.textContent = `${Math.ceil(this.power)}%`;

    this.usageLevel = this.computeUsageLevel();
    if (barsWrap) {
      const bars = Array.from(barsWrap.querySelectorAll(".bar"));
      bars.forEach((b, i) => b.classList.toggle("on", i < this.usageLevel));
    }
  }

  // -------------------------
  // Rendering
  // -------------------------

  drawHallwayViews(g) {
    const hall = this.assets.hallways;
    if (!hall) return;
    // Hallway photo visible in door openings; doors slide closed on top.
    g.drawImage(hall, 0, 0, 320, 540);
    g.save();
    g.translate(960, 0);
    g.scale(-1, 1);
    g.drawImage(hall, 0, 0, 320, 540);
    g.restore();
  }

  drawOffice(g) {
    // Background
    g.drawImage(this.assets.officeBg, 0, 0, 960, 540);
    this.drawHallwayViews(g);

    // Doors (render overlays when closed)
    // Left door graphic: slide in from left for a nice feel
    const leftX = this.leftDoorClosed ? 0 : -250;
    g.drawImage(this.assets.doorLeft, leftX, 0, 320, 540);

    const rightX = this.rightDoorClosed ? 960 - 320 : 960 - 320 + 250;
    g.drawImage(this.assets.doorRight, rightX, 0, 320, 540);

    // Side lights glow when on
    if (this.leftLightOn) this.drawLightGlow(g, 110, 280, "left");
    if (this.rightLightOn) this.drawLightGlow(g, 850, 280, "right");

    // If light is on, show if a threat is waiting at that door
    if (this.leftLightOn) this.drawDoorThreatHint(g, "left");
    if (this.rightLightOn) this.drawDoorThreatHint(g, "right");

    // Power out vignette
    if (this.power <= 0) {
      g.fillStyle = "rgba(0,0,0,0.55)";
      g.fillRect(0, 0, 960, 540);
      g.fillStyle = "rgba(255, 58, 58, 0.16)";
      g.fillRect(0, 0, 960, 540);
      g.font = "700 18px ui-monospace, Menlo, Monaco, Consolas, 'Courier New', monospace";
      g.fillStyle = "rgba(255,255,255,0.92)";
      g.fillText("POWER OUT", 22, 30);
    }

    // Buttons
    this.drawOfficeButtons(g);

    // If an attack is pending, draw a subtle red pulse.
    if (this.attackCountdown) {
      const t = (this.attackCountdown.untilMs - performance.now()) / (CONFIG.OFFICE_ATTACK_GRACE_SEC * 1000);
      const a = clamp(1 - t, 0, 1);
      g.fillStyle = `rgba(255,58,58,${0.10 + 0.22 * a})`;
      g.fillRect(0, 0, 960, 540);
    }

    this.drawFilmGrain(g, 0.09);
  }

  drawOfficeButtons(g) {
    const drawBtn = (b, active, tone = "normal") => {
      g.save();
      const r = 10;
      const grad = g.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
      const base = tone === "danger" ? [255, 58, 58] : tone === "accent" ? [168, 255, 106] : [210, 227, 234];
      const alpha = active ? 0.28 : 0.14;
      grad.addColorStop(0, `rgba(${base[0]},${base[1]},${base[2]},${alpha})`);
      grad.addColorStop(1, "rgba(0,0,0,0.25)");
      g.fillStyle = grad;
      g.strokeStyle = active ? "rgba(168,255,106,0.45)" : "rgba(255,255,255,0.14)";
      g.lineWidth = 2;
      roundRect(g, b.x, b.y, b.w, b.h, r);
      g.fill();
      g.stroke();

      g.font = "700 14px ui-monospace, Menlo, Monaco, Consolas, 'Courier New', monospace";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = "rgba(255,255,255,0.88)";
      g.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 0.5);
      g.restore();
    };

    drawBtn(this.officeButtons.left.close, this.leftDoorClosed, "normal");
    drawBtn(this.officeButtons.left.light, this.leftLightOn, "accent");
    drawBtn(this.officeButtons.right.close, this.rightDoorClosed, "normal");
    drawBtn(this.officeButtons.right.light, this.rightLightOn, "accent");
  }

  drawLightGlow(g, x, y, side) {
    g.save();
    const rad = 165;
    const grad = g.createRadialGradient(x, y, 10, x, y, rad);
    grad.addColorStop(0, "rgba(255, 214, 90, 0.25)");
    grad.addColorStop(0.45, "rgba(255, 214, 90, 0.10)");
    grad.addColorStop(1, "rgba(255, 214, 90, 0.0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();

    // Slight cone
    g.globalAlpha = 0.25;
    g.fillStyle = "rgba(255, 214, 90, 0.10)";
    g.beginPath();
    if (side === "left") {
      g.moveTo(0, 130);
      g.lineTo(300, 260);
      g.lineTo(0, 390);
    } else {
      g.moveTo(960, 130);
      g.lineTo(660, 260);
      g.lineTo(960, 390);
    }
    g.closePath();
    g.fill();
    g.restore();
  }

  drawDoorThreatHint(g, side) {
    const waiting = this.getThreatAtDoor(side);
    if (!waiting) return;
    const face = this.assets.threatFaces.get(waiting.def.id);
    if (!face) return;
    g.save();
    const x = side === "left" ? 120 : 960 - 120;
    const y = 250;
    const size = 150;
    g.globalAlpha = 0.92;
    g.translate(x, y);
    g.rotate(side === "left" ? -0.06 : 0.06);
    g.drawImage(face, -size / 2, -size / 2, size, size);
    g.restore();

    g.save();
    g.font = "700 14px ui-monospace, Menlo, Monaco, Consolas, 'Courier New', monospace";
    g.fillStyle = "rgba(255,255,255,0.92)";
    g.fillText("EJ IS HERE", side === "left" ? 58 : 960 - 150, 80);
    g.restore();
  }

  getThreatAtDoor(side) {
    if (side === "left") return this.threats.find((t) => t.atLeftDoor());
    return this.threats.find((t) => t.atRightDoor());
  }

  drawCamerasFeed(g) {
    const roomImg = this.assets.rooms[this.camRoom];
    if (roomImg) g.drawImage(roomImg, 0, 0, 960, 540);

    // Composite any threats that are currently in this room
    for (const th of this.threats) {
      if (!th.alive) continue;
      if (th.room === this.camRoom) {
        const face = this.assets.threatFaces.get(th.def.id);
        if (!face) continue;
        const wob = Math.sin(performance.now() / 170 + this.camRoom * 2.2) * 4;
        const x = 520 + wob;
        const y = 270 + Math.cos(performance.now() / 210) * 3;
        const size = 220;
        g.save();
        g.globalAlpha = 0.86;
        g.translate(x, y);
        g.rotate(0.03);
        g.drawImage(face, -size / 2, -size / 2, size, size);
        g.restore();
      }
    }

    // Camera overlays (scanlines + static + vignette)
    this.drawCameraOverlay(g);

    // Text HUD in feed
    g.save();
    g.font = "700 16px ui-monospace, Menlo, Monaco, Consolas, 'Courier New', monospace";
    g.fillStyle = "rgba(255,255,255,0.92)";
    g.fillText(`CAM ${this.camRoom + 1} • ${ROOM_NAMES[this.camRoom]}`, 18, 28);
    g.fillStyle = "rgba(168,255,106,0.75)";
    g.fillText(formatAmHour(this.hourIndex), 18, 52);
    g.restore();
  }

  drawCameraOverlay(g) {
    const w = 960, h = 540;

    // Flicker
    if (chance(CONFIG.CAMERA_FLICKER_CHANCE_PER_SEC / 60)) {
      this.camFlicker = rand(0.06, 0.20);
    }
    if (this.camFlicker > 0) this.camFlicker = Math.max(0, this.camFlicker - 1 / 60);

    // Scanlines
    g.save();
    g.globalAlpha = CONFIG.CAMERA_SCANLINE_INTENSITY + this.camFlicker * 0.3;
    g.fillStyle = "rgba(0,0,0,0.25)";
    for (let y = 0; y < h; y += 3) {
      g.fillRect(0, y, w, 1);
    }
    g.restore();

    // Static
    this.drawFilmGrain(g, CONFIG.CAMERA_STATIC_INTENSITY + this.camFlicker * 0.25);

    // Vignette
    g.save();
    const grad = g.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, 420);
    grad.addColorStop(0, "rgba(0,0,0,0.0)");
    grad.addColorStop(1, "rgba(0,0,0,0.58)");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.restore();
  }

  drawFilmGrain(g, alpha = 0.1) {
    // Cheap-ish grain: random tiny rectangles. Runs fine at 60fps for this canvas size.
    const w = 960, h = 540;
    g.save();
    g.globalAlpha = clamp(alpha, 0, 0.45);
    for (let i = 0; i < 520; i++) {
      const x = (Math.random() * w) | 0;
      const y = (Math.random() * h) | 0;
      const c = (Math.random() * 255) | 0;
      g.fillStyle = `rgb(${c},${c},${c})`;
      g.fillRect(x, y, 1, 1);
    }
    g.restore();
  }

  drawTitleCoverFace(g, img, x, y, size, { flip = false, tilt = 0 } = {}) {
    if (!img) return;
    g.save();
    // Glow behind face so it pops on the background.
    const glow = g.createRadialGradient(x, y, size * 0.1, x, y, size * 0.75);
    glow.addColorStop(0, "rgba(168,255,106,0.22)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = glow;
    g.beginPath();
    g.arc(x, y, size * 0.75, 0, Math.PI * 2);
    g.fill();

    g.globalAlpha = 1;
    g.translate(x, y);
    if (flip) g.scale(-1, 1);
    g.rotate(tilt);
    g.drawImage(img, -size / 2, -size / 2, size, size);
    g.restore();
  }

  drawScreenFallback(g, tone = "title") {
    const palettes = {
      title: ["#0a0e14", "#141c28"],
      win: ["#0a140f", "#102218"],
      gameover: ["#14080c", "#241018"],
    };
    const [c0, c1] = palettes[tone] || palettes.title;
    const grad = g.createLinearGradient(0, 0, 0, 540);
    grad.addColorStop(0, c0);
    grad.addColorStop(1, c1);
    g.fillStyle = grad;
    g.fillRect(0, 0, 960, 540);
  }

  drawTitleBackground(g) {
    if (this.assets.titleBg) {
      g.drawImage(this.assets.titleBg, 0, 0, 960, 540);
    } else {
      this.drawScreenFallback(g, "title");
    }

    g.save();
    // Subtle edge vignette so title text stays readable over custom art.
    const shade = g.createRadialGradient(480, 270, 180, 480, 270, 520);
    shade.addColorStop(0, "rgba(0,0,0,0.0)");
    shade.addColorStop(0.75, "rgba(0,0,0,0.12)");
    shade.addColorStop(1, "rgba(0,0,0,0.32)");
    g.fillStyle = shade;
    g.fillRect(0, 0, 960, 540);

    // EJ photos on the homepage.
    const [leftId, rightId] = TITLE_COVER_THREATS;
    this.drawTitleCoverFace(g, this.assets.threatFaces.get(leftId), 130, 255, 340, { tilt: -0.08 });
    this.drawTitleCoverFace(g, this.assets.threatFaces.get(rightId), 830, 255, 340, { flip: true, tilt: 0.08 });

    // Title text always drawn on top (custom title_bg may not include lettering).
    g.textAlign = "center";
    g.font = "900 52px ui-monospace, Menlo, Monaco, Consolas, 'Courier New', monospace";
    g.fillStyle = "rgba(0,0,0,0.55)";
    g.fillText(MESSAGES.titleLine1, 482, 177);
    g.fillText(MESSAGES.titleLine2, 482, 237);
    g.fillStyle = "rgba(255,255,255,0.96)";
    g.fillText(MESSAGES.titleLine1, 480, 175);
    g.fillStyle = "rgba(168,255,106,0.95)";
    g.fillText(MESSAGES.titleLine2, 480, 235);
    g.font = "600 17px ui-monospace, Menlo, Monaco, Consolas, 'Courier New', monospace";
    g.fillStyle = "rgba(210,227,234,0.88)";
    g.fillText(MESSAGES.titleHint, 480, 275);
    g.textAlign = "left";
    g.restore();
    this.drawFilmGrain(g, 0.08);
  }

  drawWinBackground(g) {
    if (this.assets.winScreen) g.drawImage(this.assets.winScreen, 0, 0, 960, 540);
    else this.drawScreenFallback(g, "win");
    this.drawFilmGrain(g, 0.09);
  }

  drawGameOverBackground(g) {
    if (this.assets.gameOverBg) g.drawImage(this.assets.gameOverBg, 0, 0, 960, 540);
    else this.drawScreenFallback(g, "gameover");
    this.drawFilmGrain(g, 0.12);
  }

  drawJumpscare(g) {
    // Pick the jumpscare image based on the threat that attacked (if known).
    const id = this.lastScareThreatId || this.attackCountdown?.threatId || this.threats.find((t) => t.inOffice())?.def.id || THREATS[0].id;
    const img = this.assets.jumpscares.get(id);
    if (img) g.drawImage(img, 0, 0, 960, 540);

    // Flash effect
    g.save();
    const t = (Math.sin(performance.now() / 38) + 1) / 2;
    g.fillStyle = `rgba(255,255,255,${0.18 + 0.25 * t})`;
    g.fillRect(0, 0, 960, 540);
    g.restore();
  }

  render() {
    const g = this.ctx;
    g.clearRect(0, 0, 960, 540);

    if (this.mode === "TITLE") {
      this.drawTitleBackground(g);
      return;
    }
    if (this.mode === "WIN") {
      this.drawWinBackground(g);
      return;
    }
    if (this.mode === "GAMEOVER") {
      this.drawGameOverBackground(g);
      return;
    }
    if (this.mode === "JUMPSCARE") {
      this.drawJumpscare(g);
      return;
    }

    // Default: office
    this.drawOffice(g);

    // If cameras are open, draw the camera feed to the panel canvas too
    if (this.mode === "CAM" && this.cameraFeedCtx) {
      const cg = this.cameraFeedCtx;
      cg.clearRect(0, 0, 960, 540);
      this.drawCamerasFeed(cg);
    }
  }

  tick(dt) {
    if (this.mode === "PLAY" || this.mode === "CAM") {
      this.updateClock();
      this.drainPower(dt);
      this.updateThreats();
      this.updateProximityMusic(dt);
      this.updateHud();
    } else {
      // Keep baseline volume on title screens, menus, and game-over overlays.
      this.sound.setProximityLevel(0, dt);
    }
    this.render();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// -------------------------
// Boot
// -------------------------

(async function main() {
  const canvas = document.getElementById("game");
  const overlayRoot = document.getElementById("overlayRoot");
  const btnCam = document.getElementById("btnCam");
  const btnMute = document.getElementById("btnMute");
  const btnHelp = document.getElementById("btnHelp");

  if (!canvas || !overlayRoot) return;
  const game = new Game(canvas, overlayRoot);

  // Wire footer buttons
  btnCam?.addEventListener("click", () => game.toggleCameras());
  btnMute?.addEventListener("click", async () => {
    game.sound.setEnabled(!game.sound.enabled);
    if (game.sound.enabled) await game.ensureBackgroundMusic();
    else game.setAudioHintVisible(false);
    if (btnMute) btnMute.textContent = `SOUND: ${game.sound.enabled ? "ON" : "OFF"}`;
  });
  btnHelp?.addEventListener("click", () => game.toggleHelp(true));
  document.getElementById("btnGetStarted")?.addEventListener("click", async () => {
    await game.sound.unlock();
    await game.ensureBackgroundMusic();
    game.showTitleMenu();
  });

  await game.loadAssets();
  game.showTitle();

  let last = performance.now();
  function frame() {
    const t = performance.now();
    const dt = clamp((t - last) / 1000, 0, 0.05);
    last = t;
    game.tick(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

