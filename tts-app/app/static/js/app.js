/**
 * EchoTTS Studio - Main UI Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const engineStatus = document.getElementById('engine-status');
  const engineStatusText = document.getElementById('engine-status-text');
  const voiceSelect = document.getElementById('voice-select');
  const voiceCountBadge = document.getElementById('voice-count-badge');

  const textInput = document.getElementById('text-input');
  const charCount = document.getElementById('char-count');
  const wordCount = document.getElementById('word-count');
  const btnClearText = document.getElementById('btn-clear-text');

  // Tabs
  const tabTextBtn = document.getElementById('tab-text-btn');
  const tabFileBtn = document.getElementById('tab-file-btn');
  const tabFileContent = document.getElementById('tab-file');

  // Drop zone
  const dropZone = document.getElementById('file-drop-zone');
  const fileInput = document.getElementById('file-input');
  const uploadSpinner = document.getElementById('upload-spinner');

  // Sliders
  const rateSlider = document.getElementById('rate-slider');
  const rateValue = document.getElementById('rate-value');
  const pitchSlider = document.getElementById('pitch-slider');
  const pitchValue = document.getElementById('pitch-value');
  const volumeSlider = document.getElementById('volume-slider');
  const volumeValue = document.getElementById('volume-value');
  const btnResetParams = document.getElementById('btn-reset-params');

  // Action
  const btnSynthesize = document.getElementById('btn-synthesize');
  const btnSpinner = document.getElementById('btn-spinner');
  const btnSynthesizeText = document.getElementById('btn-synthesize-text');

  // History
  const historyList = document.getElementById('history-list');
  const historyEmpty = document.getElementById('history-empty');
  const historyCount = document.getElementById('history-count');
  let sessionHistory = [];

  // Samples
  const sampleNews = document.getElementById('sample-news');
  const sampleStory = document.getElementById('sample-story');
  const sampleTech = document.getElementById('sample-tech');

  // Toast container
  const toastContainer = document.getElementById('toast-container');

  // --- 1. Notification Helper ---
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // --- 2. Load Voices ---
  async function loadVoices() {
    try {
      const res = await fetch('/api/voices');
      if (!res.ok) throw new Error('Không thể lấy danh sách giọng đọc');
      const voices = await res.json();

      voiceSelect.innerHTML = '';
      
      const viGroup = document.createElement('optgroup');
      viGroup.label = '🇻🇳 Giọng Đọc Tiếng Việt';
      const intlGroup = document.createElement('optgroup');
      intlGroup.label = '🌐 Giọng Đọc Quốc Tế (Tiếng Anh, v.v.)';

      voices.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = `${v.name} [${v.locale}]`;
        if (v.locale.startsWith('vi-VN')) {
          viGroup.appendChild(opt);
        } else if (['en-US', 'en-GB', 'ja-JP', 'fr-FR', 'ko-KR'].some(loc => v.locale.startsWith(loc))) {
          intlGroup.appendChild(opt);
        }
      });

      voiceSelect.appendChild(viGroup);
      if (intlGroup.children.length > 0) {
        voiceSelect.appendChild(intlGroup);
      }

      voiceSelect.value = 'vi-VN-HoaiMyNeural';
      voiceCountBadge.textContent = `${voices.length} giọng`;

      // Update status
      engineStatus.style.background = 'rgba(16, 185, 129, 0.12)';
      engineStatus.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      engineStatusText.textContent = 'Engine Sẵn Sàng';
    } catch (err) {
      console.error(err);
      engineStatusText.textContent = 'Ngoại tuyến';
      showToast('Không thể kết nối đến máy chủ voices: ' + err.message, 'error');
    }
  }

  // --- 3. Text & Stats Counting ---
  function updateCounters() {
    const text = textInput.value.trim();
    const chars = text.length;
    const words = text ? text.split(/\s+/).length : 0;

    charCount.textContent = chars.toLocaleString();
    wordCount.textContent = words.toLocaleString();
  }

  textInput.addEventListener('input', updateCounters);

  btnClearText.addEventListener('click', () => {
    textInput.value = '';
    updateCounters();
    textInput.focus();
  });

  // --- 4. Tabs & File Upload ---
  tabTextBtn.addEventListener('click', () => {
    tabTextBtn.classList.add('active');
    tabFileBtn.classList.remove('active');
    tabFileContent.style.display = 'none';
  });

  tabFileBtn.addEventListener('click', () => {
    tabFileBtn.classList.add('active');
    tabTextBtn.classList.remove('active');
    tabFileContent.style.display = 'block';
  });

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      handleFileUpload(fileInput.files[0]);
    }
  });

  async function handleFileUpload(file) {
    const formData = new FormData();
    formData.append('file', file);

    uploadSpinner.style.display = 'block';
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Lỗi khi trích xuất tài liệu');
      }

      const data = await res.json();
      textInput.value = data.text;
      updateCounters();

      // Switch back to text view
      tabTextBtn.click();
      showToast(`Đã trích xuất thành công ${data.word_count} từ từ file "${file.name}"!`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      uploadSpinner.style.display = 'none';
      fileInput.value = '';
    }
  }

  // --- 5. Sliders Controller ---
  function updateSliderDisplay() {
    // Rate: 0 -> 1.0x, 50 -> 1.5x, -50 -> 0.5x
    const r = parseInt(rateSlider.value, 10);
    const speedMult = ((100 + r) / 100).toFixed(2);
    rateValue.textContent = `${speedMult}x`;

    // Pitch: +0Hz, +10Hz, -15Hz
    const p = parseInt(pitchSlider.value, 10);
    pitchValue.textContent = `${p >= 0 ? '+' : ''}${p} Hz`;

    // Volume: 0 -> 100%, 20 -> 120%, -20 -> 80%
    const v = parseInt(volumeSlider.value, 10);
    volumeValue.textContent = `${100 + v}%`;
  }

  rateSlider.addEventListener('input', updateSliderDisplay);
  pitchSlider.addEventListener('input', updateSliderDisplay);
  volumeSlider.addEventListener('input', updateSliderDisplay);

  btnResetParams.addEventListener('click', () => {
    rateSlider.value = 0;
    pitchSlider.value = 0;
    volumeSlider.value = 0;
    updateSliderDisplay();
    showToast('Đã khôi phục các thông số về mặc định.');
  });

  // --- 6. Quick Samples ---
  sampleNews.addEventListener('click', () => {
    textInput.value = 'Chào mừng quý vị và các bạn đến với bản tin thời sự hôm nay. Trung tâm Dự báo Khí tượng Thủy văn Quốc gia cho biết, thời tiết tại các tỉnh thành phố trên cả nước đang chuyển biến vô cùng tích cực với nắng ấm và không khí trong lành.';
    updateCounters();
  });

  sampleStory.addEventListener('click', () => {
    textInput.value = 'Đêm mùa thu, gió se lạnh thổi qua từng kẽ lá. Dưới ánh trăng dịu dàng, những ký ức xưa cũ như ùa về, mang theo hơi thở ngọt ngào của những ngày tháng tuổi thơ bình yên nơi quê nhà.';
    updateCounters();
  });

  sampleTech.addEventListener('click', () => {
    textInput.value = 'Trí tuệ nhân tạo và học máy đang mở ra kỷ nguyên mới cho nền công nghệ thế giới. Việc ứng dụng mô hình ngôn ngữ lớn và tổng hợp giọng nói đa ngữ đã giúp thu hẹp khoảng cách giao tiếp giữa con người và máy móc.';
    updateCounters();
  });

  // --- 7. Synthesize Speech ---
  async function synthesizeSpeech() {
    const text = textInput.value.trim();
    if (!text) {
      showToast('Vui lòng nhập nội dung văn bản trước khi tạo giọng nói.', 'error');
      textInput.focus();
      return;
    }

    const voice = voiceSelect.value;
    const rVal = parseInt(rateSlider.value, 10);
    const pVal = parseInt(pitchSlider.value, 10);
    const vVal = parseInt(volumeSlider.value, 10);

    const rateStr = `${rVal >= 0 ? '+' : ''}${rVal}%`;
    const pitchStr = `${pVal >= 0 ? '+' : ''}${pVal}Hz`;
    const volumeStr = `${vVal >= 0 ? '+' : ''}${vVal}%`;

    // UI Loading state
    btnSynthesize.disabled = true;
    btnSpinner.style.display = 'inline-block';
    btnSynthesizeText.textContent = 'Đang Tổng Hợp...';

    try {
      const response = await fetch('/api/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          voice: voice,
          rate: rateStr,
          pitch: pitchStr,
          volume: volumeStr
        })
      });

      if (!response.ok) {
        let errMessage = 'Không thể tạo âm thanh';
        try {
          const errJson = await response.json();
          errMessage = errJson.detail || errMessage;
        } catch (_) {}
        throw new Error(errMessage);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Track title from text excerpt
      const excerpt = text.length > 40 ? text.substring(0, 40) + '...' : text;
      
      // Load into audio player
      if (window.echoPlayer) {
        window.echoPlayer.loadAudio(audioUrl, excerpt);
      }

      // Add to Session History
      addToHistory({
        url: audioUrl,
        title: excerpt,
        time: new Date().toLocaleTimeString(),
        voice: voiceSelect.options[voiceSelect.selectedIndex].text
      });

      showToast('Tạo giọng nói thành công!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Lỗi: ' + err.message, 'error');
    } finally {
      btnSynthesize.disabled = false;
      btnSpinner.style.display = 'none';
      btnSynthesizeText.textContent = 'Tạo Giọng Nói';
    }
  }

  btnSynthesize.addEventListener('click', synthesizeSpeech);

  // Keyboard shortcut Ctrl+Enter / Cmd+Enter
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      synthesizeSpeech();
    }
  });

  // --- 8. Session History ---
  function addToHistory(item) {
    sessionHistory.unshift(item);
    if (sessionHistory.length > 5) {
      sessionHistory.pop();
    }
    renderHistory();
  }

  function renderHistory() {
    if (sessionHistory.length === 0) {
      historyEmpty.style.display = 'block';
      historyCount.textContent = '0 bản ghi';
      return;
    }

    historyEmpty.style.display = 'none';
    historyCount.textContent = `${sessionHistory.length} bản ghi`;
    historyList.innerHTML = '';

    sessionHistory.forEach((track) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'history-item';
      itemEl.innerHTML = `
        <div class="history-item-left">
          <button class="history-play-btn" title="Nghe lại">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6 4 20 12 6 20 6 4"></polygon>
            </svg>
          </button>
          <div>
            <div class="history-text">${track.title}</div>
            <div class="history-meta">${track.voice} &bull; ${track.time}</div>
          </div>
        </div>
        <div class="history-item-right">
          <a class="btn-ghost" href="${track.url}" download="echotts_history.mp3" title="Tải về">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </a>
        </div>
      `;

      itemEl.querySelector('.history-play-btn').addEventListener('click', () => {
        if (window.echoPlayer) {
          window.echoPlayer.loadAudio(track.url, track.title);
        }
      });

      historyList.appendChild(itemEl);
    });
  }

  // --- Initial Call ---
  loadVoices();
  updateSliderDisplay();
  updateCounters();
});
