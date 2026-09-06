const $ = (id) => document.getElementById(id);

const state = {
  A: { recognition: null, text: '', translation: '' },
  B: { recognition: null, text: '', translation: '' }
};

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

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      state[person].text = text;
      heard.textContent = `“${text}”`;
      translated.textContent = translateDemo(text, source.value, target.value);
      state[person].translation = translated.textContent;
      play.disabled = false;
    };

    recognition.onerror = () => { status.textContent = 'Could not hear you'; };
    recognition.onend = () => {
      status.textContent = 'Ready';
      speak.classList.remove('listening');
      speak.querySelector('span').textContent = 'Speak';
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

function translateDemo(text, source, target) {
  // Temporary MVP translation. Replace this function with an API call later.
  if (source === target) return text;
  return `[${target.startsWith('te') ? 'Telugu' : 'English'} translation] ${text}`;
}

$('swapBtn').addEventListener('click', () => {
  const a = $('languageA').value;
  $('languageA').value = $('languageB').value;
  $('languageB').value = a;
});

setupSpeaker('A');
setupSpeaker('B');
