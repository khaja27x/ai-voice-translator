# MediTranslate — AI Voice Mediator

MediTranslate is a browser-based, turn-by-turn voice translator for two people who speak different languages.

## Core behavior

- Person A speaks → the app transcribes, translates, and reads the result aloud for Person B.
- Person B speaks → the app only records/transcribes the response. **There is no automatic translation.** Person B must press **Translate** when ready.
- Either person can replay a translation.
- Languages can be swapped at any time.
- Conversation history stays in the browser session and can be cleared.

## Supported languages

English, Telugu, Hindi, Tamil, Kannada, Malayalam, Marathi, Bengali, Gujarati, and Punjabi.

> Translation quality and direct language-pair availability depend on the configured translation service.

## Stack

- HTML/CSS/JavaScript frontend
- Node.js HTTP server
- Browser Web Speech API for speech recognition and speech synthesis
- MyMemory translation API through the server
- No API key is required for the default prototype configuration

## Run locally

Requirements: Node.js 18+

```bash
npm install
npm start
```

Open `http://localhost:3000` in a browser that supports speech recognition, then allow microphone access.

## Environment

Create `.env` only if you want to change the port:

```env
PORT=3000
```

Do not put private API keys in browser JavaScript.

## Project structure

```text
.
├── index.html
├── style.css
├── app.js
├── server.js
├── package.json
├── .gitignore
└── README.md
```

## Notes

Browser speech recognition support varies by browser and operating system. If speech recognition is unavailable, the UI disables the microphone controls rather than pretending that recording works.

For a production release, replace the demo translation provider with a production-grade provider or a self-hosted translation service, add authentication/rate limiting, and review privacy/compliance requirements before processing sensitive conversations.
