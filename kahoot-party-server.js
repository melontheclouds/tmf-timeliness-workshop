const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { URL } = require("url");

const DEFAULT_PORT = Number(process.env.PORT || 3210);
const PUBLIC_DIR = path.join(__dirname, "kahoot-party");
const ACTIVE_QUESTION_COUNT = 14;
const DEFAULT_QUESTION_TIME_LIMIT = 120;
const PUBLIC_BASE_URL = normalizeBaseUrl(
  process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || ""
);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const questionBank = [
  {
    category: "Timeliness basics",
    points: 1000,
    timeLimit: DEFAULT_QUESTION_TIME_LIMIT,
    prompt: "What does Timeliness measure?",
    options: [
      "The number of documents with e-signatures",
      "Whether documents are available when expected and how long artifacts take to finalize",
      "The number of documents uploaded per week",
      "Length of the approval workflow"
    ],
    answer: 1,
    fact: "Timeliness focuses on whether records are available when expected and how long they take to finalize."
  },
  {
    category: "Timeliness formula",
    points: 1000,
    timeLimit: DEFAULT_QUESTION_TIME_LIMIT,
    prompt: "How is Timeliness calculated?",
    options: [
      "Document Date - Creation (upload) Date",
      "Creation (upload) Date - Document Date or Document Received Date",
      "Document Received Date - Creation (upload) Date",
      "Creation (upload) Date - Approval Date"
    ],
    answer: 1,
    fact: "If Document Received Date is entered in metadata, the calculation uses Upload Date minus Document Received Date."
  },
  {
    category: "Timeliness formula",
    points: 950,
    timeLimit: DEFAULT_QUESTION_TIME_LIMIT,
    prompt: "Which date is always used as the 'Creation date' in the calculation?",
    options: [
      "The date the document is approved",
      "The date the document is signed",
      "The upload date in the system",
      "The document received date"
    ],
    answer: 2,
    fact: "Creation date always means the upload or creation date in the system."
  },
  {
    category: "Process timing",
    points: 1000,
    timeLimit: DEFAULT_QUESTION_TIME_LIMIT,
    prompt: "Timeliness counting starts when:",
    options: [
      "The document is first drafted in SharePoint",
      "The TMF Plan is signed",
      "The Technical QC is completed",
      "Upload (Creation) date into eTMF"
    ],
    answer: 3,
    fact: "Timeliness starts from the upload or creation date in eTMF."
  },
  {
    category: "KPI target",
    points: 1000,
    timeLimit: DEFAULT_QUESTION_TIME_LIMIT,
    prompt: "What is the target for Timeliness performance?",
    options: [
      "95% of documents <= 15 days",
      "90% of documents <= 45 days",
      "80% of documents <= 30 days",
      "70% of documents <= 60 days"
    ],
    answer: 2,
    fact: "The target is 80% of documents completed within 30 days."
  },
  {
    category: "Metadata",
    points: 1000,
    timeLimit: DEFAULT_QUESTION_TIME_LIMIT,
    prompt: "Where can you find the Document Date and Creation Date?",
    options: ["In the metadata", "In the document header", "Only in Power BI", "In the e-mail notification"],
    answer: 0,
    fact: "Document Date and Creation Date are read from metadata."
  },
  {
    category: "Exclusions",
    points: 1000,
    timeLimit: DEFAULT_QUESTION_TIME_LIMIT,
    prompt: "Which statuses are excluded from Timeliness counting?",
    options: [
      "Approved and Effective",
      "Draft and Final",
      "Unclassified, Cancelled, Imported, Deleted",
      "QC Completed"
    ],
    answer: 2,
    fact: "Unclassified, Cancelled, Imported, and Deleted records are excluded from Timeliness counting."
  },
  {
    category: "Exceptions",
    points: 1050,
    timeLimit: DEFAULT_QUESTION_TIME_LIMIT,
    prompt: "What do 'Exceptions' in Timeliness refer to?",
    options: [
      "Documents created from templates",
      "Classifications approved to be excluded from Timeliness counting",
      "Any document with a negative Timeliness",
      "Documents uploaded by CROs"
    ],
    answer: 1,
    fact: "Exceptions are approved classifications excluded from Timeliness counting, such as PI CVs with extended validity."
  },
  {
    category: "VCV behavior",
    points: 1000,
    timeLimit: DEFAULT_QUESTION_TIME_LIMIT,
    prompt: "In VCV, how are 'Exceptions' classifications treated by default?",
    options: [
      "They are automatically excluded from Timeliness",
      "They are always included",
      "They are included only for migrated documents",
      "They are excluded only if the user raises a ticket"
    ],
    answer: 0,
    fact: "In VCV, exception classifications are excluded automatically by default."
  },
  {
    category: "Reporting",
    points: 1000,
    timeLimit: DEFAULT_QUESTION_TIME_LIMIT,
    prompt: "Which pairing correctly describes real-time versus daily refresh behavior?",
    options: [
      "Power BI is real-time; VCV refreshes daily",
      "Both are real-time",
      "VCV is real-time; Power BI - TMF Governance refreshes daily",
      "Both refresh weekly"
    ],
    answer: 2,
    fact: "VCV is real-time, while Power BI - TMF Governance refreshes daily."
  },
  {
    category: "Exceptions scenario",
    points: 1200,
    timeLimit: DEFAULT_QUESTION_TIME_LIMIT,
    prompt: "A team uploads 10 PI CVs late with Timeliness of 120 days. How should this affect the Timeliness KPI in VCV?",
    options: [
      "They count in the >60 days bucket and worsen the KPI",
      "They have a neutral impact because VCV normalizes late uploads across sites",
      "They worsen the KPI only during a migration window",
      "They are automatically excluded as Exceptions, so they do not affect the KPI"
    ],
    answer: 3,
    fact: "PI CVs are on the exception list, so they are excluded and do not worsen the KPI in VCV."
  },
  {
    category: "Document received date",
    points: 1100,
    timeLimit: DEFAULT_QUESTION_TIME_LIMIT,
    prompt: "When should Document Received Date be entered and used in Timeliness?",
    options: [
      "Always, for any internal AZ-authored document",
      "Only when the document is electronically signed in UCP",
      "When a document prepared outside AZ is received by AZ",
      "Never; it is not used in Timeliness"
    ],
    answer: 2,
    fact: "Use Document Received Date for documents prepared outside AZ and received by AZ, such as IRB or IEC letters."
  },
  {
    category: "Date algorithm",
    points: 1150,
    timeLimit: DEFAULT_QUESTION_TIME_LIMIT,
    prompt: "A committee letter shows meeting date 10-Mar, last signature date 15-Mar, and Effective date 20-Mar. Which is the Document Date?",
    options: ["10-Mar", "15-Mar", "The upload date", "20-Mar"],
    answer: 3,
    fact: "Use the date when the document is ready for its business purpose. Here that is the Effective date."
  },
  {
    category: "Signature date",
    points: 1150,
    timeLimit: DEFAULT_QUESTION_TIME_LIMIT,
    prompt: "What should the Document Date be if the receipt date is 03 Jan 2026 and the last valid signature date on the document is 01 Jan 2026?",
    options: ["03 Jan 2026", "01 Jan 2026", "01 Jan 2025", "02 Jan 2026"],
    answer: 1,
    fact: "For documents requiring signature, the Document Date is the date of the last valid signature. Signed error corrections do not change it."
  }
];

function normalizeBaseUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }

    url.pathname = "/";
    url.search = "";
    url.hash = "";

    return url.toString().replace(/\/$/, "");
  } catch (error) {
    return "";
  }
}

function isPrivateHost(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

function requestOrigin(request) {
  if (!request) {
    return "";
  }

  const forwardedProto = String(request.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();
  const forwardedHost = String(request.headers["x-forwarded-host"] || "")
    .split(",")[0]
    .trim();
  const host = forwardedHost || String(request.headers.host || "").trim();

  if (!host) {
    return "";
  }

  return normalizeBaseUrl(`${forwardedProto || "http"}://${host}`);
}

function buildJoinUrl(baseUrl) {
  const url = new URL("/join", baseUrl);
  url.searchParams.set("pin", game.pin);
  return url.toString();
}

function addJoinLink(links, seen, label, address, baseUrl) {
  const url = buildJoinUrl(baseUrl);
  if (seen.has(url)) {
    return;
  }

  seen.add(url);
  links.push({
    label,
    address,
    url
  });
}

function generatePin() {
  return String(100000 + Math.floor(Math.random() * 900000));
}

function freshDeck() {
  return questionBank.slice(0, ACTIVE_QUESTION_COUNT).map((question) => ({
    ...question,
    options: [...question.options]
  }));
}

function createGame() {
  return {
    pin: generatePin(),
    phase: "lobby",
    deck: freshDeck(),
    currentQuestionIndex: -1,
    questionStartedAt: null,
    questionEndsAt: null,
    players: [],
    submissions: new Map(),
    lastResults: {},
    nextPlayerId: 1
  };
}

let game = createGame();
let activePort = DEFAULT_PORT;
let roundTimer = null;

function clearRoundTimer() {
  if (roundTimer) {
    clearTimeout(roundTimer);
    roundTimer = null;
  }
}

function currentQuestion() {
  if (game.currentQuestionIndex < 0) {
    return null;
  }

  return game.deck[game.currentQuestionIndex] || null;
}

function isPlayerOnline(player) {
  return Date.now() - player.lastSeen < 15000;
}

function touchPlayer(playerId) {
  const player = game.players.find((entry) => entry.id === playerId);
  if (player) {
    player.lastSeen = Date.now();
  }

  return player;
}

function rankedPlayers() {
  return [...game.players].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.name.localeCompare(right.name, "en");
  });
}

