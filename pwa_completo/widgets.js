/* ==========================================================================
   ESTUDIACCIÓN (KILONOTION) - WIDGETS INTEGRADOS EN SIDEBAR (POMODORO & AUDIO)
   ========================================================================== */

class CozyWidgets {
  constructor() {
    this.initPomodoro();
    this.initAudioMixer();
  }

  /* --- POMODORO TIMER SYSTEM --- */
  initPomodoro() {
    this.pomoDuration = 25 * 60; // 25 min default
    this.pomoTimeRemaining = this.pomoDuration;
    this.pomoInterval = null;
    this.pomoIsRunning = false;
    this.pomoMode = 'work'; // 'work' or 'break'

    // DOM Elements
    this.pomoRing = document.getElementById('pomo-progress-ring');
    this.pomoDisplay = document.getElementById('pomo-time-display');
    this.pomoLabel = document.getElementById('pomo-mode-label');

    this.btnToggle = document.getElementById('btn-pomo-toggle');
    this.btnReset = document.getElementById('btn-pomo-reset');
    this.btnBreak = document.getElementById('btn-pomo-short-break');

    if (!this.pomoRing) return;

    // Events
    const toggleHandler = () => this.togglePomodoro();
    const resetHandler = () => this.resetPomodoro();

    this.btnToggle.addEventListener('click', toggleHandler);
    this.btnReset.addEventListener('click', resetHandler);

    this.btnBreak.addEventListener('click', () => {
      this.setPomodoroMode(this.pomoMode === 'work' ? 'break' : 'work');
    });

    this.updatePomodoroUI();
  }

  togglePomodoro() {
    if (this.pomoIsRunning) {
      clearInterval(this.pomoInterval);
      this.pomoIsRunning = false;
      this.btnToggle.innerHTML = '<i class="fa-solid fa-play"></i>';
    } else {
      this.pomoIsRunning = true;
      this.btnToggle.innerHTML = '<i class="fa-solid fa-pause"></i>';
      this.pomoInterval = setInterval(() => {
        this.pomoTimeRemaining--;
        if (this.pomoTimeRemaining <= 0) {
          this.playBellSound();
          // Switch modes
          this.setPomodoroMode(this.pomoMode === 'work' ? 'break' : 'work');
          this.togglePomodoro(); // Pause and notify
        }
        this.updatePomodoroUI();
      }, 1000);
    }
  }

  resetPomodoro() {
    clearInterval(this.pomoInterval);
    this.pomoIsRunning = false;
    this.pomoTimeRemaining = this.pomoDuration;
    this.btnToggle.innerHTML = '<i class="fa-solid fa-play"></i>';
    this.updatePomodoroUI();
  }

  setPomodoroMode(mode) {
    this.pomoMode = mode;
    if (mode === 'work') {
      this.pomoDuration = 25 * 60;
      this.pomoLabel.innerText = '¡Hora de Concentrarse! 🧠';
      this.btnBreak.innerText = 'Descanso';
    } else {
      this.pomoDuration = 5 * 60;
      this.pomoLabel.innerText = 'Tiempo de Estirarse ☕';
      this.btnBreak.innerText = 'Estudiar';
    }
    this.resetPomodoro();
  }

  updatePomodoroUI() {
    const mins = Math.floor(this.pomoTimeRemaining / 60);
    const secs = this.pomoTimeRemaining % 60;
    const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    this.pomoDisplay.innerText = formatted;

    // Circle progress ring
    const totalRingLength = 283; // 2 * PI * r (r=45)
    const progress = this.pomoTimeRemaining / this.pomoDuration;
    const offset = totalRingLength * (1 - progress);
    this.pomoRing.style.strokeDashoffset = offset;
  }

  playBellSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      const playChime = (freq, startTime, duration) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        
        gainNode.gain.setValueAtTime(0.3, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = audioCtx.currentTime;
      playChime(523.25, now, 2.0); // C5
      playChime(659.25, now + 0.2, 1.8); // E5
      playChime(783.99, now + 0.4, 2.2); // G5
      playChime(1046.50, now + 0.6, 2.5); // C6
    } catch(e) {
      console.warn("Could not play bell sound due to AudioContext restrictions", e);
    }
  }

  /* --- WEB AUDIO COZY MUSIC & SOUND SYNTHESIZER --- */
  initAudioMixer() {
    this.audioCtx = null;
    this.lofiIsPlaying = false;
    this.lofiInterval = null;
    this.binauralSources = [];

    // Synthesis nodes
    this.rainNode = null;
    this.fireNode = null;
    this.cafeNode = null;
    this.windNode = null;
    this.brownNode = null;

    // DOM sliders & status
    this.sliders = {
      rain: document.getElementById('vol-rain'),
      cafe: document.getElementById('vol-cafe'),
      fire: document.getElementById('vol-fire'),
      wind: document.getElementById('vol-wind'),
      brown: document.getElementById('vol-brown'),
    };

    this.btnLofiToggle = document.getElementById('btn-global-lofi-toggle');
    this.sidebarLofiStatus = document.getElementById('lofi-status');
    this.lofiDisc = document.getElementById('lofi-disc');

    // Station selection dropdown
    this.audioStationSelect = document.getElementById('audio-station-select');
    if (this.audioStationSelect) {
      this.audioStationSelect.addEventListener('change', (e) => {
        this.currentStation = e.target.value;
        if (this.lofiIsPlaying) {
          // Restart stream to apply changes immediately
          this.toggleLofiMusic();
          this.toggleLofiMusic();
        }
      });
    }
    this.currentStation = this.audioStationSelect ? this.audioStationSelect.value : 'lofi';

    // Quick sliders events
    Object.keys(this.sliders).forEach(sound => {
      if (this.sliders[sound]) {
        this.sliders[sound].addEventListener('input', (e) => {
          this.ensureAudioContext();
          this.updateAmbientSoundVolume(sound, e.target.value / 100);
        });
      }
    });

    this.btnLofiToggle.addEventListener('click', () => this.toggleLofiMusic());
  }

  ensureAudioContext() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.setupSynthesizers();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  setupSynthesizers() {
    const ctx = this.audioCtx;

    // Helper: Create continuous white/pink noise buffer
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5;
    }

    const createNoiseSource = (volNode) => {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      source.loop = true;
      source.connect(volNode);
      source.start();
      return source;
    };

    // 1. RAIN SYNTH
    this.rainVolume = ctx.createGain();
    this.rainVolume.gain.value = 0;
    
    this.rainFilter = ctx.createBiquadFilter();
    this.rainFilter.type = 'lowpass';
    this.rainFilter.frequency.value = 800;
    
    this.rainVolume.connect(this.rainFilter);
    this.rainFilter.connect(ctx.destination);
    createNoiseSource(this.rainVolume);

    // 2. CAFE SYNTH
    this.cafeVolume = ctx.createGain();
    this.cafeVolume.gain.value = 0;

    this.cafeFilter = ctx.createBiquadFilter();
    this.cafeFilter.type = 'bandpass';
    this.cafeFilter.frequency.value = 250;
    this.cafeFilter.Q.value = 0.8;

    this.cafeVolume.connect(this.cafeFilter);
    this.cafeFilter.connect(ctx.destination);
    createNoiseSource(this.cafeVolume);

    // Randomized clinks in cafe
    setInterval(() => {
      if (this.cafeVolume.gain.value > 0.01) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(1500 + Math.random() * 800, ctx.currentTime);
        gain.gain.setValueAtTime(0.01 * this.cafeVolume.gain.value, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    }, 4000);

    // 3. FIRE SYNTH
    this.fireVolume = ctx.createGain();
    this.fireVolume.gain.value = 0;

    this.fireFilter = ctx.createBiquadFilter();
    this.fireFilter.type = 'lowpass';
    this.fireFilter.frequency.value = 400;

    this.fireVolume.connect(this.fireFilter);
    this.fireFilter.connect(ctx.destination);
    createNoiseSource(this.fireVolume);

    // Random spark crackles
    setInterval(() => {
      if (this.fireVolume.gain.value > 0.01) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(100 + Math.random() * 200, ctx.currentTime);
        gain.gain.setValueAtTime(0.04 * this.fireVolume.gain.value, ctx.currentTime);
        gain.gain.setValueAtTime(0.1 * this.fireVolume.gain.value, ctx.currentTime + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.015);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.02);
      }
    }, 450);

    // 4. WIND SYNTH (Cozy sweeping breeze)
    this.windVolume = ctx.createGain();
    this.windVolume.gain.value = 0;

    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 350;

    this.windVolume.connect(this.windFilter);
    this.windFilter.connect(ctx.destination);
    createNoiseSource(this.windVolume);

    // Dynamic wind sweep interval
    setInterval(() => {
      if (this.windVolume.gain.value > 0.01) {
        const now = ctx.currentTime;
        const targetFreq = 160 + Math.random() * 320;
        this.windFilter.frequency.exponentialRampToValueAtTime(targetFreq, now + 3.0);
      }
    }, 3000);

    // 5. DEEP BROWN NOISE SYNTH
    const brownBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const brownData = brownBuffer.getChannelData(0);
    let accumulator = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      accumulator = (accumulator + (0.02 * white)) / 1.002;
      brownData[i] = accumulator * 3.0;
    }

    const createBrownNoiseSource = (volNode) => {
      const source = ctx.createBufferSource();
      source.buffer = brownBuffer;
      source.loop = true;
      source.connect(volNode);
      source.start();
      return source;
    };

    this.brownVolume = ctx.createGain();
    this.brownVolume.gain.value = 0;

    this.brownFilter = ctx.createBiquadFilter();
    this.brownFilter.type = 'lowpass';
    this.brownFilter.frequency.value = 200; // Deep water-like roar

    this.brownVolume.connect(this.brownFilter);
    this.brownFilter.connect(ctx.destination);
    createBrownNoiseSource(this.brownVolume);
  }

  updateAmbientSoundVolume(sound, value) {
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    if (sound === 'rain' && this.rainVolume) {
      this.rainVolume.gain.setTargetAtTime(value * 0.4, now, 0.2);
    } else if (sound === 'cafe' && this.cafeVolume) {
      this.cafeVolume.gain.setTargetAtTime(value * 0.3, now, 0.2);
    } else if (sound === 'fire' && this.fireVolume) {
      this.fireVolume.gain.setTargetAtTime(value * 0.35, now, 0.2);
    } else if (sound === 'wind' && this.windVolume) {
      this.windVolume.gain.setTargetAtTime(value * 0.45, now, 0.2);
    } else if (sound === 'brown' && this.brownVolume) {
      this.brownVolume.gain.setTargetAtTime(value * 0.5, now, 0.2);
    }
  }

  /* --- PROCEDURAL COZY STATIONS GENERATOR --- */
  toggleLofiMusic() {
    this.ensureAudioContext();

    if (this.lofiIsPlaying) {
      this.lofiIsPlaying = false;
      if (this.lofiInterval) {
        clearInterval(this.lofiInterval);
        this.lofiInterval = null;
      }
      if (this.binauralSources) {
        this.binauralSources.forEach(src => { try { src.stop(); } catch(e){} });
        this.binauralSources = [];
      }
      this.btnLofiToggle.innerHTML = '<i class="fa-solid fa-play"></i>';
      this.sidebarLofiStatus.innerText = 'Pausado';
      this.lofiDisc.classList.remove('playing');
    } else {
      this.lofiIsPlaying = true;
      this.btnLofiToggle.innerHTML = '<i class="fa-solid fa-pause"></i>';
      this.lofiDisc.classList.add('playing');

      const trackLabel = document.getElementById('lofi-now-playing');
      const stationTitle = document.querySelector('.lofi-track-info h4');

      if (this.currentStation === 'binaural') {
        stationTitle.innerText = 'Ondas Binaurales';
        trackLabel.innerText = 'Foco Alpha (10 Hz) 🧠';
        this.sidebarLofiStatus.innerText = 'Sonando 🧠';
        this.playBinauralBeats();
      } else if (this.currentStation === 'piano') {
        stationTitle.innerText = 'Piano de Enfoque';
        trackLabel.innerText = 'Melodías Zen Relajantes 🎹';
        this.sidebarLofiStatus.innerText = 'Sonando 🎹';
        this.playZenPiano();
      } else {
        stationTitle.innerText = 'Estación Lo-Fi';
        trackLabel.innerText = 'Música ambiental 📻';
        this.sidebarLofiStatus.innerText = 'Sonando 📻';
        this.playProceduralLofi();
      }
    }
  }

  playBinauralBeats() {
    this.binauralSources = [];
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Helper to create stereo panner node with solid fallback for Safari / iOS
    const createStereoPanner = (panValue) => {
      try {
        if (ctx.createStereoPanner) {
          const panner = ctx.createStereoPanner();
          panner.pan.value = panValue;
          return panner;
        }
      } catch (e) {
        console.warn("createStereoPanner not supported, using fallback", e);
      }
      
      try {
        // Standard PannerNode fallback (fully supported on iOS Safari)
        const panner = ctx.createPanner();
        panner.panningModel = 'equalpower';
        if (panner.positionX) {
          panner.positionX.value = panValue;
          panner.positionY.value = 0;
          panner.positionZ.value = 0;
        } else {
          panner.setPosition(panValue, 0, 0);
        }
        return panner;
      } catch (e) {
        console.error("Failed to create any panner node", e);
        return null;
      }
    };

    // Left Channel: 300 Hz
    const oscL = ctx.createOscillator();
    const gainL = ctx.createGain();
    
    oscL.type = 'sine';
    oscL.frequency.setValueAtTime(300, now);
    gainL.gain.setValueAtTime(0.22, now); // Elevated from 0.08 to be clearly audible on standard speakers

    // Right Channel: 310 Hz (Creates a 10 Hz difference for Alpha wave focus)
    const oscR = ctx.createOscillator();
    const gainR = ctx.createGain();
    
    oscR.type = 'sine';
    oscR.frequency.setValueAtTime(310, now);
    gainR.gain.setValueAtTime(0.22, now);

    const pannerL = createStereoPanner(-1.0);
    const pannerR = createStereoPanner(1.0);

    if (pannerL) {
      oscL.connect(gainL);
      gainL.connect(pannerL);
      pannerL.connect(ctx.destination);
    } else {
      oscL.connect(gainL);
      gainL.connect(ctx.destination);
    }

    if (pannerR) {
      oscR.connect(gainR);
      gainR.connect(pannerR);
      pannerR.connect(ctx.destination);
    } else {
      oscR.connect(gainR);
      gainR.connect(ctx.destination);
    }

    oscL.start(now);
    oscR.start(now);

    this.binauralSources.push(oscL, oscR);
  }

  playZenPiano() {
    let beatCounter = 0;
    const beatTime = 0.6; // slower, calmer tempo
    
    const progressions = [
      [ [196.00, 246.94, 293.66, 392.00], [220.00, 261.63, 329.63, 392.00], [174.61, 220.00, 261.63, 349.23], [196.00, 246.94, 293.66, 392.00] ], // Gmaj7 - Am7 - Fmaj7 - Gmaj7
      [ [261.63, 329.63, 392.00, 493.88], [220.00, 261.63, 329.63, 392.00], [293.66, 349.23, 440.00, 523.25], [196.00, 246.94, 293.66, 392.00] ]  // Cmaj7 - Am7 - Dm7 - Gmaj7
    ];
    
    let progressionIdx = 0;
    let chordIdx = 0;

    const scheduleNextZenBeat = () => {
      if (!this.lofiIsPlaying) return;
      const now = this.audioCtx.currentTime;
      
      if (beatCounter % 8 === 0) {
        const currentChord = progressions[progressionIdx][chordIdx];
        
        currentChord.forEach((freq, idx) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          
          osc.type = 'sine'; // Pure beautiful sine tones for piano
          osc.frequency.setValueAtTime(freq, now);
          osc.frequency.setValueAtTime(freq + (Math.random() * 0.5 - 0.25), now + 0.2);

          const chordVolume = 0.05;
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(chordVolume, now + 0.4); // slow attack
          gain.gain.exponentialRampToValueAtTime(0.0001, now + (beatTime * 7.5)); // long decay
          
          const filter = this.audioCtx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 500; 

          osc.connect(gain);
          gain.connect(filter);
          filter.connect(this.audioCtx.destination);
          
          osc.start(now);
          osc.stop(now + (beatTime * 8));
        });

        chordIdx = (chordIdx + 1) % 4;
        if (chordIdx === 0) {
          progressionIdx = (progressionIdx + 1) % progressions.length;
        }
      }

      // Add high-pitched chime accent every 12 beats randomly
      if (beatCounter % 12 === 4 && Math.random() > 0.4) {
        const chimeFreqs = [783.99, 880.00, 987.77, 1046.50, 1174.66]; // High G5, A5, B5, C6, D6
        const freq = chimeFreqs[Math.floor(Math.random() * chimeFreqs.length)];
        
        const chimeOsc = this.audioCtx.createOscillator();
        const chimeGain = this.audioCtx.createGain();
        
        chimeOsc.type = 'sine';
        chimeOsc.frequency.setValueAtTime(freq, now);
        chimeGain.gain.setValueAtTime(0, now);
        chimeGain.gain.linearRampToValueAtTime(0.02, now + 0.1);
        chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);
        
        chimeOsc.connect(chimeGain);
        chimeGain.connect(this.audioCtx.destination);
        chimeOsc.start(now);
        chimeOsc.stop(now + 2.1);
      }

      beatCounter++;
    };

    scheduleNextZenBeat();
    this.lofiInterval = setInterval(scheduleNextZenBeat, beatTime * 1000);
  }

  playProceduralLofi() {
    let beatCounter = 0;
    const beatTime = 0.395; 

    const progressions = [
      [ [220, 261.63, 329.63, 392.00], [146.83, 349.23, 440.00, 523.25], [196.00, 246.94, 293.66, 349.23], [130.81, 329.63, 392.00, 493.88] ], 
      [ [130.81, 329.63, 392.00, 493.88], [174.61, 349.23, 440.00, 523.25], [146.83, 349.23, 440.00, 523.25], [196.00, 246.94, 293.66, 349.23] ]  
    ];
    
    let progressionIdx = 0;
    let chordIdx = 0;

    const scheduleNextBeat = () => {
      if (!this.lofiIsPlaying) return;
      const now = this.audioCtx.currentTime;
      
      if (beatCounter % 8 === 0) {
        const currentChord = progressions[progressionIdx][chordIdx];
        
        currentChord.forEach((freq, idx) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          
          osc.type = idx === 0 ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(freq, now);
          osc.frequency.setValueAtTime(freq + (Math.random() * 2 - 1), now + 0.1);

          const chordVolume = 0.04;
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(chordVolume, now + 0.15);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + (beatTime * 7.5));
          
          const filter = this.audioCtx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 650; 

          osc.connect(gain);
          gain.connect(filter);
          filter.connect(this.audioCtx.destination);
          
          osc.start(now);
          osc.stop(now + (beatTime * 8));
        });

        chordIdx = (chordIdx + 1) % 4;
        if (chordIdx === 0) {
          progressionIdx = (progressionIdx + 1) % progressions.length;
        }
      }

      if (beatCounter % 8 === 0 || beatCounter % 8 === 3) {
        this.playLofiKick(now);
      }
      
      if (beatCounter % 8 === 4) {
        this.playLofiSnare(now);
      }

      if (beatCounter % 2 === 1 && Math.random() > 0.3) {
        this.playLofiHat(now);
      }

      beatCounter++;
    };

    scheduleNextBeat();
    this.lofiInterval = setInterval(scheduleNextBeat, beatTime * 1000);
  }

  playLofiKick(time) {
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
    
    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);
    
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 120;

    osc.connect(gain);
    gain.connect(filter);
    filter.connect(this.audioCtx.destination);
    
    osc.start(time);
    osc.stop(time + 0.16);
  }

  playLofiSnare(time) {
    const bufferSize = this.audioCtx.sampleRate * 0.12;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;
    
    const noiseGain = this.audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.05, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 2.0;

    noise.connect(noiseGain);
    noiseGain.connect(filter);
    filter.connect(this.audioCtx.destination);
    
    noise.start(time);
  }

  playLofiHat(time) {
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.value = 8000;
    
    gain.gain.setValueAtTime(0.006, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
    
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    
    osc.start(time);
    osc.stop(time + 0.05);
  }
}

// Instantiate widgets globally
window.addEventListener('DOMContentLoaded', () => {
  window.cozyWidgets = new CozyWidgets();
});
