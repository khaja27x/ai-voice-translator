const $ = (id) => document.getElementById(id);

const state = {
  A: { recognition: null, text: '', translation: '' },
  B: { recognition: null, text: '', translation: '' }
};

let activePerson = null;

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

function speakTranslation(text, language, onDone) {
  if (!text || !window.speechSynthesis) {
    if (onDone) onDone();
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language;
  utterance.onend = () => onDone && onDone();
  utterance.onerror = () => onDone && onDone();
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
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
    if (activePerson && activePerson !== person) {
      status.textContent = `Wait for Person ${activePerson}`;
      return;
    }
    if (state[person].recognition) return;

    activePerson = person;
    const recognition = new SpeechRecognition();
    state[person].recognition = recognition;
    recognition.lang = source.value;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    status.textContent = 'Listening…';
    speak.classList.add('listening');
    speak.querySelector('span').textContent = 'Listening…';

    try {
      recognition.start();
    } catch (error) {
      state[person].recognition = null;
      activePerson = null;
      console.error(error);
    }

    recognition.onresult = async (event) => {
      const text = event.results[0][0].transcript.trim();
      if (!text) return;

      state[person].text = text;
      heard.textContent = `“${text}”`;

      // PERSON B: only listen and display what B said.
      // Do NOT translate B automatically.
      if (person === 'B') {
        translated.textContent = 'No automatic translation';
        play.disabled = true;
        status.textContent = 'Person B response recorded';
        activePerson = null;
        return;
      }

      // PERSON A: automatically translate and speak the translation.
      translated.textContent = 'Translating…';
      play.disabled = true;
      status.textContent = 'Translating…';

      try {
        const translation = await translateWithAI(text, source.value, target.value);
        state[person].translation = translation;
        translated.textContent = translation;
        play.disabled = false;
        status.textContent = 'Speaking translation…';

        speakTranslation(translation, target.value, () => {
          activePerson = null;
          status.textContent = 'Person B can respond';
        });
      } catch (error) {
        translated.textContent = 'Translation unavailable.';
        status.textContent = 'Translation error';
        activePerson = null;
        console.error(error);
      }
    };

    recognition.onerror = (event) => {
      status.textContent = `Microphone error: ${event.error}`;
      activePerson = null;
    };

    recognition.onend = () => {
      state[person].recognition = null;
      speak.classList.remove('listening');
      speak.querySelector('span').textContent = 'Speak';
      if (status.textContent === 'Listening…') status.textContent = 'Ready';
    };
  });

  // Manual replay is only useful for Person A's automatic translation.
  play.addEventListener('click', () => {
    if (person !== 'A' || !state[person].translation) return;
    speakTranslation(state[person].translation, target.value);
  });
}

$('swapBtn').addEventListener('click', () => {
  const a = $('languageA').value;
  $('languageA').value = $('languageB').value;
  $('languageB').value = a;
});

setupSpeaker('A');
setupSpeaker('B');
