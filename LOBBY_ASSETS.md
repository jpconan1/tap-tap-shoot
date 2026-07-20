# Lobby Asset Checklist

Temporary CSS controls currently occupy these slots. Dynamic names, ratings, statuses, chat text, counts, and timers remain HTML text.

Use three vertically stacked frames at 8 FPS for boiling sheets.

## Lobby

- `lobby/background-overlay`: 960×540
- `lobby/logo`: reuse current 512×368 logo
- `lobby/online-header`: 384×128
- `lobby/player-row`, `player-row-ready`, `player-row-busy`, `player-row-self`, `computer-row`: 512×96 each
- `lobby/status-idle`, `status-ready`, `status-ranked`, `status-computer`: 128×64 each
- `lobby/connection-lost`: 384×128

## Controls and menus

- `lobby/ready-toggle-off`, `ready-toggle-on`: 256×128 each
- `lobby/chat-button`, `chat-button-unread`: 192×96 each
- `lobby/settings-button`, `close-button`: 128×64 each
- `lobby/scroll-up`, `scroll-down`: 64×64 each, optional
- `lobby/player-menu-panel`: 512×384
- `lobby/settings-panel`: 640×384
- `lobby/challenge-ranked-button`: 256×128
- `lobby/rename-button`: 192×96

## Name prompt

- `lobby/name-header`: 384×128
- `lobby/enter-lobby-button`: 256×128
- `lobby/random-name-button`: 192×96

## Challenges

- `lobby/challenge-header`, `challenge-sent`, `challenge-expired`: 384×128 each
- `lobby/accept-button`, `decline-button`, `cancel-button`: 192×96 each

## Chat

- `lobby/chat-drawer`: 640×540
- `lobby/chat-header`: 256×96
- `lobby/chat-ticker`: 640×80
- `lobby/chat-input-frame`: 448×80
- `lobby/send-button`: 160×80
- `lobby/unread-badge`: 64×64
