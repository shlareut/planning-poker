# Planning Poker — Firebase Setup (5 Minuten)

## Schritt 1: Firebase-Projekt erstellen

1. Gehe zu [console.firebase.google.com](https://console.firebase.google.com/)
2. Klick auf **Projekt hinzufügen** (oder "Add project")
3. Name: `planning-poker` (oder beliebig)
4. Google Analytics: **Aus** (brauchen wir nicht) → **Projekt erstellen**

## Schritt 2: Web-App registrieren

1. Im Projekt-Dashboard auf das **Web-Symbol** klicken (`</>`)
2. App-Name: `Planning Poker`
3. Firebase Hosting: **Nicht** ankreuzen (wir nutzen GitHub Pages)
4. **App registrieren** klicken
5. Du siehst jetzt einen Code-Block mit `firebaseConfig` — **diesen kopieren!**

Er sieht ungefähr so aus:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "planning-poker-xxxxx.firebaseapp.com",
  databaseURL: "https://planning-poker-xxxxx-default-rtdb.firebaseio.com",
  projectId: "planning-poker-xxxxx",
  storageBucket: "planning-poker-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

## Schritt 3: Realtime Database aktivieren

1. Im linken Menü: **Build** → **Realtime Database**
2. **Datenbank erstellen** klicken
3. Standort: **europe-west1** (oder beliebig)
4. Sicherheitsregeln: **Im Testmodus starten** wählen
5. **Aktivieren** klicken

### Sicherheitsregeln anpassen

Gehe zu **Realtime Database** → **Regeln** und ersetze den Inhalt mit:

```json
{
  "rules": {
    "sessions": {
      ".read": true,
      "$sessionId": {
        ".write": true
      }
    }
  }
}
```

**Veröffentlichen** klicken. Diese Regeln erlauben Lesen auf allen Sessions (nötig für Auto-Cleanup) und Schreiben nur innerhalb einzelner Sessions.

## Schritt 4: Config-Datei anlegen

1. Kopiere `firebase-config.example.js` zu `firebase-config.js`
2. Öffne `firebase-config.js` und ersetze die Platzhalter mit deinen Werten aus Schritt 2:

```javascript
export default {
  apiKey: "AIzaSy...",
  authDomain: "planning-poker-xxxxx.firebaseapp.com",
  databaseURL: "https://planning-poker-xxxxx-default-rtdb.firebaseio.com",
  projectId: "planning-poker-xxxxx",
  storageBucket: "planning-poker-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

3. Speichern

**Wichtig:** `firebase-config.js` steht in `.gitignore` und wird **nicht** ins Repo committet. So bleiben deine Zugangsdaten privat.

## Schritt 5: Deployen auf GitHub Pages

1. Lege folgende Dateien in den `docs/`-Ordner deines Repos:
   - `index.html`
   - `firebase-config.js` (deine echte Config)
   - `firebase-config.example.js` (Template für andere)
2. Stelle sicher dass `.gitignore` im Repo-Root liegt (ignoriert `docs/firebase-config.js`)
3. Settings → Pages → Source: `main` / `/docs`
4. Fertig: `https://dein-user.github.io/planning-poker/`

**Hinweis:** Da `firebase-config.js` in `.gitignore` steht, musst du sie **manuell über die GitHub Web-UI hochladen** oder `git add -f docs/firebase-config.js` einmalig verwenden. Alternativ: Nutze GitHub Actions Secrets um die Datei beim Deploy zu generieren.

**Einfachste Variante:** `firebase-config.js` einfach direkt über GitHub Web-UI hochladen (Add file → Upload files) — `.gitignore` verhindert nur das lokale Committen, nicht den manuellen Upload.

### Lokal testen
```bash
cd docs
npx serve .
```
Dann in zwei Browser-Tabs öffnen.

## Das war's!

- Keine Node.js-Abhängigkeit für die App selbst
- Kein Backend, kein Server, kein TURN
- Firebase Free Tier: 100 gleichzeitige Connections, 1 GB Storage, 10 GB Transfer/Monat
- Für 5–10 Leute im Team wirst du nie ans Limit kommen
