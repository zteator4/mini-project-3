// ===== Config =====
const BASE_URL = "https://statsapi.mlb.com/api/v1";
let autoRefreshTimer = null;

// ===== State =====
let favoriteTeamId = localStorage.getItem("mlb_fav_team_id")
  ? parseInt(localStorage.getItem("mlb_fav_team_id"))
  : null;
let favoriteTeamName = localStorage.getItem("mlb_fav_team_name") || null;

// ===== DOM References =====
const scoreboardEl   = document.getElementById("scoreboard");
const loadingEl      = document.getElementById("loading");
const errorEl        = document.getElementById("error");
const noGamesEl      = document.getElementById("no-games");
const todayDateEl    = document.getElementById("today-date");
const favBtn         = document.getElementById("fav-btn");
const favModal       = document.getElementById("fav-modal");
const teamSelect     = document.getElementById("team-select");
const saveFavBtn     = document.getElementById("save-fav");
const closeModalBtn  = document.getElementById("close-modal");
const detailModal    = document.getElementById("detail-modal");
const detailBody     = document.getElementById("detail-body");
const closeDetail    = document.getElementById("close-detail");
const retryBtn       = document.getElementById("retry-btn");
const datePicker     = document.getElementById("date-picker");
const teamFilterEl   = document.getElementById("team-filter");
const clearFilterBtn = document.getElementById("clear-filter");
const standingsBody  = document.getElementById("standings-body");
const standingsTabs  = document.querySelectorAll(".standings-tab");

// ===== Filter State =====
let allGames = []; // store fetched games so filter doesn't re-fetch
let activeLeague = "AL";

// ===== Standings =====
// MLB league/division IDs
const DIVISIONS = {
  AL: [
    { id: 200, name: "AL West" },
    { id: 201, name: "AL East" },
    { id: 202, name: "AL Central" },
  ],
  NL: [
    { id: 203, name: "NL West" },
    { id: 204, name: "NL East" },
    { id: 205, name: "NL Central" },
  ],
};

function showStandingsSkeleton() {
  standingsBody.innerHTML = Array(3).fill(`
    <div class="standings-skel">
      <div class="skel-line short"></div>
      <div class="skel-line long"></div>
      <div class="skel-line long"></div>
      <div class="skel-line med"></div>
      <div class="skel-line long"></div>
    </div>
  `).join("");
}

async function loadStandings(league = activeLeague) {
  showStandingsSkeleton();
  try {
    const res  = await fetch(`${BASE_URL}/standings?leagueId=${league === "AL" ? 103 : 104}&season=${new Date().getFullYear()}&standingsTypes=regularSeason&hydrate=team`);
    if (!res.ok) throw new Error("standings fetch failed");
    const data = await res.json();

    const records = data.records || [];
    standingsBody.innerHTML = "";

    // Sort divisions in our preferred order
    const divOrder = DIVISIONS[league].map(d => d.id);
    const sorted = [...records].sort((a, b) =>
      divOrder.indexOf(a.division.id) - divOrder.indexOf(b.division.id)
    );

    sorted.forEach((divRecord, di) => {
      const divName = DIVISIONS[league].find(d => d.id === divRecord.division.id)?.name || divRecord.division.name;
      const teams = divRecord.teamRecords || [];

      const rows = teams.map(t => {
        const isFav = favoriteTeamId && t.team.id === favoriteTeamId;
        const gb = t.gamesBack === "-" ? "—" : t.gamesBack;
        return `
          <tr class="${isFav ? "my-team" : ""}">
            <td title="${t.team.name}">${t.team.teamName}</td>
            <td>${t.wins}</td>
            <td>${t.losses}</td>
            <td>${t.winningPercentage}</td>
            <td>${gb}</td>
          </tr>
        `;
      }).join("");

      const block = document.createElement("div");
      block.className = "division-block";
      block.style.animationDelay = `${di * 60}ms`;
      block.innerHTML = `
        <div class="division-name">${divName}</div>
        <table class="standings-table">
          <thead>
            <tr>
              <th>Team</th>
              <th>W</th>
              <th>L</th>
              <th>PCT</th>
              <th>GB</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
      standingsBody.appendChild(block);
    });
  } catch {
    standingsBody.innerHTML = `<p style="color:#8b9ab0;font-size:0.85rem;padding:0.5rem 0">Couldn't load standings.</p>`;
  }
}

standingsTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    standingsTabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    activeLeague = tab.dataset.league;
    loadStandings(activeLeague);
  });
});

