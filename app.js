const $ = (id) => document.getElementById(id);

const state = {
  A: { recognition: null, text: '', translation: '' },
  B: { recognition: null, text: '', translation: '' }
};

async function translateWithAI(text, source, target) {
  const sourceName = source.startsWith('te') ? 'Telugu' : 'English';
  const targetName = target.startsWith('te') ? 'Telugu' : 'English';
  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, source: sourceName, target: targetName })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Translation failed');
  return data.translation;
}

function setupSpeaker(person) {
  const source = $(`language${person}`);
  const target = $(`language${person === 'A' ? 'B' : 'A'}`);
  const speak = $(`speak${person}`);
  const heard = $(`heard${person}`);
  const translated = $(`translated${person}`);
  const play = $(`play${person}`);
  const status = $(`status${person}`);

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    status.textContent = 'Speech recognition unavailable';
    speak.disabled = true;
    return;
  }

  speak.addEventListener('click', () => {
    const recognition = new SpeechRecognition();
    state[person].recognition = recognition;
    recognition.lang = source.value;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    status.textContent = 'Listening…';
    speak.classList.add('listening');
    speak.querySelector('span').textContent = 'Listening…';
    recognition.start();

    recognition.onresult = async (event) => {
      const text = event.results[0][0].transcript;
      state[person].text = text;
      heard.textContent = `“${text}”`;
      translated.textContent = 'Translating with AI…';
      play.disabled = true;

      try {
        const translation = await translateWithAI(text, source.value, target.value);
        state[person].translation = translation;
        translated.textContent = translation;
        play.disabled = false;
        status.textContent = 'Translation ready';
      } catch (error) {
        translated.textContent = 'Translation unavailable. Check the server/API key.';
        status.textContent = 'Translation error';
        console.error(error);
      }
    };

    recognition.onerror = (event) => {
      status.textContent = `Microphone error: ${event.error}`;
    };

    recognition.onend = () => {
      speak.classList.remove('listening');
      speak.querySelector('span').textContent = 'Speak';
      if (status.textContent === 'Listening…') status.textContent = 'Ready';
    };
  });

  play.addEventListener('click', () => {
    if (!state[person].translation || !window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(state[person].translation);
    utterance.lang = target.value;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

$('swapBtn').addEventListener('click', () => {
  const a = $('languageA').value;
  $('languageA').value = $('languageB').value;
  $('languageB').value = a;
});

setupSpeaker('A');
setupSpeaker('B');
