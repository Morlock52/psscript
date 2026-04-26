# UI Branding Refresh - 2026-04-24 Status

The current UI baseline is the modern muted PSScript brand shell.

## Current Visual Direction

- Dark enterprise shell with left navigation and top navbar.
- Branded PSScript logo/mark used in the app shell and favicon assets.
- Muted teal, blue-slate, and warm amber accents instead of bright blue/purple defaults.
- Chat header, chat controls, user bubbles, loading dots, save buttons, navbar account actions, and Voice Copilot controls use subdued surfaces and borders.
- Voice Copilot is branded as an OpenAI Audio-powered dock with Dictate and Speak controls.

## Current Files

| File | Role |
| --- | --- |
| `src/frontend/public/psscript-logo.svg` | Brand logo asset. |
| `src/frontend/public/favicon.svg` | App favicon. |
| `src/frontend/src/components/BrandMark.tsx` | Reusable in-app brand mark. |
| `src/frontend/src/components/Navbar.tsx` | Top shell branding and muted account/notification actions. |
| `src/frontend/src/components/Sidebar.tsx` | App navigation shell. |
| `src/frontend/src/pages/SimpleChatWithAI.tsx` | Muted AI chat header and controls. |
| `src/frontend/src/components/ChatMessage.tsx` | Muted chat message bubbles and script-save actions. |
| `src/frontend/src/components/VoiceAssistantDock.tsx` | Muted Voice Copilot dock and floating control. |
| `src/frontend/src/index.css` | Global tokens, muted colors, gradients, and typography stack. |

## Validation

Browser Use RUN2 on 2026-04-24 confirmed:

- `/chat` renders the muted PSScript AI Assistant shell.
- Search, History, Light, Clear, Upload Script, Send, and Voice controls are present.
- Search toggles safely.
- Voice Copilot opens with Dictate/Speak controls.
- UI components and settings pages render with current shell controls.

See [`../BROWSER_USE_QA.md`](../BROWSER_USE_QA.md) for the full QA matrix.
