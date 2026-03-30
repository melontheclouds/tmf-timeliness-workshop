const answerClasses = ["red", "blue", "yellow", "green"];
const answerMarkers = ["A", "B", "C", "D"];
const STORAGE_KEY = "kahootPartyPlayerId";

const joinScreen = document.getElementById("joinScreen");
const playerScreen = document.getElementById("playerScreen");
const joinForm = document.getElementById("joinForm");
const pinInput = document.getElementById("pinInput");
const nameInput = document.getElementById("nameInput");
const errorText = document.getElementById("errorText");
const leaveButton = document.getElementById("leaveButton");
const playerIntro = document.getElementById("playerIntro");
const miniHeading = document.getElementById("miniHeading");
const miniTitle = document.getElementById("miniTitle");
const youBadge = document.getElementById("youBadge");
const scoreBadge = document.getElementById("scoreBadge");
const rankBadge = document.getElementById("rankBadge");
const playerTimerFill = document.getElementById("playerTimerFill");
const playerTimerText = document.getElementById("playerTimerText");
const stateTitle = document.getElementById("stateTitle");
const stateCopy = document.getElementById("stateCopy");
const answerStage = document.getElementById("answerStage");
const resultCard = document.getElementById("resultCard");
const resultBadge = document.getElementById("resultBadge");
const resultCopy = document.getElementById("resultCopy");
const playerAwards = document.getElementById("playerAwards");
const playerAwardsCopy = document.getElementById("playerAwardsCopy");
const playerAwardsRank = document.getElementById("playerAwardsRank");
const playerAwardsPodium = document.getElementById("playerAwardsPodium");

const queryPin = new URLSearchParams(window.location.search).get("pin") || "";
let playerId = localStorage.getItem(STORAGE_KEY) || "";
let state = null;
let clockOffsetMs = 0;
let finishSignature = "";
const finishAwards = [
  {
    label: "Best Picture",
    summary: "Main winner of the night.",
    chips: ["Gold spotlight", "Lead winner"]
  },
  {
    label: "Audience Favorite",
    summary: "Strong silver finish with real pressure on the top spot.",
    chips: ["Silver spotlight", "Finalist"]
  },
  {
    label: "Scene Stealer",
    summary: "Closed the night on the podium and took a share of the applause.",
    chips: ["Bronze spotlight", "Podium"]
  }
];

function ordinal(place) {
  if (place === 1) {
    return "1st";
  }
  if (place === 2) {
    return "2nd";
  }
  if (place === 3) {
    return "3rd";
  }
  return `${place}th`;
}

