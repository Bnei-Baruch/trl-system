# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development server (port 3000, hot reload)
yarn start

# Production build (outputs to build/)
yarn build

# Build + deploy via scripts/deploy.sh
yarn deploy
```

There are no test scripts. Requires a `.env` file — copy from `.env.example` if present, or define the variables listed in [src/shared/consts.js](src/shared/consts.js).

## Architecture

This is a React 18 single-page app (no TypeScript) bundled with Webpack 5 + Babel. It is a **real-time translation/interpreter system** built on two transports:

- **MQTT** (`src/shared/mqtt.js`) — singleton `MqttMsg` instance used for all control/command/chat messaging. Topic namespace is `trl/<service>/<id>[/<target>]`.
- **Janus WebRTC** (`src/lib/janus-mqtt.js`, `src/lib/audiobridge-plugin.js`) — audio conferencing via the Janus AudioBridge plugin, signaled over MQTT.

Authentication is via **Keycloak** (`keycloak-js`), managed in `src/components/UserManager.js`. Role checks (`trl_user`, `trl_admin`, `trl_root`) gate access to each app variant.

### App Variants

`src/App.js` renders one variant at a time (others commented out):

| Component | Role | Description |
|---|---|---|
| `MqttClient` | `trl_user` | Translator client — joins an audio room, streams video, has chat |
| `MqttAdmin` | `trl_admin` | Admin panel — room list, user feed management, support chat |
| `MqttMerkaz` | `trl_user` | Dual-mic translator workstation (two AudioBridge connections) |
| `TrlChat` | — | Chat-only view |
| `WeMain` / `WeClient` / `WeHttpStream` | — | Alternative "We" deployment variants |

### MQTT Topic Convention

```
trl/room/<room_id>          — room control messages
trl/room/<room_id>/chat     — room public chat (qos:0, no-local)
trl/users/<user_id>         — private messages to a user
trl/users/broadcast         — broadcast to all users
trl/users/support           — support queue
janus/<session_id>/...      — Janus signaling
```

The `mqtt.watch()` callback routes messages: `trl/room/*/chat` → `MqttChatEvent`, `trl/users/<id>` → `MqttPrivateMessage`, `trl/users/broadcast` → `MqttBroadcastMessage`, everything else → the callback passed to `watch()`.

### Command Message Protocol

Control messages sent over MQTT are plain JSON objects with a `type` field. Handled in `handleCmdData()` on each client:

- `client-reload`, `client-reload-all` — force page reload
- `client-reconnect` — re-join Janus room
- `client-disconnect` — leave room
- `client-mute` — toggle mic
- `sound-test` — mark user as tested
- `support` — support chat message
- `chat-broadcast` — broadcast chat

### Key Shared Modules

- `src/shared/consts.js` — all env vars, `audios_options` (stream IDs), `trllang` (room IDs), `lnglist` (port/streamid/trlid per language), `langs_list` (UI dropdown)
- `src/shared/tools.js` — utilities: `geoInfo`, `testMic`, `micVolume`, `notifyMe`, `getDateString`
- `src/shared/protocol.js` — Janus DataChannel textroom protocol (used for the legacy Janus-based protocol room, separate from MQTT chat)
- `src/lib/devices.js` — mic device enumeration/selection singleton
- `src/lib/audiobridge-plugin.js` — wraps Janus AudioBridge: `join`, `publish`, `mute`, `leave`, `list`, `switch`

### Environment Variables

All required vars are prefixed `REACT_APP_` and consumed via `src/shared/consts.js`:
`REACT_APP_TRL_MQTT_URL`, `REACT_APP_WE_MQTT_URL`, `REACT_APP_MKZ_MQTT_URL`, `REACT_APP_JANUS_SRV_TRL`, `REACT_APP_JANUS_SRV_STR`, `REACT_APP_STUN_SRV1/2`, `REACT_APP_STUN_SRV_STR`, `REACT_APP_JANUS_SRV_ADMIN`, `REACT_APP_ADMIN_SECRET`, `REACT_APP_SECRET`, `REACT_APP_GEO_IP_INFO`, `REACT_APP_SENTRY_DSN`, `REACT_APP_STUDY_MATERIALS`.
