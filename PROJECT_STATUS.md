# Projectstatus

## Laatste status

Datum:
2026-06-01

Branch:
staging

Status:
Automatiseringen-dashboard is gebouwd en getest op Netlify staging.

Staging URL:
https://staging--courageous-centaur-f7d1ea.netlify.app/automation-dashboard/

Livegang:
Nog niet gedaan, tenzij main inmiddels bewust is gemerged en gepusht.

Volgende stap:
Controleren of dashboard live moet naar main. Als ja: staging naar main mergen en daarna live testen op /automation-dashboard/.

## Branch-regels

main = live productie
staging = testomgeving
feature/... = tijdelijk werk

## Belangrijke regel

Niet direct naar main pushen. Eerst feature branch, daarna staging, daarna pas main.

## Stopstatus 2026-06-02

Huidige branch:
staging

Status:
- Dashboard prototype staat op staging.
- Dashboard is beschermd met Basic Auth via Netlify Edge Function.
- Tree map blijft publiek.
- Gap-analyse staat op staging.
- Monitoring datamodel SQL staat op staging.
- SQL gebruikt nu apart PostgreSQL schema `monitoring`.
- Database testplan staat op staging.
- Main is nog niet bijgewerkt.
- SQL is nog niet uitgevoerd op Aiven.

Volgende stap:
Morgen kiezen we een veilige testomgeving om `docs/sql/001_monitoring_datamodel.sql` één keer te draaien.

Belangrijk:
- Niet uitvoeren op Aiven `defaultdb` zonder backup, hostcontrole en expliciet akkoord.
- Voorkeur: aparte Aiven testdatabase of lokale PostgreSQL testdatabase.