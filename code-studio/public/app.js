// Code Studio web UI. Plain JS, no build step.
const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
const md = (text) => DOMPurify.sanitize(marked.parse(text || ""));

const state = { config: null, session: null, events: null, running: false };
const messagesEl = $("#messages");

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function scrollToBottom(force) {
  const nearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 200;
  if (force || nearBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ---------- rendering blocks ----------

function toolDetail(name, input) {
  if (!input || typeof input !== "object") return "";
  if (name === "run_command") return input.command || "";
  if (name === "search") return `${input.pattern}${input.glob ? `  (${input.glob})` : ""}`;
  if (name === "web_search") return input.query || "";
  if (name === "web_fetch") return input.url || "";
  return input.path || "";
}

function toolBody(name, input) {
  if (!input) return "";
  if (name === "write_file") return `--- ${input.path} ---\n${input.content ?? ""}`;
  if (name === "edit_file") return `--- ${input.path} ---\n- ${String(input.old_string ?? "").replace(/\n/g, "\n- ")}\n+ ${String(input.new_string ?? "").replace(/\n/g, "\n+ ")}`;
  return JSON.stringify(input, null, 2);
}

const toolEls = new Map(); // tool_use id -> details element

function addTool(id, name, input) {
  let d = toolEls.get(id);
  if (!d) {
    d = el("details", "tool");
    const s = el("summary");
    s.append(el("span", "status", "●"), el("span", "name", name), el("span", "detail"));
    d.append(s, el("div", "body input"), el("div", "body output"));
    toolEls.set(id, d);
    messagesEl.append(d);
  }
  if (input !== undefined) {
    d.querySelector(".detail").textContent = toolDetail(name, input);
    d.querySelector(".input").textContent = toolBody(name, input);
  }
  return d;
}

function setToolResult(id, content, isError) {
  const d = toolEls.get(id);
  if (!d) return;
  d.classList.add(isError ? "error" : "ok");
  d.querySelector(".status").textContent = isError ? "✗" : "✓";
  const text = Array.isArray(content) ? content.map((c) => c.text || "").join("\n") : String(content ?? "");
  d.querySelector(".output").textContent = "→ " + text;
}

function addUser(text) {
  messagesEl.append(el("div", "msg user", text));
}

function addAssistantText(text) {
  const div = el("div", "msg assistant");
  div.innerHTML = md(text);
  messagesEl.append(div);
  return div;
}

function addThinking(text) {
  const d = el("details", "thinking");
  d.append(el("summary", "", "💭 Thinking"), el("div", "body", text));
  messagesEl.append(d);
  return d;
}

function addNotice(text, isError) {
  messagesEl.append(el("div", "notice" + (isError ? " error" : ""), text));
}

function renderHistory(messages) {
  messagesEl.innerHTML = "";
  toolEls.clear();
  for (const m of messages) {
    if (m.role === "user") {
      if (typeof m.content === "string") addUser(m.content);
      else
        for (const b of m.content) {
          if (b.type === "text") addUser(b.text);
          else if (b.type === "tool_result") setToolResult(b.tool_use_id, b.content, b.is_error);
        }
    } else if (m.role === "assistant" && Array.isArray(m.content)) {
      for (const b of m.content) {
        if (b.type === "text" && b.text) addAssistantText(b.text);
        else if (b.type === "thinking" && b.thinking) addThinking(b.thinking);
        else if (b.type === "tool_use") addTool(b.id, b.name, b.input);
        else if (b.type === "server_tool_use") {
          addTool(b.id, b.name, b.input);
          setToolResult(b.id, "(result used by the model)", false);
        }
      }
    }
  }
  if (!messages.length) messagesEl.append(emptyState);
  scrollToBottom(true);
}

// ---------- live run ----------

let live = null; // { textEl, text, thinkingEl, spinner, tools: Map(id -> {name, partial}) }

function resetLive() {
  live = { textEl: null, text: "", thinkingEl: null, spinner: null, tools: new Map() };
}

function showSpinner(label) {
  live.spinner?.remove();
  live.spinner = el("div", "spinner", label);
  messagesEl.append(live.spinner);
}

let renderPending = false;
function renderLiveText() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => {
    renderPending = false;
    if (live?.textEl) live.textEl.innerHTML = md(live.text);
    scrollToBottom();
  });
}

