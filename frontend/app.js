const API_BASE = "https://pbl-4-jua6.onrender.com";
const userLabelEl = document.getElementById("userLabel");
const messageEl = document.getElementById("message");
const logoutBtn = document.getElementById("logoutBtn");

const candidatesGridEl = document.getElementById("candidatesGrid");
const resultsBoxEl = document.getElementById("resultsBox");
const chainBoxEl = document.getElementById("chainBox");
const refreshBtn = document.getElementById("refreshBtn");
const validateBtn = document.getElementById("validateBtn");
const validateLabelEl = document.getElementById("validateLabel");

const candidateVoteElsByName = new Map();
const candidateBtnElsByName = new Map();

function setStatusWithKind(text, kind) {
  messageEl.textContent = text || "";
  messageEl.classList.remove("error", "success");
  if (kind === "error") messageEl.classList.add("error");
  if (kind === "success") messageEl.classList.add("success");
}

async function apiCall(path, options = {}) {
  try {
    const res = await fetch(API_BASE + path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  } catch (e) {
    return { error: e?.message || "Network error" };
  }
}

function requireLoggedInUser() {
  return window.AUTH?.requireAuthOrRedirect?.();
}

async function refreshCandidates() {
  candidatesGridEl.innerHTML = `Loading candidates...`;
  candidateVoteElsByName.clear();
  candidateBtnElsByName.clear();

  const data = await apiCall("/candidates");
  if (data?.error) {
    setStatusWithKind("Backend not reachable. Start VotingApi first.", "error");
    candidatesGridEl.innerHTML = `Backend not reachable`;
    return;
  }

  const candidates = Array.isArray(data) ? data : [];
  if (candidates.length === 0) {
    candidatesGridEl.innerHTML = `No candidates available`;
    return;
  }

  candidatesGridEl.innerHTML = "";
  for (const c of candidates) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "candidateBtn";

    const nameEl = document.createElement("div");
    nameEl.className = "candidateName";
    nameEl.textContent = c;

    const votesEl = document.createElement("div");
    votesEl.className = "candidateVotes";
    votesEl.textContent = "Votes: 0";

    btn.appendChild(nameEl);
    btn.appendChild(votesEl);

    btn.addEventListener("click", () => castVote(c));
    candidatesGridEl.appendChild(btn);
    candidateVoteElsByName.set(c, votesEl);
    candidateBtnElsByName.set(c, btn);
  }
}

async function refreshResults() {
  resultsBoxEl.textContent = "Loading...";
  const data = await apiCall("/results");
  if (data?.error) {
    setStatusWithKind("Backend not reachable.", "error");
    resultsBoxEl.textContent = "Backend not reachable";
    return;
  }

  const results = data?.results || {};
  const totalVotes = data?.totalVotes ?? 0;

  for (const [candidate, votesEl] of candidateVoteElsByName.entries()) {
    const v = results[candidate] ?? 0;
    votesEl.textContent = `Votes: ${v}`;
  }

  resultsBoxEl.textContent =
    `Total Votes: ${totalVotes}\n` +
    Object.keys(results)
      .sort()
      .map((k) => `${k}: ${results[k]}`)
      .join("\n");
}

function formatTimestamp(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

async function refreshBlockchain() {
  chainBoxEl.textContent = "Loading...";
  const data = await apiCall("/blockchain");
  if (data?.error) {
    setStatusWithKind("Backend not reachable.", "error");
    chainBoxEl.textContent = "Backend not reachable";
    return;
  }

  const chain = Array.isArray(data) ? data : [];
  if (chain.length === 0) {
    chainBoxEl.textContent = "No blocks yet.";
    return;
  }

  const toShow = chain.slice(Math.max(0, chain.length - 20));
  const startIdx = chain.length - toShow.length;
  let out = "";

  for (let i = 0; i < toShow.length; i++) {
    const idx = startIdx + i;
    const b = toShow[i];
    out += `Block ${idx}\n`;
    out += `  voterId: ${b.voterId}\n`;
    out += `  candidate: ${b.candidate}\n`;
    out += `  timeStamp: ${formatTimestamp(b.timeStamp)}\n`;
    out += `  hash: ${b.hash}\n`;
    out += `  previousHash: ${b.previousHash}\n\n`;
  }
  chainBoxEl.textContent = out;
}

async function validateChain() {
  validateLabelEl.textContent = "Validating...";
  validateLabelEl.classList.remove("statusBadge--valid", "statusBadge--invalid", "statusBadge--loading");
  validateLabelEl.classList.add("statusBadge--loading");

  const data = await apiCall("/validate");
  if (data?.error) {
    validateLabelEl.textContent = "ERROR";
    validateLabelEl.classList.remove("statusBadge--valid", "statusBadge--loading");
    validateLabelEl.classList.add("statusBadge--invalid");
    setStatusWithKind("Backend error: " + data.error, "error");
    return;
  }

  const valid = Boolean(data?.valid);
  validateLabelEl.textContent = valid ? "VALID" : "INVALID";
  validateLabelEl.classList.remove("statusBadge--valid", "statusBadge--invalid", "statusBadge--loading");
  validateLabelEl.classList.add(valid ? "statusBadge--valid" : "statusBadge--invalid");
  setStatusWithKind(valid ? "Blockchain is VALID" : "Blockchain is INVALID", valid ? "success" : "error");
}

async function castVote(candidate) {
  const voterId = window.AUTH?.getCurrentUser?.();
  if (!voterId) return;

  if (!candidate) {
    setStatusWithKind("Select a candidate first.", "error");
    return;
  }

  const clickedBtn = candidateBtnElsByName.get(candidate);
  if (clickedBtn) {
    candidatesGridEl
      .querySelectorAll("button.candidateBtn")
      .forEach((b) => b.classList.remove("candidateBtn--selected"));
    clickedBtn.classList.add("candidateBtn--selected");
  }

  const buttons = candidatesGridEl.querySelectorAll("button.candidateBtn");
  buttons.forEach((b) => (b.disabled = true));

  setStatusWithKind("Submitting vote...", "info");

  const payload = { voterId, candidate };
  const data = await apiCall("/vote", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (data?.error) {
    setStatusWithKind("Backend error: " + data.error, "error");
    buttons.forEach((b) => (b.disabled = false));
    return;
  }

  const status = data?.status;
  if (status === "ok") {
    setStatusWithKind("Vote recorded!", "success");
    await refreshResults();
    await refreshBlockchain();
    await validateChain();
    buttons.forEach((b) => (b.disabled = false));
    return;
  }

  setStatusWithKind("Vote failed: " + (data?.message || data?.raw || "Unknown error"), "error");
  buttons.forEach((b) => (b.disabled = false));
}

async function init() {
  const user = requireLoggedInUser();
  if (!user) return;

  userLabelEl.textContent = user;

  logoutBtn.addEventListener("click", () => window.AUTH.logout());

  refreshBtn.addEventListener("click", async () => {
    setStatusWithKind("", "info");
    await refreshResults();
    await refreshBlockchain();
  });

  validateBtn.addEventListener("click", validateChain);

  await refreshCandidates();
  await refreshResults();
  await refreshBlockchain();
  await validateChain();
  setStatusWithKind("", "info");
}

init();

