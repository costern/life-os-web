# Life OS Web

Privates Trading- & Life-OS-Dashboard von Colin. Eigene Postgres-Datenbank,
läuft unabhängig von Notion/Cowork-Connectors. Live-Kurse direkt von Crypto.com,
Marktlage/News werden von Claude recherchiert und über eine token-geschützte
API eingetragen.

## Start (lokal)
```
npm install
cp .env.example .env   # Werte eintragen
npm start
```

## Umgebungsvariablen
- DATABASE_URL – Postgres-Verbindung
- SESSION_SECRET – beliebiger langer Zufallsstring
- SITE_PASSWORD – Login-Passwort für die Weboberfläche
- CLAUDE_API_TOKEN – Token, mit dem Claude Marktlage/News/Trades schreiben darf