// ===== Helpers =====
function getTodayString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDisplayDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00"); // noon local to avoid timezone shift
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function showEl(el)  { el.classList.remove("hidden"); }
function hideEl(el)  { el.classList.add("hidden"); }

function getStatusInfo(game) {
  const code = game.status?.codedGameState;
  const detail = game.status?.detailedState || "";
  const inning = game.linescore?.currentInning;
  const inningHalf = game.linescore?.inningHalf;

  if (code === "F" || code === "O") {
    return { label: "Final", cls: "final" };
  } else if (code === "I" || code === "MA" || code === "IR") {
    const halfLabel = inningHalf === "Top" ? "▲" : "▼";
    return { label: `Live · ${halfLabel} ${inning}`, cls: "live" };
  } else if (detail === "Warmup") {
    return { label: "Warmup", cls: "live" };
  } else {
    // Scheduled — show game time
    const utcTime = game.gameDate;
    if (!utcTime) return { label: "Scheduled", cls: "upcoming" };
    const localTime = new Date(utcTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return { label: localTime, cls: "upcoming" };
  }
}

function isGameLive(game) {
  const code = game.status?.codedGameState;
  return code === "I" || code === "MA" || code === "IR";
}

function determineWinner(awayScore, homeScore, status) {
  if (status.cls !== "final") return { away: "", home: "" };
  if (awayScore > homeScore) return { away: "winner", home: "loser" };
  if (homeScore > awayScore) return { home: "winner", away: "loser" };
  return { away: "", home: "" };
}

// ===== Image Helpers =====
function teamLogoUrl(teamId) {
  return `https://www.mlb.com/assets/images/team/logos/team-cap-logo-${teamId}.svg`;
}
function playerHeadshotUrl(personId) {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/w_68,q_100/v1/people/${personId}/headshot/67/current`;
}

// ===== Render a single game card =====
function createGameCard(game) {
  const away  = game.teams.away;
  const home  = game.teams.home;
  const awayScore = away.score ?? "–";
  const homeScore = home.score ?? "–";
  const status = getStatusInfo(game);
  const winner = determineWinner(away.score, home.score, status);

  const awayId = away.team?.id;
  const homeId = home.team?.id;
  const isFav  = favoriteTeamId && (awayId === favoriteTeamId || homeId === favoriteTeamId);

  const card = document.createElement("div");
  card.className = `game-card${isFav ? " favorite" : ""}`;
  card.innerHTML = `
    <div class="game-status ${status.cls}">${status.label}</div>
    <div class="teams">
      <div class="team-row">
        <img class="team-logo" src="${teamLogoUrl(awayId)}" alt="${away.team?.name}" onerror="this.style.display='none'">
        <span class="team-name ${winner.away || ""}">${away.team?.name || "Away"}</span>
        <span class="team-score ${winner.away || ""}">${awayScore}</span>
      </div>
      <div class="team-row">
        <img class="team-logo" src="${teamLogoUrl(homeId)}" alt="${home.team?.name}" onerror="this.style.display='none'">
        <span class="team-name ${winner.home || ""}">${home.team?.name || "Home"}</span>
        <span class="team-score ${winner.home || ""}">${homeScore}</span>
      </div>
    </div>
    <div class="game-meta">
      ${game.venue?.name ? `📍 ${game.venue.name}` : ""}
      ${away.probablePitcher || home.probablePitcher
        ? `<br>⚾ ${away.probablePitcher?.fullName || "TBD"} vs ${home.probablePitcher?.fullName || "TBD"}`
        : ""}
    </div>
  `;

  card.addEventListener("click", () => openDetailModal(game));
  return card;
}

// ===== Filter & Render (no re-fetch) =====
function filterAndRender() {
  const query = teamFilterEl.value.trim().toLowerCase();

  // Show/hide clear button
  if (query) showEl(clearFilterBtn); else hideEl(clearFilterBtn);

  let games = allGames;

  if (query) {
    games = games.filter(g => {
      const away = g.teams.away.team?.name?.toLowerCase() || "";
      const home = g.teams.home.team?.name?.toLowerCase() || "";
      return away.includes(query) || home.includes(query);
    });
  }

  // Sort: favorite first, then live → upcoming → final
  games = [...games].sort((a, b) => {
    const aFav = favoriteTeamId && (a.teams.away.team?.id === favoriteTeamId || a.teams.home.team?.id === favoriteTeamId);
    const bFav = favoriteTeamId && (b.teams.away.team?.id === favoriteTeamId || b.teams.home.team?.id === favoriteTeamId);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    const order = { live: 0, upcoming: 1, final: 2 };
    return (order[getStatusInfo(a).cls] ?? 3) - (order[getStatusInfo(b).cls] ?? 3);
  });

  scoreboardEl.innerHTML = "";

  if (games.length === 0) {
    scoreboardEl.innerHTML = `<p id="no-results" style="color:#8b9ab0;text-align:center;padding:3rem 0;grid-column:1/-1;">
      No games found for "${teamFilterEl.value}". Try a different team name.
    </p>`;
  } else {
    // Stagger animation delay per card
    games.forEach((game, i) => {
      const card = createGameCard(game);
      card.style.animationDelay = `${i * 40}ms`;
      scoreboardEl.appendChild(card);
    });
  }

  showEl(scoreboardEl);
}

// ===== Load & Render Scoreboard =====
async function loadGames() {
  hideEl(errorEl);
  hideEl(noGamesEl);
  hideEl(scoreboardEl);
  showEl(loadingEl);

  // Cancel any existing auto-refresh
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);

  const selectedDate = datePicker.value || getTodayString();
  todayDateEl.textContent = formatDisplayDate(selectedDate);

  try {
    const url = `${BASE_URL}/schedule?sportId=1&date=${selectedDate}&hydrate=linescore,probablePitcher,team`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    hideEl(loadingEl);

    const dates = data.dates || [];
    if (dates.length === 0 || dates[0].games.length === 0) {
      showEl(noGamesEl);
      return;
    }

    allGames = dates[0].games;
    filterAndRender();

    // Auto-refresh if any games are live
    const anyLive = allGames.some(isGameLive);
    if (anyLive) {
      autoRefreshTimer = setInterval(loadGames, 30000);
    }

  } catch (err) {
    console.error("Failed to load games:", err);
    hideEl(loadingEl);
    showEl(errorEl);
  }
}

// ===== Detail Modal =====
async function openDetailModal(game) {
  showEl(detailModal);
  detailBody.innerHTML = `<p style="color:#8b9ab0">Loading game details...</p>`;

  const away = game.teams.away.team?.name || "Away";
  const home = game.teams.home.team?.name || "Home";
  const awayScore = game.teams.away.score ?? "–";
  const homeScore = game.teams.home.score ?? "–";
  const status = getStatusInfo(game);

  try {
    const res  = await fetch(`${BASE_URL}/game/${game.gamePk}/linescore`);
    if (!res.ok) throw new Error("No linescore");
    const ls   = await res.json();
    const innings = ls.innings || [];

    // Build inning headers
    const inningNums = innings.map((_, i) => `<th>${i + 1}</th>`).join("");
    // R H E columns
    const awayRuns = innings.map(inn => `<td>${inn.away?.runs ?? "–"}</td>`).join("");
    const homeRuns = innings.map(inn => `<td>${inn.home?.runs ?? "–"}</td>`).join("");

    detailBody.innerHTML = `
      <div class="detail-teams">${away} <span style="color:#8b9ab0">@</span> ${home}</div>
      <div class="game-status ${status.cls}" style="margin-bottom:1rem">${status.label}</div>

      <table class="linescore-table">
        <thead>
          <tr>
            <th>Team</th>
            ${inningNums}
            <th>R</th><th>H</th><th>E</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${away}</td>
            ${awayRuns}
            <td><strong>${ls.teams?.away?.runs ?? awayScore}</strong></td>
            <td>${ls.teams?.away?.hits ?? "–"}</td>
            <td>${ls.teams?.away?.errors ?? "–"}</td>
          </tr>
          <tr>
            <td>${home}</td>
            ${homeRuns}
            <td><strong>${ls.teams?.home?.runs ?? homeScore}</strong></td>
            <td>${ls.teams?.home?.hits ?? "–"}</td>
            <td>${ls.teams?.home?.errors ?? "–"}</td>
          </tr>
        </tbody>
      </table>

      <div class="detail-meta">
        ${game.venue?.name ? `📍 ${game.venue.name}` : ""}
        ${game.teams.away.probablePitcher ? `<br>⚾ Pitchers: ${game.teams.away.probablePitcher.fullName} vs ${game.teams.home.probablePitcher?.fullName || "TBD"}` : ""}
      </div>
    `;
  } catch {
    detailBody.innerHTML = `
      <div class="detail-teams">${away} <span style="color:#8b9ab0">@</span> ${home}</div>
      <div class="game-status ${status.cls}" style="margin-bottom:1rem">${status.label}</div>
      <p class="detail-meta">Score: ${awayScore} – ${homeScore}</p>
      <p class="detail-meta" style="margin-top:0.5rem">Detailed linescore not available yet.</p>
    `;
  }
}

function closeDetailModal() {
  hideEl(detailModal);
  detailBody.innerHTML = "";
}

// ===== Favorite Team Modal =====
async function loadTeams() {
  try {
    const res  = await fetch(`${BASE_URL}/teams?sportId=1`);
    const data = await res.json();
    const teams = data.teams.sort((a, b) => a.name.localeCompare(b.name));
    teamSelect.innerHTML = `<option value="">– No favorite –</option>` +
      teams.map(t => `<option value="${t.id}" data-name="${t.name}" ${t.id === favoriteTeamId ? "selected" : ""}>${t.name}</option>`).join("");
  } catch {
    teamSelect.innerHTML = `<option value="">Could not load teams</option>`;
  }
}

function openFavModal() {
  loadTeams();
  showEl(favModal);
}

function saveFavorite() {
  const selected = teamSelect.options[teamSelect.selectedIndex];
  if (selected.value) {
    favoriteTeamId   = parseInt(selected.value);
    favoriteTeamName = selected.dataset.name;
    localStorage.setItem("mlb_fav_team_id",   favoriteTeamId);
    localStorage.setItem("mlb_fav_team_name", favoriteTeamName);
    favBtn.textContent = `⭐ ${favoriteTeamName}`;
  } else {
    favoriteTeamId   = null;
    favoriteTeamName = null;
    localStorage.removeItem("mlb_fav_team_id");
    localStorage.removeItem("mlb_fav_team_name");
    favBtn.textContent = "⭐ Set Favorite Team";
  }
  hideEl(favModal);
  if (allGames.length > 0) filterAndRender(); else loadGames();
  loadStandings(); // re-render standings to highlight new favorite team
}

// ===== Event Listeners =====
favBtn.addEventListener("click", openFavModal);
saveFavBtn.addEventListener("click", saveFavorite);
closeModalBtn.addEventListener("click", () => hideEl(favModal));
closeDetail.addEventListener("click", closeDetailModal);
retryBtn.addEventListener("click", loadGames);

// Close modals on backdrop click
favModal.addEventListener("click", e => { if (e.target === favModal) hideEl(favModal); });
detailModal.addEventListener("click", e => { if (e.target === detailModal) closeDetailModal(); });

// Date picker — re-fetch on change
datePicker.addEventListener("change", () => {
  teamFilterEl.value = "";
  hideEl(clearFilterBtn);
  loadGames();
});

// Team filter — filter already-loaded games, no re-fetch
teamFilterEl.addEventListener("input", filterAndRender);

// Clear filter button
clearFilterBtn.addEventListener("click", () => {
  teamFilterEl.value = "";
  hideEl(clearFilterBtn);
  filterAndRender();
});

// ===== Stats Leaders =====
const leadersGrid    = document.getElementById("leaders-grid");
const leadersTabs    = document.querySelectorAll(".leaders-tab");
let activeLeaderType = "hitting";

const HITTING_STATS = [
  { statGroup: "hitting", stat: "battingAverage",       label: "AVG",  decimals: 3 },
  { statGroup: "hitting", stat: "homeRuns",             label: "HR",   decimals: 0 },
  { statGroup: "hitting", stat: "runsBattedIn",         label: "RBI",  decimals: 0 },
  { statGroup: "hitting", stat: "onBasePlusSlugging",   label: "OPS",  decimals: 3 },
  { statGroup: "hitting", stat: "stolenBases",          label: "SB",   decimals: 0 },
  { statGroup: "hitting", stat: "runs",                 label: "R",    decimals: 0 },
];

const PITCHING_STATS = [
  { statGroup: "pitching", stat: "earnedRunAverage",    label: "ERA",  decimals: 2 },
  { statGroup: "pitching", stat: "strikeouts",          label: "SO",   decimals: 0 },
  { statGroup: "pitching", stat: "wins",                label: "W",    decimals: 0 },
  { statGroup: "pitching", stat: "whip",                label: "WHIP", decimals: 2 },
  { statGroup: "pitching", stat: "inningsPitched",      label: "IP",   decimals: 1 },
  { statGroup: "pitching", stat: "saves",               label: "SV",   decimals: 0 },
];

function showLeadersSkeleton() {
  leadersGrid.innerHTML = Array(6).fill(`
    <div class="leaders-skel-card">
      <div class="skel-line short"></div>
      <div class="skel-line long"></div>
      <div class="skel-line med"></div>
      <div class="skel-line long"></div>
      <div class="skel-line med"></div>
    </div>
  `).join("");
}

async function fetchLeaderStat({ statGroup, stat, label, decimals }, index) {
  const ascending = stat === "earnedRunAverage" || stat === "whip";
  const order = ascending ? "asc" : "desc";
  const season = new Date().getFullYear();
  const url = `${BASE_URL}/stats/leaders?leaderCategories=${stat}&season=${season}&leaderGameTypes=R&statGroup=${statGroup}&limit=5&statType=season&sortOrder=${order}`;

  const res  = await fetch(url);
  const data = await res.json();
  const leaders = data.leagueLeaders?.[0]?.leaders || [];

  const rows = leaders.slice(0, 5).map((p, i) => {
    const val = decimals > 0 ? parseFloat(p.value).toFixed(decimals) : p.value;
    const display = (stat === "battingAverage" || stat === "onBasePlusSlugging")
      ? `.${String(val).split(".")[1] || "000"}`
      : val;
    const personId = p.person?.id;
    const isTop = i === 0;
    return `
      <div class="leader-row ${isTop ? "top-leader" : ""}">
        <span class="leader-rank">${p.rank}</span>
        ${isTop && personId ? `<img class="leader-headshot" src="${playerHeadshotUrl(personId)}" alt="${p.person?.fullName}" onerror="this.style.display='none'">` : ""}
        <span class="leader-name" title="${p.person?.fullName}">${p.person?.fullName?.split(" ").slice(-1)[0] ?? "—"}</span>
        <span class="leader-team">${p.team?.abbreviation ?? ""}</span>
        <span class="leader-value">${display}</span>
      </div>
    `;
  }).join("");

  const card = document.createElement("div");
  card.className = "leaders-card";
  card.style.animationDelay = `${index * 50}ms`;
  card.innerHTML = `
    <div class="leaders-stat-name">${label}</div>
    <div class="leaders-list">${rows || '<span style="color:#8b9ab0;font-size:0.8rem">No data</span>'}</div>
  `;
  return card;
}

async function loadLeaders(type = activeLeaderType) {
  showLeadersSkeleton();
  const stats = type === "hitting" ? HITTING_STATS : PITCHING_STATS;

  try {
    const cards = await Promise.all(stats.map((s, i) => fetchLeaderStat(s, i)));
    leadersGrid.innerHTML = "";
    cards.forEach(card => leadersGrid.appendChild(card));
  } catch {
    leadersGrid.innerHTML = `<p style="color:#8b9ab0;font-size:0.85rem;padding:0.5rem 0;grid-column:1/-1">Couldn't load leaders.</p>`;
  }
}

leadersTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    leadersTabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    activeLeaderType = tab.dataset.type;
    loadLeaders(activeLeaderType);
  });
});

// ===== News Feed =====
const NEWS_SOURCES = {
  mlb: {
    label: "MLB.com",
    rss: "https://www.mlb.com/feeds/news/rss.xml",
  },
  espn: {
    label: "ESPN",
    rss: "https://www.espn.com/espn/rss/mlb/news",
  },
};

let activeNewsSource = "mlb";
const newsFeedEl = document.getElementById("news-feed");
const newsTabs   = document.querySelectorAll(".news-tab");

function formatNewsDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function showNewsSkeletons() {
  newsFeedEl.innerHTML = Array(5).fill(`
    <div class="news-skeleton">
      <div class="skel-line short"></div>
      <div class="skel-line long"></div>
      <div class="skel-line med"></div>
      <div class="skel-line long"></div>
    </div>
  `).join("");
}

async function loadNews(source = activeNewsSource) {
  showNewsSkeletons();
  const { rss, label } = NEWS_SOURCES[source];
  const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rss)}&count=10`;

  try {
    const res  = await fetch(proxyUrl);
    const data = await res.json();

    if (data.status !== "ok" || !data.items?.length) throw new Error("No items");

    newsFeedEl.innerHTML = "";
    data.items.forEach((item, i) => {
      const card = document.createElement("a");
      card.className = "news-card";
      card.href = item.link;
      card.target = "_blank";
      card.rel = "noopener noreferrer";
      card.style.animationDelay = `${i * 40}ms`;
      const thumb = item.thumbnail || item.enclosure?.link || "";
      card.innerHTML = `
        ${thumb ? `<img class="news-thumb" src="${thumb}" alt="" onerror="this.style.display='none'">` : ""}
        <span class="news-source-label">${label}</span>
        <span class="news-title">${item.title}</span>
        <span class="news-date">${formatNewsDate(item.pubDate)}</span>
      `;
      newsFeedEl.appendChild(card);
    });
  } catch {
    newsFeedEl.innerHTML = `
      <p style="color:#8b9ab0;padding:1rem 0;font-size:0.88rem">
        Couldn't load headlines. Visit
        <a href="https://www.mlb.com/news" target="_blank" rel="noopener" style="color:#64b5f6">MLB.com</a> or
        <a href="https://www.espn.com/mlb/" target="_blank" rel="noopener" style="color:#64b5f6">ESPN</a> directly.
      </p>
    `;
  }
}

newsTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    newsTabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    activeNewsSource = tab.dataset.source;
    loadNews(activeNewsSource);
  });
});


datePicker.value = getTodayString();
if (favoriteTeamName) favBtn.textContent = `⭐ ${favoriteTeamName}`;
loadNews();
loadLeaders();
loadGames();
loadStandings();