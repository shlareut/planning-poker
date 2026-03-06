# Planning Poker – P2P via PeerJS

Echtzeit Planning Poker App ohne Backend. Kommunikation läuft direkt zwischen den Browsern (WebRTC) über PeerJS.

## Quick Start

1. Repository klonen / Dateien in den `/docs`-Ordner legen
2. GitHub Pages aktivieren: Settings → Pages → Source: "Deploy from a branch" → Branch: `main`, Folder: `/docs`
3. Fertig – App ist live unter `https://[user].github.io/[repo]/`

## Lokaler Test

```bash
cd docs
npx serve .
# oder
python3 -m http.server 8000
```

Dann in zwei Browser-Tabs öffnen: einmal als Admin, einmal als Gast.

## Wie es funktioniert

- **Admin** erstellt eine Session → bekommt eine PeerJS Peer-ID (= Session-ID)
- **Gäste** öffnen den Share-Link → verbinden sich direkt mit dem Admin-Browser
- Alle Votes werden P2P übertragen, der Admin-Browser hält den autoritativen State
- PeerJS nutzt seinen öffentlichen Cloud-Server **nur** für den initialen WebRTC-Handshake

## Dateien

| Datei | Beschreibung |
|-------|-------------|
| `index.html` | Alle Screens (per CSS display toggle) |
| `style.css` | Dark Theme, Animationen, Responsive |
| `peer-manager.js` | PeerJS-Wrapper (Host/Guest, Messaging) |
| `app.js` | State, UI-Logik, Event-Handler |

## Bekannte Einschränkungen

- Session endet wenn der Admin-Tab geschlossen wird
- WebRTC kann in manchen Firmennetzwerken blockiert sein
- Admin-Passwort ist nur Rollenunterscheidung, kein echtes Security-Feature

## Tech Stack

- Vanilla HTML/CSS/JS (kein Build-Step)
- PeerJS via CDN (WebRTC P2P)
- Font: JetBrains Mono via Google Fonts