function answerCounts() {
  const counts = [0, 0, 0, 0];

  for (const submission of game.submissions.values()) {
    counts[submission.answerIndex] += 1;
  }

  return counts;
}

function calculatePoints(question, submittedAt) {
  const durationMs = question.timeLimit * 1000;
  const elapsed = Math.max(0, Math.min(durationMs, submittedAt - game.questionStartedAt));
  const speedRatio = 1 - elapsed / durationMs;
  const multiplier = 0.35 + speedRatio * 0.65;
  return Math.max(150, Math.round(question.points * multiplier));
}

function finishGame() {
  clearRoundTimer();
  game.phase = "finished";
  game.questionStartedAt = null;
  game.questionEndsAt = null;
  game.submissions = new Map();
}

function revealQuestion() {
  if (game.phase !== "question") {
    return;
  }

  clearRoundTimer();

  const question = currentQuestion();
  if (!question) {
    return;
  }

  const results = {};

  for (const player of game.players) {
    const submission = game.submissions.get(player.id);
    let gained = 0;
    let correct = false;

    if (submission && submission.answerIndex === question.answer) {
      correct = true;
      gained = calculatePoints(question, submission.submittedAt);
      player.score += gained;
    }

    results[player.id] = {
      answerIndex: submission ? submission.answerIndex : null,
      correct,
      points: gained
    };
  }

  game.lastResults = results;
  game.phase = "reveal";

  if (game.currentQuestionIndex >= game.deck.length - 1) {
    roundTimer = setTimeout(() => {
      finishGame();
    }, 4500);
  }
}

function scheduleReveal() {
  clearRoundTimer();

  const question = currentQuestion();
  if (!question) {
    return;
  }

  const remainingMs = Math.max(0, game.questionEndsAt - Date.now());
  roundTimer = setTimeout(() => {
    revealQuestion();
  }, remainingMs);
}

function maybeRevealDue() {
  if (game.phase === "question" && game.questionEndsAt && Date.now() >= game.questionEndsAt) {
    revealQuestion();
  }
}

function openQuestion(index) {
  const question = game.deck[index];
  if (!question) {
    finishGame();
    return;
  }

  game.currentQuestionIndex = index;
  game.phase = "question";
  game.questionStartedAt = Date.now();
  game.questionEndsAt = Date.now() + question.timeLimit * 1000;
  game.submissions = new Map();
  game.lastResults = {};
  scheduleReveal();
}

function startGame() {
  if (game.players.length < 2) {
    throw new Error("At least 2 players are required.");
  }

  for (const player of game.players) {
    player.score = 0;
  }

  game.deck = freshDeck();
  openQuestion(0);
}

