# Helpdesk-Backend

Interne Helpdesk-API für die Verwaltung von Support-Tickets in einem
Unternehmen. Das Backend stellt eine REST-Schnittstelle unter `/api/v1`
bereit, speichert Benutzer, Tickets, Kommentare und Änderungsprotokolle in
PostgreSQL und erzwingt drei Rollen (Melder, Agent, Administrator). Diese
Version ist das Grundgerüst: die Anwendung, die Datenbankanbindung, das
Fehlerformat, die Authentifizierungs-Bausteine und alle Router-Gerüste stehen;
die einzelnen Fachfunktionen liefern die jeweils zuständigen Tickets nach.

## Technischer Aufbau

- **Sprache:** Python 3.12+
- **Web-Framework:** FastAPI
- **Datenbank:** PostgreSQL 18, SQLAlchemy 2, Alembic (Migrationen)
- **Konfiguration:** pydantic-settings (Lesen aus Umgebungsvariablen)
- **Authentifizierung:** HS256-JWT (PyJWT), Passwort-Hashing mit bcrypt
- **Tests:** pytest, httpx/TestClient

## Installation

Voraussetzungen: Python 3.12 oder neuer, Docker (für die lokale Datenbank).

```bash
# Datenbank starten
docker compose up -d

# Backend installieren
cd backend
python -m pip install -e ".[dev]"
```

## Konfiguration

Alle Einstellungen werden aus Umgebungsvariablen gelesen:

| Variable | Bedeutung | Beispiel |
| --- | --- | --- |
| `DATABASE_URL` | Verbindung zur PostgreSQL-Datenbank | `postgresql://app:app@localhost:5432/app` |
| `JWT_SECRET` | Signaturschlüssel für Sitzungs-Token (niemals fest im Code) | zufälliger Hex-Wert |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Gültigkeitsdauer eines Tokens in Minuten | `60` |
| `CORS_ORIGINS` | Kommaseparierte Liste erlaubter Frontend-Ursprünge | `http://localhost:5173` |

`JWT_SECRET` ist ein Geheimnis und gehört nicht ins Repository. Für lokale
Entwicklung zuerst erzeugen, zum Beispiel mit
`python -c "import secrets; print(secrets.token_hex(32))"`.

Beispiel für eine lokale Sitzung:

```bash
export DATABASE_URL="postgresql://app:app@localhost:5432/app"
export JWT_SECRET="<Ihr zufälliger Wert>"
export ACCESS_TOKEN_EXPIRE_MINUTES="60"
export CORS_ORIGINS="http://localhost:5173"
```

## Starten (Entwicklung)

Die Datenbank wird beim Start automatisch auf den aktuellen Migrationsstand
gebracht:

```bash
cd backend
python -m alembic upgrade head
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Anschließend ist die API unter `http://localhost:8000/api/v1` erreichbar, die
automatische OpenAPI-Dokumentation unter `http://localhost:8000/docs`.

## Tests

```bash
cd backend
PYTHONPATH=. python -m pytest
```

Für die Tests muss eine erreichbare PostgreSQL-Datenbank über `DATABASE_URL`
konfiguriert sein.

## Fehlerformat

Jede fehlgeschlagene Anfrage liefert denselben Körper:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Validation failed",
    "fields": { "email": "value is not a valid email address" }
  }
}
```

Statuscodes: 401 ohne oder mit ungültigem Token, 403 bei fehlender Berechtigung,
404 bei unbekannter Ressource, 409 bei bereits vergebener E-Mail, 422 bei
ungültigen Eingaben und 501 für noch nicht implementierte Endpunkte.

## Endpunkte (Schnittstelle)

Alle Pfade unterhalb von `/api/v1`. Geschützte Endpunkte erwarten den Header
`Authorization: Bearer <jwt>`.

| Methode | Pfad | Beschreibung |
| --- | --- | --- |
| GET | `/health` | Zustandsprüfung, liefert `{"status":"ok"}` |
| POST | `/auth/register` | Registrierung eines Melder-Kontos |
| POST | `/auth/login` | Anmeldung, liefert ein Sitzungs-Token |
| GET | `/auth/me` | Angemeldeter Benutzer |
| GET | `/users` | Benutzerliste (nur Administrator) |
| POST | `/users` | Benutzer anlegen (nur Administrator) |
| PATCH | `/users/{user_id}` | Rolle/Status ändern (nur Administrator) |
| GET | `/users/assignable` | Aktive Agenten/Administratoren zur Zuweisung |
| POST | `/tickets` | Ticket anlegen |
| GET | `/tickets` | Ticketliste mit Suche, Filtern, Sortierung, Seiten |
| GET | `/tickets/export` | Gefilterte Ticketliste als CSV (UTF-8, Semikolon) |
| GET | `/tickets/{id}` | Einzelnes Ticket |
| PATCH | `/tickets/{id}` | Ticket bearbeiten |
| POST | `/tickets/{id}/assign` | Ticket zuweisen |
| POST | `/tickets/{id}/close` | Ticket schließen |
| GET | `/tickets/{id}/history` | Änderungsprotokoll eines Tickets |
| GET | `/tickets/{id}/comments` | Kommentare eines Tickets |
| POST | `/tickets/{id}/comments` | Kommentar hinzufügen |
| GET | `/dashboard/metrics` | Kennzahlen für das Dashboard |

Die fachlichen Antwortkörper (Ticket, Kommentar, Verlaufseintrag) werden von
den jeweils zuständigen Tickets implementiert; in diesem Grundgerüst antworten
die noch offenen Endpunkte mit `501 Not Implemented`.

## Funktionsumfang (geplant)

- Registrierung und Anmeldung mit gehashten Passwörtern und Sitzungs-Token
- Serverseitig durchgesetzte Rollen: Melder, Agent, Administrator
- Vollständiger Ticket-Lebenszyklus inklusive Zuweisung und Schließen
- Kommentare und Änderungsprotokoll je Ticket
- Suche, Filter, Sortierung und Seitenblätterung der Ticketliste
- Aus der Priorität abgeleitetes Fälligkeitsdatum mit Überfälligkeitskennzeichnung
- Dashboard-Kennzahlen und gefilterter CSV-Export
- Benutzerverwaltung durch Administratoren
