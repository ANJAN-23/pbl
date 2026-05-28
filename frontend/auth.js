const AUTH_KEYS = {
  users: "bockchain_users_v1",
  session: "bockchain_session_v1",
};

function getUsers() {
  try {
    const raw = localStorage.getItem(AUTH_KEYS.users);
    if (!raw) return [];
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

function setUsers(users) {
  localStorage.setItem(AUTH_KEYS.users, JSON.stringify(users));
}

function setSession(voterId) {
  localStorage.setItem(AUTH_KEYS.session, JSON.stringify({ voterId, at: Date.now() }));
}

function clearSession() {
  localStorage.removeItem(AUTH_KEYS.session);
}

function getSession() {
  try {
    const raw = localStorage.getItem(AUTH_KEYS.session);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getCurrentUser() {
  const s = getSession();
  return s?.voterId ? String(s.voterId) : s?.username ? String(s.username) : null;
}

async function sha256Hex(input) {
  // In some browsers/contexts (like `file://`) WebCrypto can be blocked.
  // For this demo, we fallback to a simple hash so login still works.
  try {
    if (!window.crypto?.subtle) throw new Error("WebCrypto not available");

    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    // Very simple non-crypto hash (demo only).
    let h = 0;
    for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
    return h.toString(16).padStart(8, "0");
  }
}

async function signUp(voterId, password) {
  voterId = String(voterId || "").trim();
  password = String(password || "");

  if (!voterId) return { ok: false, message: "Voter ID required" };
  if (password.length < 4) return { ok: false, message: "Password too short" };

  const users = getUsers();
  if (users.some((u) => (u?.voterId ?? u?.username) === voterId)) {
    return { ok: false, message: "Voter ID already exists" };
  }

  const passwordHash = await sha256Hex(password);
  users.push({ voterId, passwordHash, createdAt: Date.now() });
  setUsers(users);

  return { ok: true, message: "Account created (demo auth)" };
}

async function signIn(voterId, password) {
  voterId = String(voterId || "").trim();
  password = String(password || "");

  if (!voterId) return { ok: false, message: "Voter ID required" };
  if (!password) return { ok: false, message: "Password required" };

  const users = getUsers();
  const user = users.find((u) => (u?.voterId ?? u?.username) === voterId);
  if (!user) return { ok: false, message: "Invalid username/password" };

  const passwordHash = await sha256Hex(password);
  if (user.passwordHash !== passwordHash) return { ok: false, message: "Invalid username/password" };

  setSession(voterId);
  return { ok: true, message: "Signed in (demo auth)" };
}

function requireAuthOrRedirect() {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = "login.html";
    return null;
  }
  return user;
}

function logout() {
  clearSession();
  window.location.href = "login.html";
}

window.AUTH = {
  signUp,
  signIn,
  getCurrentUser,
  requireAuthOrRedirect,
  logout,
};

