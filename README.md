# ⚾ MLB Live Scoreboard

A live MLB scoreboard web app that shows today's games with real-time scores, game statuses, and detailed game views — plus the latest baseball headlines.

🔗 **[Live Site](https://YOUR-USERNAME.github.io/YOUR-REPO-NAME)**

![MLB Scoreboard Screenshot](screenshot.png)

---

## What It Does

- **Live scoreboard** — displays all of today's MLB games as cards showing teams, scores, and game status (Upcoming, Live, Final)
- **Browse by date** — use the date picker to view games from any date
- **Filter by team** — type a team name to instantly filter the scoreboard
- **Game detail view** — click any game card to see an inning-by-inning line score and pitching matchup
- **Favorite team** — save your favorite team so their games are always highlighted at the top
- **Baseball news feed** — scrollable headlines from MLB.com and ESPN, switchable via tabs
- **Auto-refresh** — when games are live, scores refresh automatically every 30 seconds
- **Loading & error states** — spinner while data loads, friendly message if the API fails

---

## APIs Used

| API | Purpose | Docs |
|-----|---------|------|
| [MLB Stats API](https://statsapi.mlb.com/api/v1/) | Live scores, schedules, linescores, team rosters | No key required |
| [rss2json](https://rss2json.com) | Converts MLB.com and ESPN RSS feeds to JSON for news headlines | No key required |

---

## Extensions Implemented

- ✅ **Multiple API endpoints** — schedule, linescore, and teams endpoints from the MLB Stats API, plus RSS news proxy
- ✅ **localStorage** — favorite team persists across sessions
- ✅ **Detail view** — click any game card for an inning-by-inning breakdown
- ✅ **Animations** — staggered fade-in on game cards and news cards
- ✅ **Visual data display** — color-coded game status (green = live, blue = upcoming, gray = final), winner/loser styling

---

## What I Learned

- How `async/await` and `fetch()` work together to request and process data from a real API
- How to parse deeply nested JSON objects (the MLB API returns data like `linescore.innings[].away.runs`)
- How to separate fetching from rendering — storing API data in a variable so filters and favorites don't trigger unnecessary re-fetches
- How `localStorage` works to save and retrieve user preferences across sessions
- How to use an RSS-to-JSON proxy to pull in a second data source without a backend

---

## How to Run Locally

Just open `index.html` in a browser — no build tools or installs needed. All data is fetched live from the APIs.