# Mini Project #3 Proposal: MLB Live Scoreboard

## What I'm building
A live MLB scoreboard web app that shows today's games with real-time scores, game statuses, and detailed game views — with the ability to save favorite teams.

## Which API I'm using
**MLB Stats API**
- URL: https://statsapi.mlb.com/api/v1/
- No API key required
- Endpoints I plan to use:
  - `/schedule?sportId=1&date=YYYY-MM-DD&hydrate=linescore,probablePitcher` — today's games with scores and pitchers
  - `/game/{gamePk}/linescore` — inning-by-inning breakdown for detail view
  - `/teams?sportId=1` — all MLB teams (for favorite team selection)

## Why I chose this
I'm interested in baseball and wanted to build something I'd actually use. A live scoreboard is a practical, real-world app that pulls genuinely changing data — scores update inning by inning — which makes it a great fit for working with a live API.

## Core features
1. **Today's scoreboard** — display all of today's MLB games as cards showing teams, scores, and game status (Upcoming, Live, Final)
2. **Game detail view** — click any game card to see an inning-by-inning line score and pitching matchup
3. **Favorite team** — save a favorite team to localStorage so their games are highlighted at the top
4. **Loading state** — spinner shown while fetching data
5. **Error state** — friendly message if the API is unreachable or returns no games

## What I don't know yet
- How `async/await` and `fetch()` work together — I understand the concept but haven't written it from scratch
- How to parse a nested JSON object (the MLB API response has deeply nested data like `linescore.innings`)
- How to make the page auto-refresh only when games are live without causing a bad user experience
- How `localStorage` works for saving and retrieving user preferences across sessions