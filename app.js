const LANGUAGES = [
  { code: 'en-US', api: 'en', name: 'English', native: 'English' },
  { code: 'te-IN', api: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'hi-IN', api: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'ta-IN', api: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'kn-IN', api: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml-IN', api: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'mr-IN', api: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'bn-IN', api: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'gu-IN', api: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'pa-IN', api: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' }
];

const $ = id => document.getElementById(id);
const state = {
  A: { recognition: null, text: '', translation: '' },
  B: { recognition: null, text: '', translation: '' },
  active: null,
  history: []
};

function language(code) { return LANGUAGES.find(l => l.code === code) || LANGUAGES[0]; }

function fillLanguages() {
  for (const person of ['A', 'B']) {
    const select = $(`language${person}`);
    select.innerHTML = LANGUAGES.map(l => `<option value="${l.code}">${l.name} — ${l.native}</option>`).join('');
  }
  $('languageA').value = 'en-US';
  $('languageB').value = 'te-IN';
}

function setStatus(person, text, type = 'ready') {
  const el = $(`status${person}`);
  el.textContent = text;
  el.className = `status ${type}`;
}

function setNotice(text, type = '') {
  $('notice').textContent = text;
  $('notice').className = `notice ${type}`;
}

function resetMicButton(person) {
  const button = $(`speak${person}`);
  button.classList.remove('listening');
  button.querySelector('.mic-label').textContent = person === 'A' ? 'Hold your turn' : 'Speak response';
  button.querySelector('small').textContent = person === 'A' ? 'Click to start speaking' : 'Translation is manual';
}

function speechSynthesisPlay(text, langCode, onDone) {
  if (!text || !('speechSynthesis' in window)) {
    setNotice('Text-to-speech is not supported by this browser.', 'error');
    onDone?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = langCode;
  utterance.rate = 0.95;
  utterance.onend = () => onDone?.();
  utterance.onerror = () => onDone?.();
  window.speechSynthesis.speak(utterance);
}

async function translate(text, source, target) {
  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, source: language(source).api, target: language(target).api })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Translation failed.');
  return data.translation;
}

function addHistory(person, text, translation, source, target) {
  state.history.push({ person, text, translation, source, target, time: new Date() });
  renderHistory();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[ch]));
}

function renderHistory() {
  const history = $('history');
  $('turnCount').textContent = `${state.history.length} ${state.history.length === 1 ? 'turn' : 'turns'}`;
  if (!state.history.length) {
    history.className = 'history empty';
    history.innerHTML = '<div class="empty-icon">💬</div><p>Your conversation will appear here.</p>';
    return;
  }
  history.className = 'history';
  history.innerHTML = state.history.map((item, index) => `
    <div class="history-item ${item.person === 'A' ? 'from-a' : 'from-b'}">
      <div class="history-meta"><strong>Person ${item.person}</strong><span>${item.time.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>
      <p class="original">${escapeHtml(item.text)}</p>
      ${item.translation ? `<div class="history-translation"><span>→ ${escapeHtml(language(item.target).name)}</span><p>${escapeHtml(item.translation)}</p><button class="history-play" data-index="${index}">🔊</button></div>` : '<div class="history-pending">Translation not requested yet</div>'}
    </div>`).join('');
  history.querySelectorAll('.history-play').forEach(btn => btn.addEventListener('click', () => {
    const item = state.history[Number(btn.dataset.index)];
    speechSynthesisPlay(item.translation, item.target);
  }));
}

function releaseTurn(person) {
  state[person].recognition = null;
  state.active = null;
  resetMicButton(person);
}