function nextQuestion() {
  if (game.phase === "question") {
    revealQuestion();
    return;
  }

  if (game.currentQuestionIndex >= game.deck.length - 1) {
    finishGame();
    return;
  }

  openQuestion(game.currentQuestionIndex + 1);
}

function restartGame() {
  clearRoundTimer();

  game.phase = "lobby";
  game.deck = freshDeck();
  game.currentQuestionIndex = -1;
  game.questionStartedAt = null;
  game.questionEndsAt = null;
  game.submissions = new Map();
  game.lastResults = {};

  for (const player of game.players) {
    player.score = 0;
  }
}

function createFreshLobby() {
  clearRoundTimer();
  game = createGame();
}

function joinLinks(request) {
  const networks = os.networkInterfaces();
  const links = [];
  const seen = new Set();
  const origin = PUBLIC_BASE_URL || requestOrigin(request);

  if (origin) {
    const parsedOrigin = new URL(origin);
    if (PUBLIC_BASE_URL || !isPrivateHost(parsedOrigin.hostname)) {
      addJoinLink(links, seen, "public", parsedOrigin.host, origin);
    }
  }

  for (const [label, entries] of Object.entries(networks)) {
    for (const entry of entries || []) {
      if (entry.family !== "IPv4" || entry.internal) {
        continue;
      }

      if (
        !entry.address.startsWith("192.168.") &&
        !entry.address.startsWith("10.") &&
        !entry.address.startsWith("172.")
      ) {
        continue;
      }

      addJoinLink(links, seen, label, entry.address, `http://${entry.address}:${activePort}`);
    }
  }

  if (links.length === 0) {
    addJoinLink(links, seen, "localhost", "127.0.0.1", `http://127.0.0.1:${activePort}`);
  }

  return links;
}

function buildState(playerId, request) {
  maybeRevealDue();

  const question = currentQuestion();
  const ranking = rankedPlayers();
  const player = playerId ? touchPlayer(playerId) : null;
  const playerResult = playerId ? game.lastResults[playerId] || null : null;
  const playerSubmission = playerId ? game.submissions.get(playerId) || null : null;

  const state = {
    serverNow: Date.now(),
    pin: game.pin,
    phase: game.phase,
    joinLinks: joinLinks(request),
    connectedCount: game.players.filter(isPlayerOnline).length,
    playerCount: game.players.length,
    players: game.players.map((entry) => ({
      id: entry.id,
      name: entry.name,
      score: entry.score,
      online: isPlayerOnline(entry)
    })),
    ranking: ranking.map((entry, index) => ({
      id: entry.id,
      name: entry.name,
      score: entry.score,
      rank: index + 1,
      online: isPlayerOnline(entry)
    })),
    answerCounts: answerCounts(),
    submissionsCount: game.submissions.size,
    question: question ? {
      index: game.currentQuestionIndex + 1,
      total: game.deck.length,
      category: question.category,
      prompt: question.prompt,
      options: question.options,
      points: question.points,
      timeLimit: question.timeLimit,
      startedAt: game.questionStartedAt,
      endsAt: game.questionEndsAt,
      fact: game.phase === "reveal" || game.phase === "finished" ? question.fact : null,
      correctIndex: game.phase === "reveal" || game.phase === "finished" ? question.answer : null
    } : null,
    you: player ? {
      id: player.id,
      name: player.name,
      score: player.score,
      rank: ranking.findIndex((entry) => entry.id === player.id) + 1
    } : null,
    yourAnswer: playerSubmission ? {
      answerIndex: playerSubmission.answerIndex,
      submittedAt: playerSubmission.submittedAt
    } : null,
    lastResult: playerResult
  };

  return state;
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";

    request.on("data", (chunk) => {
      raw += chunk.toString("utf8");

      if (raw.length > 1_000_000) {
        reject(new Error("Payload too large"));
        request.destroy();
      }
    });

    request.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("Invalid JSON payload"));
      }
    });

    request.on("error", reject);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": MIME_TYPES[".json"],
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendFile(response, filePath) {
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const cacheControl = [".html", ".css", ".js"].includes(ext) ? "no-store" : "public, max-age=3600";

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(response, 404, { error: "Not found" });
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": cacheControl
    });
    response.end(content);
  });
}