function handleEvent(e) {
  if (!live) resetLive();
  switch (e.type) {
    case "turn_start":
      live.textEl = null;
      live.text = "";
      live.thinkingEl = null;
      showSpinner("Working");
      break;
    case "thinking_delta":
      if (!live.thinkingEl) {
        live.thinkingEl = addThinking("");
        live.thinkingEl.open = true;
      }
      live.thinkingEl.querySelector(".body").textContent += e.text;
      break;
    case "text_delta":
      live.spinner?.remove();
      if (live.thinkingEl) live.thinkingEl.open = false;
      if (!live.textEl) {
        live.textEl = addAssistantText("");
        live.text = "";
      }
      live.text += e.text;
      renderLiveText();
      break;
    case "tool_start":
      if (live.thinkingEl) live.thinkingEl.open = false;
      live.textEl = null;
      live.tools.set(e.id, { name: e.name, partial: "" });
      addTool(e.id, e.name).querySelector(".detail").textContent = "writing…";
      break;
    case "tool_input_delta": {
      const t = live.tools.get(e.id);
      if (t) {
        t.partial += e.partial;
        const d = toolEls.get(e.id);
        if (d) d.querySelector(".detail").textContent = `writing… ${t.partial.length} chars`;
      }
      break;
    }
    case "tool_call":
      addTool(e.id, e.name, e.input);
      showSpinner(`Running ${e.name}`);
      break;
    case "tool_result":
      setToolResult(e.id, e.content, e.isError);
      break;
    case "server_tool":
      live.textEl = null;
      showSpinner(`Using ${e.name}`);
      break;
    case "approval_request":
      live.spinner?.remove();
      showApproval(e);
      break;
    case "usage":
      $("#cost").textContent = `$${e.sessionCostUsd.toFixed(3)}`;
      break;
    case "notice":
      addNotice(e.text);
      break;
    case "error":
      addNotice("Error: " + e.message, true);
      break;
    case "done":
      live.spinner?.remove();
      setRunning(false);
      if (e.stopReason === "refusal") addNotice("The model declined this request.", true);
      if (e.stopReason === "stopped") addNotice("Stopped.");
      closeEvents();
      refreshSessions();
      break;
  }
  scrollToBottom();
}

function showApproval(e) {
  const box = el("div", "approval");
  const what = e.name === "run_command" ? e.input.command : `Delete ${e.input.path}`;
  box.append(el("div", "", e.name === "run_command" ? "Run this command?" : "Allow this?"), el("pre", "", what));
  const actions = el("div", "actions");
  const decide = async (approve, always) => {
    box.querySelectorAll("button").forEach((b) => (b.disabled = true));
    await api(`/api/sessions/${state.session.id}/approve`, { method: "POST", body: { toolId: e.id, approve, always } });
    box.remove();
    if (always) $("#autoApprove").checked = true;
  };
  const yes = el("button", "primary", "Run");
  const always = el("button", "", "Always run (this chat)");
  const no = el("button", "", "Skip");
  yes.onclick = () => decide(true, false);
  always.onclick = () => decide(true, true);
  no.onclick = () => decide(false, false);
  actions.append(yes, always, no);
  box.append(actions);
  messagesEl.append(box);
  scrollToBottom(true);
}

function closeEvents() {
  state.events?.close();
  state.events = null;
}

function openEvents() {
  closeEvents();
  resetLive();
  const es = new EventSource(`/api/sessions/${state.session.id}/events`);
  es.onmessage = (m) => handleEvent(JSON.parse(m.data));
  es.onerror = () => {
    // Connection dropped (e.g. phone slept): reload the chat from the server, which reconnects if still running.
    closeEvents();
    if (state.running) setTimeout(() => openSession(state.session.id), 1500);
  };
  state.events = es;
}

function setRunning(r) {
  state.running = r;
  $("#sendBtn").hidden = r;
  $("#stopBtn").hidden = !r;
}

// ---------- sessions ----------

async function refreshSessions() {
  const { sessions } = await api("/api/sessions");
  const list = $("#sessionList");
  list.innerHTML = "";
  for (const s of sessions) {
    const li = el("li", state.session?.id === s.id ? "active" : "");
    li.append(el("span", "", s.title));
    const del = el("button", "", "✕");
    del.title = "Delete chat";
    del.onclick = async (ev) => {
      ev.stopPropagation();
      if (!confirm(`Delete "${s.title}"? Files in the project folder are not touched.`)) return;
      await api(`/api/sessions/${s.id}`, { method: "DELETE" });
      if (state.session?.id === s.id) newChatView();
      refreshSessions();
    };
    li.append(del);
    li.onclick = () => {
      openSession(s.id);
      $("#sidebar").classList.remove("open");
    };
    list.append(li);
  }
}

function ensureModelOption(model) {
  const sel = $("#modelSelect");
  if (![...sel.options].some((o) => o.value === model)) sel.append(new Option(model, model));
}

function applySessionControls(s) {
  ensureModelOption(s.model);
  $("#chatTitle").textContent = `${s.title}  ·  ${s.workspace.replace(state.config.workspaceRoot, "workspace")}`;
  $("#modelSelect").value = s.model;
  $("#effortSelect").value = s.effort;
  $("#autoApprove").checked = s.autoApprove;
  $("#cost").textContent = `$${s.costUsd.toFixed(3)}`;
}

