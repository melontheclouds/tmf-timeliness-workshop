const answerClasses = ["red", "blue", "yellow", "green"];
const answerMarkers = ["A", "B", "C", "D"];

const pinValue = document.getElementById("pinValue");
const heroPlayers = document.getElementById("heroPlayers");
const heroConnected = document.getElementById("heroConnected");
const heroSubmissions = document.getElementById("heroSubmissions");
const joinLinks = document.getElementById("joinLinks");
const roundPill = document.getElementById("roundPill");
const timerFill = document.getElementById("timerFill");
const timerText = document.getElementById("timerText");
const categoryPill = document.getElementById("categoryPill");
const pointsPill = document.getElementById("pointsPill");
const questionTitle = document.getElementById("questionTitle");
const factPanel = document.getElementById("factPanel");
const answerGrid = document.getElementById("answerGrid");
const leaderboard = document.getElementById("leaderboard");
const roster = document.getElementById("roster");
const startButton = document.getElementById("startButton");
const revealButton = document.getElementById("revealButton");
const nextButton = document.getElementById("nextButton");
const restartButton = document.getElementById("restartButton");
const newLobbyButton = document.getElementById("newLobbyButton");
const phasePill = document.getElementById("phasePill");
const finishCard = document.getElementById("finishCard");
const finishCopy = document.getElementById("finishCopy");
const podium = document.getElementById("podium");
const finishRestartButton = document.getElementById("finishRestartButton");
const finishNewLobbyButton = document.getElementById("finishNewLobbyButton");

let state = null;
let clockOffsetMs = 0;
let finishSignature = "";
const finishAwards = [
  {
    label: "Best Picture",
    summary: "Night champion. Walked away with the loudest applause and the top score.",
    chips: ["Gold spotlight", "Lead winner"]
  },
  {
    label: "Audience Favorite",
    summary: "Close to the crown and never out of the race. Strong second-place finish.",
    chips: ["Silver spotlight", "Finalist"]
  },
  {
    label: "Scene Stealer",
    summary: "Claimed a podium finish and made sure the finale still had drama.",
    chips: ["Bronze spotlight", "Podium"]
  }
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function fetchState() {
  try {
    const response = await fetch("/api/state", { cache: "no-store" });
    const payload = await response.json();
    state = payload;
    clockOffsetMs = state.serverNow - Date.now();
    render();
  } catch (error) {
    phasePill.textContent = "Host connection lost";
  }
}

async function postAction(url) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: "{}"
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }

  state = payload.state;
  clockOffsetMs = state.serverNow - Date.now();
  render();
}

function renderJoinLinks() {
  if (!state.joinLinks.length) {
    joinLinks.innerHTML = '<div class="empty-card">No join link is available yet.</div>';
    return;
  }

  joinLinks.innerHTML = state.joinLinks.map((link) => `
    <div class="link-item">
      <div class="link-row">
        <strong>${escapeHtml(link.label)}</strong>
        <button class="link-copy" type="button" data-copy="${escapeHtml(link.url)}">Copy link</button>
      </div>
      <div class="link-url">${escapeHtml(link.url)}</div>
    </div>
  `).join("");
}

function renderLeaderboard(target, players, emptyText) {
  if (!players.length) {
    target.innerHTML = `<div class="empty-card">${escapeHtml(emptyText)}</div>`;
    return;
  }

  target.innerHTML = players.map((player, index) => `
    <div class="leader-row">
      <div class="rank-box">${player.rank || index + 1}</div>
      <div class="player-meta">
        <div class="player-name">${escapeHtml(player.name)}</div>
        <div class="player-status">${player.online ? "online" : "away"}</div>
      </div>
      <div class="player-score">${player.score}</div>
    </div>
  `).join("");
}

function renderQuestion() {
  if (!state.question) {
    roundPill.textContent = "Lobby";
    categoryPill.textContent = "Join phase";
    pointsPill.textContent = "0 pts";
    questionTitle.textContent = "Players can join now. Start when the lobby looks good.";
    answerGrid.innerHTML = `
      <div class="empty-card">Phones join using the link and PIN on the right.</div>
      <div class="empty-card">Once the game starts, this area becomes the live question stage.</div>
    `;
    factPanel.classList.remove("is-visible");
    factPanel.textContent = "";
    return;
  }

  roundPill.textContent = `Q ${state.question.index} / ${state.question.total}`;
  categoryPill.textContent = state.question.category;
  pointsPill.textContent = `${state.question.points} pts`;
  questionTitle.textContent = state.question.prompt;

  if (state.question.fact && (state.phase === "reveal" || state.phase === "finished")) {
    factPanel.textContent = state.question.fact;
    factPanel.classList.add("is-visible");
  } else {
    factPanel.textContent = "";
    factPanel.classList.remove("is-visible");
  }

  answerGrid.innerHTML = state.question.options.map((option, index) => {
    const count = state.answerCounts[index] || 0;
    const isCorrect = state.question.correctIndex === index && (state.phase === "reveal" || state.phase === "finished");
    const isDimmed = state.question.correctIndex !== null && state.question.correctIndex !== index && (state.phase === "reveal" || state.phase === "finished");

    return `
      <article class="answer-card ${answerClasses[index]} ${isCorrect ? "is-correct" : ""} ${isDimmed ? "is-dimmed" : ""}">
        <div class="answer-marker">${answerMarkers[index]}</div>
        <div class="count-chip">${count}</div>
        <div class="answer-copy">${escapeHtml(option)}</div>
      </article>
    `;
  }).join("");
}