async function handleApi(request, response, url) {
  try {
    if (request.method === "GET" && url.pathname === "/api/state") {
      const playerId = url.searchParams.get("playerId") || "";
      sendJson(response, 200, buildState(playerId, request));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/join") {
      const body = await readJsonBody(request);
      const name = String(body.name || "").trim().replace(/\s+/g, " ");
      const pin = String(body.pin || "").trim();

      if (pin !== game.pin) {
        sendJson(response, 400, { error: "Wrong PIN." });
        return;
      }

      if (!name) {
        sendJson(response, 400, { error: "Name is required." });
        return;
      }

      if (game.phase === "finished") {
        sendJson(response, 400, { error: "Game already finished. Restart from host." });
        return;
      }

      const duplicate = game.players.find((player) => player.name.toLowerCase() === name.toLowerCase());
      if (duplicate) {
        sendJson(response, 409, { error: "That name is already taken." });
        return;
      }

      const player = {
        id: `player-${game.nextPlayerId}`,
        name,
        score: 0,
        lastSeen: Date.now()
      };

      game.nextPlayerId += 1;
      game.players.push(player);

      sendJson(response, 200, {
        ok: true,
        playerId: player.id,
        state: buildState(player.id, request)
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/answer") {
      const body = await readJsonBody(request);
      const playerId = String(body.playerId || "");
      const answerIndex = Number(body.answerIndex);

      maybeRevealDue();

      if (!playerId || !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) {
        sendJson(response, 400, { error: "Invalid answer payload." });
        return;
      }

      const player = touchPlayer(playerId);
      if (!player) {
        sendJson(response, 404, { error: "Player not found." });
        return;
      }

      if (game.phase !== "question") {
        sendJson(response, 400, { error: "Question is not open." });
        return;
      }

      if (game.submissions.has(playerId)) {
        sendJson(response, 200, { ok: true, state: buildState(playerId, request) });
        return;
      }

      game.submissions.set(playerId, {
        answerIndex,
        submittedAt: Date.now()
      });

      sendJson(response, 200, { ok: true, state: buildState(playerId, request) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/host/start") {
      startGame();
      sendJson(response, 200, { ok: true, state: buildState("", request) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/host/reveal") {
      revealQuestion();
      sendJson(response, 200, { ok: true, state: buildState("", request) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/host/next") {
      nextQuestion();
      sendJson(response, 200, { ok: true, state: buildState("", request) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/host/restart") {
      restartGame();
      sendJson(response, 200, { ok: true, state: buildState("", request) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/host/new-lobby") {
      createFreshLobby();
      sendJson(response, 200, { ok: true, state: buildState("", request) });
      return;
    }

    sendJson(response, 404, { error: "API route not found." });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Unexpected server error." });
  }
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (url.pathname.startsWith("/api/")) {
    handleApi(request, response, url);
    return;
  }

  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  if (url.pathname === "/" || url.pathname === "/host") {
    sendFile(response, path.join(PUBLIC_DIR, "host.html"));
    return;
  }

  if (url.pathname === "/join" || url.pathname === "/player") {
    sendFile(response, path.join(PUBLIC_DIR, "player.html"));
    return;
  }

  if (url.pathname === "/styles.css") {
    sendFile(response, path.join(PUBLIC_DIR, "styles.css"));
    return;
  }

  if (url.pathname === "/host.js") {
    sendFile(response, path.join(PUBLIC_DIR, "host.js"));
    return;
  }

  if (url.pathname === "/player.js") {
    sendFile(response, path.join(PUBLIC_DIR, "player.js"));
    return;
  }

  sendJson(response, 404, { error: "Not found." });
});

server.listen(DEFAULT_PORT, "0.0.0.0", () => {
  activePort = server.address().port;

  if (process.env.PUBLIC_BASE_URL && !PUBLIC_BASE_URL) {
    console.warn("PUBLIC_BASE_URL is invalid. Use a full http:// or https:// URL.");
  }

  console.log(`Kahoot party host: http://127.0.0.1:${activePort}`);
  for (const link of joinLinks()) {
    console.log(`Player join (${link.label}): ${link.url}`);
  }
});

process.on("SIGINT", () => {
  clearRoundTimer();
  server.close(() => process.exit(0));
});
