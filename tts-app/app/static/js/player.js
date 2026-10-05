/**
 * EchoTTS Studio - Custom Audio Player & Waveform Visualizer
 */

class EchoPlayer {
  constructor() {
    this.audio = document.getElementById('audio-element');
    this.section = document.getElementById('player-section');
    this.playBtn = document.getElementById('player-play-btn');
    this.playIcon = document.getElementById('play-icon');
    this.pauseIcon = document.getElementById('pause-icon');
    this.trackTitle = document.getElementById('player-track-title');
    this.currentTimeEl = document.getElementById('current-time');
    this.totalDurationEl = document.getElementById('total-duration');
    this.progressWrapper = document.getElementById('progress-wrapper');
    this.progressFill = document.getElementById('progress-fill');
    this.downloadBtn = document.getElementById('btn-download-audio');
    this.volumeSlider = document.getElementById('player-volume-slider');
    this.muteBtn = document.getElementById('mute-btn');
    this.canvas = document.getElementById('waveform-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    this.isPlaying = false;
    this.isMuted = false;
    this.previousVolume = 1;
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.animationId = null;

    this.initEvents();
    this.initCanvas();
  }

  initEvents() {
    if (!this.audio) return;

    this.playBtn.addEventListener('click', () => this.togglePlay());

    this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
    this.audio.addEventListener('loadedmetadata', () => this.onMetadataLoaded());
    this.audio.addEventListener('ended', () => this.onEnded());

    // Seeking
    if (this.progressWrapper) {
      this.progressWrapper.addEventListener('click', (e) => this.seek(e));
    }

    // Volume
    if (this.volumeSlider) {
      this.volumeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.setVolume(val);
      });
    }

    if (this.muteBtn) {
      this.muteBtn.addEventListener('click', () => this.toggleMute());
    }
  }

  initCanvas() {
    if (!this.canvas) return;
    this.canvas.width = this.canvas.clientWidth || 600;
    this.canvas.height = 32;
    this.drawIdleWaveform();
  }

  setupWebAudio() {
    if (this.audioContext) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.audioContext = new AudioCtx();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      this.source = this.audioContext.createMediaElementSource(this.audio);
      this.source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    } catch (e) {
      console.warn('Web Audio API not allowed or already configured:', e);
    }
  }

  loadAudio(audioUrl, title = 'Bản thu âm mới') {
    this.audio.src = audioUrl;
    this.trackTitle.textContent = title;
    this.downloadBtn.href = audioUrl;
    this.downloadBtn.download = `echotts_${Date.now()}.mp3`;

    this.section.style.display = 'block';
    this.progressFill.style.width = '0%';
    this.currentTimeEl.textContent = '00:00';
    this.totalDurationEl.textContent = '00:00';

    // Auto-play
    this.play();
  }

  play() {
    this.setupWebAudio();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    this.audio.play()
      .then(() => {
        this.isPlaying = true;
        this.playIcon.style.display = 'none';
        this.pauseIcon.style.display = 'block';
        this.startWaveformAnimation();
      })
      .catch((err) => {
        console.warn('Playback prevented or interrupted:', err);
      });
  }

  pause() {
    this.audio.pause();
    this.isPlaying = false;
    this.playIcon.style.display = 'block';
    this.pauseIcon.style.display = 'none';
    this.stopWaveformAnimation();
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  onTimeUpdate() {
    if (!this.audio.duration) return;
    const progress = (this.audio.currentTime / this.audio.duration) * 100;
    this.progressFill.style.width = `${progress}%`;
    this.currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
  }

  onMetadataLoaded() {
    if (this.audio.duration && !isNaN(this.audio.duration)) {
      this.totalDurationEl.textContent = this.formatTime(this.audio.duration);
    }
  }

  onEnded() {
    this.pause();
    this.progressFill.style.width = '100%';
    this.drawIdleWaveform();
  }

  seek(event) {
    if (!this.audio.duration) return;
    const rect = this.progressWrapper.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, clickX / width));
    this.audio.currentTime = percentage * this.audio.duration;
  }

  setVolume(val) {
    this.audio.volume = val;
    this.volumeSlider.value = val;
    this.isMuted = val === 0;
  }

  toggleMute() {
    if (this.isMuted) {
      this.setVolume(this.previousVolume || 1);
    } else {
      this.previousVolume = this.audio.volume;
      this.setVolume(0);
    }
  }

  formatTime(seconds) {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  drawIdleWaveform() {
    if (!this.ctx || !this.canvas) return;
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.ctx.clearRect(0, 0, width, height);

    const barCount = 40;
    const barWidth = width / barCount - 2;

    this.ctx.fillStyle = 'rgba(99, 102, 241, 0.25)';
    for (let i = 0; i < barCount; i++) {
      const h = 4 + Math.sin(i * 0.3) * 6;
      this.ctx.fillRect(i * (barWidth + 2), (height - h) / 2, barWidth, h);
    }
  }

  startWaveformAnimation() {
    if (this.animationId) cancelAnimationFrame(this.animationId);

    const render = () => {
      if (!this.isPlaying) return;
      this.animationId = requestAnimationFrame(render);

      if (!this.ctx || !this.canvas) return;
      const width = this.canvas.width;
      const height = this.canvas.height;
      this.ctx.clearRect(0, 0, width, height);

      let dataArray = null;
      if (this.analyser) {
        const bufferLength = this.analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);
      }

      const barCount = 42;
      const barWidth = width / barCount - 2;

      for (let i = 0; i < barCount; i++) {
        let barHeight = 6;
        if (dataArray && dataArray.length > 0) {
          const val = dataArray[i % dataArray.length];
          barHeight = Math.max(4, (val / 255) * height);
        } else {
          // Synthetic wave animation if WebAudio analyser is not permitted
          barHeight = 6 + Math.abs(Math.sin(Date.now() * 0.005 + i * 0.4)) * (height - 8);
        }

        const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#06B6D4');
        gradient.addColorStop(1, '#8B5CF6');

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(i * (barWidth + 2), (height - barHeight) / 2, barWidth, barHeight);
      }
    };

    render();
  }

  stopWaveformAnimation() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.drawIdleWaveform();
  }
}

// Global instance
window.echoPlayer = new EchoPlayer();