function renderFinish() {
  if (state.phase !== "finished") {
    finishCard.classList.remove("is-visible");
    finishCard.setAttribute("aria-hidden", "true");
    podium.innerHTML = "";
    finishSignature = "";
    return;
  }

  finishCard.classList.add("is-visible");
  finishCard.setAttribute("aria-hidden", "false");

  const nextSignature = JSON.stringify(state.ranking.slice(0, 3));
  if (nextSignature === finishSignature) {
    return;
  }
  finishSignature = nextSignature;

  const winner = state.ranking[0];
  finishCopy.textContent = winner
    ? `${winner.name} took home the main award with ${winner.score} points. Use "Same players" for a rematch or "Fresh lobby" to clear the room and generate a new PIN.`
    : "No players were left in the game. Open a fresh lobby to generate a new PIN.";

  podium.innerHTML = state.ranking.slice(0, 3).map((player, index) => {
    const award = finishAwards[index];

    return `
    <article class="podium-card place-${index + 1}">
      <div class="podium-label">${index + 1}${index === 0 ? "st" : index === 1 ? "nd" : "rd"} place</div>
      <div class="podium-award">${award.label}</div>
      <div class="podium-trophy" aria-hidden="true">
        <div class="trophy-arm left"></div>
        <div class="trophy-arm right"></div>
        <div class="trophy-base"></div>
      </div>
      <div>
        <div class="podium-name">${escapeHtml(player.name)}</div>
        <div class="podium-score">${player.score} pts</div>
      </div>
      <div class="podium-summary">${award.summary}</div>
      <div class="podium-meta">
        ${award.chips.map((chip) => `<div class="podium-chip">${escapeHtml(chip)}</div>`).join("")}
      </div>
    </article>
  `;
  }).join("");
}

function updateButtons() {
  const playerCount = state.playerCount;

  startButton.disabled = !(state.phase === "lobby" && playerCount >= 2);
  revealButton.disabled = state.phase !== "question";
  nextButton.disabled = state.phase !== "reveal";
  restartButton.disabled = state.phase === "lobby" && playerCount === 0;
  newLobbyButton.disabled = state.phase === "lobby" && playerCount === 0;

  if (state.phase === "reveal" && state.question && state.question.index === state.question.total) {
    nextButton.textContent = "Finish game";
  } else {
    nextButton.textContent = "Next question";
  }

  const phaseCopy = {
    lobby: playerCount === 0 ? "Fresh lobby ready" : "Waiting for players",
    question: `${state.submissionsCount}/${state.playerCount} answers locked`,
    reveal: "Answer revealed",
    finished: "Game finished"
  };

  phasePill.textContent = phaseCopy[state.phase] || "Ready";
}

function updateTimer() {
  if (!state || !state.question || state.phase !== "question") {
    timerFill.style.width = "100%";
    timerText.textContent = state && state.phase === "reveal" ? "Revealed" : state && state.phase === "finished" ? "Finished" : "Waiting";
    return;
  }

  const totalMs = state.question.timeLimit * 1000;
  const remainingMs = Math.max(0, state.question.endsAt - (Date.now() + clockOffsetMs));
  const ratio = Math.max(0, Math.min(1, remainingMs / totalMs));
  timerFill.style.width = `${ratio * 100}%`;
  timerText.textContent = `${Math.ceil(remainingMs / 1000)}s`;
}

function render() {
  if (!state) {
    return;
  }

  document.body.classList.toggle("finish-mode", state.phase === "finished");

  pinValue.textContent = state.pin;
  heroPlayers.textContent = `${state.playerCount} players joined`;
  heroConnected.textContent = `${state.connectedCount} online right now`;
  heroSubmissions.textContent = `${state.submissionsCount} answers locked`;

  renderJoinLinks();
  renderQuestion();
  renderLeaderboard(leaderboard, state.ranking, "Scores will appear here once players join.");
  renderLeaderboard(roster, state.players.map((player, index) => ({ ...player, rank: index + 1 })), "No players in the lobby yet.");
  renderFinish();
  updateButtons();
  updateTimer();
}

joinLinks.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-copy]");
  if (!button) {
    return;
  }

  try {
    await navigator.clipboard.writeText(button.dataset.copy);
    button.textContent = "Copied";
    button.classList.add("copy-ok");
    setTimeout(() => {
      button.textContent = "Copy link";
      button.classList.remove("copy-ok");
    }, 1200);
  } catch (error) {
    button.textContent = "Copy failed";
  }
});

startButton.addEventListener("click", async () => {
  try {
    await postAction("/api/host/start");
  } catch (error) {
    phasePill.textContent = error.message;
  }
});

revealButton.addEventListener("click", async () => {
  try {
    await postAction("/api/host/reveal");
  } catch (error) {
    phasePill.textContent = error.message;
  }
});

nextButton.addEventListener("click", async () => {
  try {
    await postAction("/api/host/next");
  } catch (error) {
    phasePill.textContent = error.message;
  }
});

restartButton.addEventListener("click", async () => {
  try {
    await postAction("/api/host/restart");
  } catch (error) {
    phasePill.textContent = error.message;
  }
});

newLobbyButton.addEventListener("click", async () => {
  try {
    await postAction("/api/host/new-lobby");
  } catch (error) {
    phasePill.textContent = error.message;
  }
});

finishRestartButton.addEventListener("click", async () => {
  try {
    await postAction("/api/host/restart");
  } catch (error) {
    phasePill.textContent = error.message;
  }
});

finishNewLobbyButton.addEventListener("click", async () => {
  try {
    await postAction("/api/host/new-lobby");
  } catch (error) {
    phasePill.textContent = error.message;
  }
});

setInterval(updateTimer, 250);
setInterval(fetchState, 900);
fetchState();