if (queryPin) {
  pinInput.value = queryPin;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function clearSession(message = "") {
  playerId = "";
  localStorage.removeItem(STORAGE_KEY);
  state = null;
  finishSignature = "";
  document.body.classList.remove("player-finish-mode");
  joinScreen.hidden = false;
  playerScreen.hidden = true;
  leaveButton.hidden = true;
  errorText.textContent = message;
  resultCard.hidden = true;
  playerAwards.classList.remove("is-visible");
  playerAwards.setAttribute("aria-hidden", "true");
  playerAwardsPodium.innerHTML = "";
}

async function fetchState() {
  if (!playerId) {
    return;
  }

  try {
    const response = await fetch(`/api/state?playerId=${encodeURIComponent(playerId)}`, {
      cache: "no-store"
    });
    const payload = await response.json();

    if (!payload.you) {
      clearSession("That lobby was reset. Join again with the new PIN.");
      return;
    }

    state = payload;
    clockOffsetMs = state.serverNow - Date.now();
    render();
  } catch (error) {
    stateTitle.textContent = "Connection lost";
    stateCopy.textContent = "Trying to reconnect to the host.";
  }
}

async function joinGame(event) {
  event.preventDefault();
  errorText.textContent = "";

  const body = {
    pin: pinInput.value.trim(),
    name: nameInput.value.trim()
  };

  try {
    const response = await fetch("/api/join", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Join failed");
    }

    playerId = payload.playerId;
    localStorage.setItem(STORAGE_KEY, playerId);
    state = payload.state;
    clockOffsetMs = state.serverNow - Date.now();
    errorText.textContent = "";
    render();
  } catch (error) {
    errorText.textContent = error.message;
  }
}

async function sendAnswer(answerIndex) {
  if (!state || !state.question || state.phase !== "question" || state.yourAnswer) {
    return;
  }

  try {
    const response = await fetch("/api/answer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        playerId,
        answerIndex
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Answer failed");
    }

    state = payload.state;
    clockOffsetMs = state.serverNow - Date.now();
    render();
  } catch (error) {
    stateTitle.textContent = "Answer not sent";
    stateCopy.textContent = error.message;
  }
}

function renderAnswerButtons() {
  if (!state.question || state.phase === "lobby" || state.phase === "finished") {
    answerStage.innerHTML = "";
    return;
  }

  answerStage.innerHTML = state.question.options.map((option, index) => {
    const locked = Boolean(state.yourAnswer);
    const isCorrect = state.question.correctIndex === index && (state.phase === "reveal" || state.phase === "finished");
    const yourPick = state.yourAnswer && state.yourAnswer.answerIndex === index;

    return `
      <button
        class="answer-button ${answerClasses[index]} ${locked && !yourPick ? "is-locked" : ""} ${isCorrect ? "is-correct" : ""}"
        type="button"
        data-answer-index="${index}"
        ${locked || state.phase !== "question" ? "disabled" : ""}
      >
        <div class="answer-marker">${answerMarkers[index]}</div>
        <div class="answer-copy">${escapeHtml(option)}</div>
      </button>
    `;
  }).join("");
}

function renderResult() {
  if (!state || state.phase === "question" || state.phase === "lobby") {
    resultCard.hidden = true;
    return;
  }

  const result = state.lastResult;
  resultCard.hidden = false;

  if (!result || result.answerIndex === null) {
    resultBadge.className = "result-badge wrong";
    resultBadge.textContent = "No answer locked";
    resultCopy.textContent = "You missed that round. Stay ready for the next one.";
    return;
  }

  resultBadge.className = `result-badge ${result.correct ? "correct" : "wrong"}`;
  resultBadge.textContent = result.correct ? `Correct +${result.points}` : "Not this one";

  if (result.correct) {
    resultCopy.textContent = `Nice. You answered fast enough to bank ${result.points} points.`;
  } else {
    const correctOption = state.question ? state.question.options[state.question.correctIndex] : "";
    resultCopy.textContent = `Correct answer: ${correctOption}`;
  }
}

function renderPlayerAwards() {
  if (!state || state.phase !== "finished") {
    playerAwards.classList.remove("is-visible");
    playerAwards.setAttribute("aria-hidden", "true");
    playerAwardsPodium.innerHTML = "";
    finishSignature = "";
    return;
  }

  playerAwards.classList.add("is-visible");
  playerAwards.setAttribute("aria-hidden", "false");

  const nextSignature = JSON.stringify({
    ranking: state.ranking.slice(0, 2),
    you: state.you
  });

  if (nextSignature === finishSignature) {
    return;
  }
  finishSignature = nextSignature;

  playerAwardsRank.textContent = `#${state.you.rank} overall`;

  if (state.you.rank === 1) {
    playerAwardsCopy.textContent = `You won the whole thing with ${state.you.score} points. The finale ends on your solo spotlight.`;
  } else if (state.you.rank === 2) {
    playerAwardsCopy.textContent = `You finished #2 with ${state.you.score} points. The ceremony opens with you, then the winner takes the whole stage.`;
  } else {
    playerAwardsCopy.textContent = `You finished #${state.you.rank} with ${state.you.score} points. Watch the runner-up clear the stage for the winner.`;
  }

  const winner = state.ranking[0];
  const runnerUp = state.ranking[1] || null;
  const winnerChips = [...finishAwards[0].chips];

  if (winner.id === state.you.id) {
    winnerChips.unshift("You");
  }

  let runnerUpMarkup = "";
  if (runnerUp) {
    const runnerUpChips = [...finishAwards[1].chips];
    if (runnerUp.id === state.you.id) {
      runnerUpChips.unshift("You");
    }

    runnerUpMarkup = `
      <article class="podium-card ceremony-card ceremony-runnerup">
        <div class="podium-label">${ordinal(runnerUp.rank)} place</div>
        <div class="podium-award">${finishAwards[1].label}</div>
        <div class="podium-trophy ceremony-trophy" aria-hidden="true">
          <div class="trophy-arm left"></div>
          <div class="trophy-arm right"></div>
          <div class="trophy-base"></div>
        </div>
        <div>
          <div class="podium-name">${escapeHtml(runnerUp.name)}</div>
          <div class="podium-score">${runnerUp.score} pts</div>
        </div>
        <div class="podium-summary">Runner-up enters first, then the stage clears for the main winner.</div>
        <div class="podium-meta">
          ${runnerUpChips.map((chip) => `<div class="podium-chip">${escapeHtml(chip)}</div>`).join("")}
        </div>
      </article>
    `;
  }

  playerAwardsPodium.innerHTML = `
    <div class="player-ceremony ${runnerUp ? "has-runnerup" : "winner-only"}">
      ${runnerUpMarkup}
      <article class="podium-card ceremony-card ceremony-winner">
        <div class="winner-spotlights" aria-hidden="true">
          <span class="winner-spotlight left"></span>
          <span class="winner-spotlight center"></span>
          <span class="winner-spotlight right"></span>
          <span class="winner-glow"></span>
        </div>
        <div class="winner-flare" aria-hidden="true"></div>
        <div class="podium-label">${ordinal(winner.rank)} place</div>
        <div class="podium-award">${finishAwards[0].label}</div>
        <div class="podium-trophy ceremony-trophy" aria-hidden="true">
          <div class="trophy-arm left"></div>
          <div class="trophy-arm right"></div>
          <div class="trophy-base"></div>
        </div>
        <div>
          <div class="podium-name">${escapeHtml(winner.name)}</div>
          <div class="podium-score">${winner.score} pts</div>
        </div>
        <div class="podium-summary">The ceremony ends with the full spotlight on the winner.</div>
        <div class="podium-meta">
          ${winnerChips.map((chip) => `<div class="podium-chip">${escapeHtml(chip)}</div>`).join("")}
        </div>
      </article>
    </div>
  `;
}

function renderStateCard() {
  if (!state) {
    return;
  }

  if (state.phase === "lobby") {
    miniHeading.textContent = "Lobby";
    miniTitle.textContent = "Waiting for the host";
    stateTitle.textContent = "You are in";
    stateCopy.textContent = "Keep this phone open. When the host starts, answer buttons will appear here.";
    return;
  }

  if (state.phase === "question") {
    miniHeading.textContent = `Question ${state.question.index}/${state.question.total}`;
    miniTitle.textContent = state.question.prompt;

    if (state.yourAnswer) {
      const option = state.question.options[state.yourAnswer.answerIndex];
      stateTitle.textContent = "Answer locked";
      stateCopy.textContent = `You sent ${option}. Waiting for the reveal.`;
    } else {
      stateTitle.textContent = "Answer now";
      stateCopy.textContent = "Tap one color before the timer runs out.";
    }

    return;
  }

  if (state.phase === "reveal") {
    miniHeading.textContent = "Reveal";
    miniTitle.textContent = state.question.prompt;
    stateTitle.textContent = "Round over";
    stateCopy.textContent = state.question.fact || "Check the result below, then wait for the next question.";
    return;
  }

  miniHeading.textContent = "Finished";
  miniTitle.textContent = "Game complete";
  stateTitle.textContent = "Final rank";
  stateCopy.textContent = `You finished #${state.you.rank} with ${state.you.score} points. Wait for the host to restart or open a fresh lobby for a new PIN.`;
}

function updateBadges() {
  youBadge.textContent = state.you.name;
  scoreBadge.textContent = `${state.you.score} pts`;
  rankBadge.textContent = `#${state.you.rank}`;
}

function updateTimer() {
  if (!state || !state.question || state.phase !== "question") {
    playerTimerFill.style.width = "100%";
    playerTimerText.textContent = state && state.phase === "reveal" ? "Revealed" : state && state.phase === "finished" ? "Finished" : "Waiting";
    return;
  }

  const totalMs = state.question.timeLimit * 1000;
  const remainingMs = Math.max(0, state.question.endsAt - (Date.now() + clockOffsetMs));
  const ratio = Math.max(0, Math.min(1, remainingMs / totalMs));

  playerTimerFill.style.width = `${ratio * 100}%`;
  playerTimerText.textContent = `${Math.ceil(remainingMs / 1000)}s`;
}

function render() {
  if (!state || !state.you) {
    return;
  }

  document.body.classList.toggle("player-finish-mode", state.phase === "finished");
  joinScreen.hidden = true;
  playerScreen.hidden = false;
  leaveButton.hidden = false;
  playerIntro.textContent = "This phone is now your answer pad. Keep it open until the game ends.";

  updateBadges();
  renderStateCard();
  renderAnswerButtons();
  renderResult();
  renderPlayerAwards();
  updateTimer();
}

answerStage.addEventListener("click", (event) => {
  const button = event.target.closest("[data-answer-index]");
  if (!button) {
    return;
  }

  sendAnswer(Number(button.dataset.answerIndex));
});

joinForm.addEventListener("submit", joinGame);

leaveButton.addEventListener("click", () => {
  clearSession("");
});

setInterval(updateTimer, 250);
setInterval(fetchState, 900);

if (playerId) {
  fetchState();
}