function setupSpeaker(person) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const speak = $(`speak${person}`);
  const source = $(`language${person}`);
  const target = $(`language${person === 'A' ? 'B' : 'A'}`);
  const heard = $(`heard${person}`);

  if (!SpeechRecognition) {
    speak.disabled = true;
    setStatus(person, 'Unsupported', 'error');
    return;
  }

  speak.addEventListener('click', () => {
    if (state.active && state.active !== person) {
      setNotice(`Person ${state.active} is currently using the microphone.`, 'warning');
      return;
    }
    if (state[person].recognition) return;

    const recognition = new SpeechRecognition();
    state[person].recognition = recognition;
    state.active = person;
    recognition.lang = source.value;
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    speak.classList.add('listening');
    speak.querySelector('.mic-label').textContent = 'Listening…';
    speak.querySelector('small').textContent = 'Speak clearly, then pause';
    setStatus(person, 'Listening…', 'live');
    setNotice(`Person ${person} is listening.`, 'live');

    try { recognition.start(); }
    catch (error) { console.error(error); releaseTurn(person); setStatus(person, 'Ready'); }

    recognition.onresult = async event => {
      const text = event.results?.[0]?.[0]?.transcript?.trim();
      if (!text) return;
      state[person].text = text;
      heard.textContent = `“${text}”`;

      if (person === 'B') {
        state.B.translation = '';
        $('translatedB').textContent = 'Tap “Translate” when you are ready.';
        $('translateB').disabled = false;
        $('playB').disabled = true;
        addHistory('B', text, '', source.value, target.value);
        setStatus('B', 'Response recorded', 'success');
        setNotice('Person B has responded. Translate only when Person B chooses to.', '');
        releaseTurn('B');
        return;
      }

      $('translatedA').textContent = 'Translating…';
      $('playA').disabled = true;
      setStatus('A', 'Translating…', 'live');

      try {
        const result = await translate(text, source.value, target.value);
        state.A.translation = result;
        $('translatedA').textContent = result;
        $('playA').disabled = false;
        addHistory('A', text, result, source.value, target.value);
        setStatus('A', 'Playing translation', 'success');
        setNotice('Person A is done. Person B can respond now.');
        speechSynthesisPlay(result, target.value, () => setStatus('A', 'Turn complete', 'success'));
      } catch (error) {
        $('translatedA').textContent = 'Translation unavailable.';
        setStatus('A', 'Translation error', 'error');
        setNotice(error.message, 'error');
      } finally { releaseTurn('A'); }
    };

    recognition.onerror = event => {
      const message = event.error === 'not-allowed' ? 'Microphone permission was denied.' : `Microphone error: ${event.error}`;
      setStatus(person, 'Microphone error', 'error');
      setNotice(message, 'error');
      releaseTurn(person);
    };
    recognition.onend = () => {
      state[person].recognition = null;
      resetMicButton(person);
      if (state.active === person) state.active = null;
    };
  });
}

$('translateB').addEventListener('click', async () => {
  if (!state.B.text) return;
  const source = $('languageB').value;
  const target = $('languageA').value;
  $('translateB').disabled = true;
  $('playB').disabled = true;
  $('translatedB').textContent = 'Translating…';
  setStatus('B', 'Translating…', 'live');
  try {
    const result = await translate(state.B.text, source, target);
    state.B.translation = result;
    $('translatedB').textContent = result;
    $('playB').disabled = false;
    const item = state.history[state.history.length - 1];
    if (item && item.person === 'B' && item.text === state.B.text) item.translation = result;
    renderHistory();
    setStatus('B', 'Translation ready', 'success');
    setNotice('Translation is ready for Person A.');
  } catch (error) {
    $('translatedB').textContent = 'Translation unavailable.';
    setStatus('B', 'Translation error', 'error');
    setNotice(error.message, 'error');
  } finally { $('translateB').disabled = false; }
});

$('playA').addEventListener('click', () => speechSynthesisPlay(state.A.translation, $('languageB').value));
$('playB').addEventListener('click', () => speechSynthesisPlay(state.B.translation, $('languageA').value));

$('swapBtn').addEventListener('click', () => {
  const a = $('languageA').value;
  $('languageA').value = $('languageB').value;
  $('languageB').value = a;
  setNotice('Languages swapped.');
});

$('clearBtn').addEventListener('click', () => {
  window.speechSynthesis?.cancel();
  state.history = [];
  state.A.text = state.A.translation = '';
  state.B.text = state.B.translation = '';
  $('heardA').textContent = 'Your speech will appear here.';
  $('heardB').textContent = 'Your response will appear here.';
  $('translatedA').textContent = '—';
  $('translatedB').textContent = '—';
  $('playA').disabled = true;
  $('playB').disabled = true;
  $('translateB').disabled = true;
  renderHistory();
  setStatus('A', 'Ready'); setStatus('B', 'Ready');
  setNotice('Conversation cleared. Start a new turn with Person A.');
});

$('languageA').addEventListener('change', () => setNotice(`Person A speaks ${language($('languageA').value).name}.`));
$('languageB').addEventListener('change', () => setNotice(`Person B speaks ${language($('languageB').value).name}.`));

fillLanguages();
setupSpeaker('A');
setupSpeaker('B');
renderHistory();