async function openSession(id) {
  closeEvents();
  const s = await api(`/api/sessions/${id}`);
  state.session = s;
  applySessionControls(s);
  renderHistory(s.messages);
  setRunning(s.running);
  if (s.running) openEvents();
  refreshSessions();
}

function newChatView() {
  closeEvents();
  state.session = null;
  messagesEl.innerHTML = "";
  messagesEl.append(emptyState);
  $("#chatTitle").textContent = "New chat";
  $("#modelSelect").value = state.config.model;
  $("#effortSelect").value = state.config.effort;
  $("#autoApprove").checked = false;
  $("#cost").textContent = "$0.000";
  setRunning(false);
  refreshSessions();
}

async function ensureSession() {
  if (state.session) return state.session;
  const s = await api("/api/sessions", {
    method: "POST",
    body: { model: $("#modelSelect").value, effort: $("#effortSelect").value, workspace: $("#folderSelect").value },
  });
  if ($("#autoApprove").checked) await api(`/api/sessions/${s.id}`, { method: "PATCH", body: { autoApprove: true } });
  state.session = s;
  return s;
}

async function send(text) {
  text = text.trim();
  if (!text || state.running) return;
  try {
    const s = await ensureSession();
    emptyState.remove();
    addUser(text);
    scrollToBottom(true);
    $("#input").value = "";
    autoGrow();
    setRunning(true);
    await api(`/api/sessions/${s.id}/messages`, { method: "POST", body: { text } });
    openEvents();
    applySessionControls({ ...s, title: s.messages.length ? s.title : text.slice(0, 60) });
  } catch (err) {
    setRunning(false);
    addNotice("Error: " + err.message, true);
  }
}

async function loadFolders(select) {
  const { folders } = await api("/api/folders");
  const sel = $("#folderSelect");
  sel.innerHTML = "";
  sel.append(new Option("workspace (root)", ""));
  for (const f of folders) sel.append(new Option(f, f));
  if (select) sel.value = select;
}

// ---------- wiring ----------

const emptyState = $("#emptyState");
emptyState.querySelectorAll(".examples button").forEach((b) => (b.onclick = () => send(b.textContent)));

function autoGrow() {
  const t = $("#input");
  t.style.height = "auto";
  t.style.height = Math.min(t.scrollHeight, window.innerHeight * 0.4) + "px";
}
$("#input").addEventListener("input", autoGrow);
$("#input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    send($("#input").value);
  }
});
$("#composer").addEventListener("submit", (e) => {
  e.preventDefault();
  send($("#input").value);
});
$("#stopBtn").onclick = () => state.session && api(`/api/sessions/${state.session.id}/stop`, { method: "POST" });
$("#newChat").onclick = () => {
  newChatView();
  $("#sidebar").classList.remove("open");
};
$("#menuBtn").onclick = () => $("#sidebar").classList.toggle("open");

for (const id of ["#modelSelect", "#effortSelect", "#autoApprove"]) {
  $(id).addEventListener("change", async () => {
    if (!state.session) return;
    const body = { model: $("#modelSelect").value, effort: $("#effortSelect").value, autoApprove: $("#autoApprove").checked };
    state.session = { ...state.session, ...(await api(`/api/sessions/${state.session.id}`, { method: "PATCH", body })) };
  });
}

$("#cloneForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const repo = $("#cloneInput").value.trim();
  if (!repo) return;
  const btn = e.submitter;
  btn.disabled = true;
  btn.textContent = "…";
  try {
    const r = await api("/api/clone", { method: "POST", body: { repo } });
    await loadFolders(r.folder);
    $("#cloneInput").value = "";
    newChatView();
    addNotice(`${r.existed ? "Using existing" : "Cloned"} ${r.folder}. New chats will work in it.`);
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Clone";
  }
});

(async function init() {
  state.config = await api("/api/config");
  // Models are listed after the warning check below adds the default if missing.
  for (const e of state.config.efforts) $("#effortSelect").append(new Option(`effort: ${e}`, e));
  const warn = $("#setupWarning");
  if (!state.config.ollamaRunning && !state.config.hasApiKey) {
    warn.innerHTML = "Ollama is not running. Install it from <b>ollama.com</b>, open it, then run <code>ollama pull mimo-v2.6:9b</code> and refresh.";
    warn.hidden = false;
  } else if (state.config.ollamaRunning && !state.config.models.length) {
    warn.innerHTML = "No local model yet. In a terminal run <code>ollama pull mimo-v2.6:9b</code> (or <code>qwen2.5-coder:7b</code> on 8 GB RAM), then refresh.";
    warn.hidden = false;
  }
  if (!state.config.models.includes(state.config.model)) state.config.models.unshift(state.config.model);
  for (const m of state.config.models) $("#modelSelect").append(new Option(m.startsWith("claude-") ? `${m} (paid)` : `${m} (local, free)`, m));
  await loadFolders();
  newChatView();
})();
