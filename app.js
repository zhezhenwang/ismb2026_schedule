const storageKey = "ismbeccb-saved-sessions";

const state = {
  sessions: [],
  saved: new Set(),
  query: "",
  day: "all",
  track: "all",
  view: "all",
};

const trackAliases = [
  ["3DSIG:", "3DSIG: Structural Bioinformatics and Computational Biophysics"],
  ["BOKR:", "BOKR: Bio-Ontologies and Knowledge Representation"],
  ["BOSC:", "BOSC: Bioinformatics Open Source Conference"],
  ["CAMDA:", "CAMDA: Critical Assessment of Massive Data Analysis"],
  ["CSI:", "CSI: Computational Systems Immunology"],
  ["DREAM", "DREAM Challenges"],
  ["Education:", "Education: Computational Biology and Bioinformatics Education and Training"],
  ["EvolCompGen:", "EvolCompGen: Evolution & Comparative Genomics"],
  ["Function:", "Function: Gene and Protein Function Annotation"],
  ["GenCompBio:", "GenCompBio: General Computational Biology"],
  ["HiTSeq:", "HiTSeq: High Throughput Sequencing Algorithms & Applications"],
  ["iRNA:", "iRNA: Integrative RNA Biology"],
  ["International Biomedical", "International Conference on Biological and Biomedical Ontology 2026"],
  ["International Conference on Biological", "International Conference on Biological and Biomedical Ontology 2026"],
  ["MLCSB:", "MLCSB: Machine Learning in Computational and Systems Biology"],
  ["NetBio:", "NetBio: Network Biology"],
  ["Quantum for Life Sciences", "Quantum for Life Sciences"],
  ["RegSys:", "RegSys: Regulatory and Systems Genomics"],
  ["SCS:", "SCS: Student Council Symposium"],
  ["SysMod:", "SysMod: Computational Modeling of Biological Systems"],
  ["Text Mining:", "Text Mining: Text Mining for Healthcare and Biology"],
  ["TransMed:", "TransMed: Translational Medicine Informatics & Applications"],
  ["WEB:", "WEB: Workshop on Education for Bioinformatics"],
];

const roomAliases = new Map([
  ["9-10 Combo", "Room 9-10"],
  ["9-10 Combo Combo", "Room 9-10"],
  ["International Ballroom", "International Ballroom West"],
  ["International Ballroom Center Center", "International Ballroom Center"],
  ["International Ballroom East East", "International Ballroom East"],
  ["International Ballroom West West", "International Ballroom West"],
  ["Jefferson", "Jefferson West"],
  ["Jefferson East East", "Jefferson East"],
  ["Jefferson West West", "Jefferson West"],
  ["Lincoln", "Lincoln West"],
  ["Cabinet East", "Cabinet"],
]);

const elements = {
  list: document.querySelector("#sessionList"),
  status: document.querySelector("#statusLine"),
  search: document.querySelector("#searchInput"),
  day: document.querySelector("#dayFilter"),
  track: document.querySelector("#trackFilter"),
  allTab: document.querySelector("#allTab"),
  mineTab: document.querySelector("#mineTab"),
  savedCount: document.querySelector("#savedCount"),
  share: document.querySelector("#shareButton"),
  dialog: document.querySelector("#sessionDialog"),
  closeDialog: document.querySelector("#closeDialog"),
  dialogTime: document.querySelector("#dialogTime"),
  dialogTitle: document.querySelector("#dialogTitle"),
  dialogMeta: document.querySelector("#dialogMeta"),
  dialogPresenter: document.querySelector("#dialogPresenter"),
  dialogAuthors: document.querySelector("#dialogAuthors"),
  dialogAbstract: document.querySelector("#dialogAbstract"),
};

function loadSaved() {
  const fromUrl = new URLSearchParams(window.location.search).get("s");
  const raw = fromUrl || localStorage.getItem(storageKey) || "";
  state.saved = new Set(raw.split(",").filter(Boolean));
  if (fromUrl) {
    persistSaved();
    state.view = "mine";
  }
}

function persistSaved() {
  localStorage.setItem(storageKey, [...state.saved].join(","));
}

function formatDay(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function sessionTime(session) {
  return `${session.startLabel}-${session.endLabel}`;
}

function canonicalTrack(track) {
  const trimmed = (track || "").trim();
  if (!trimmed) return "";
  const alias = trackAliases.find(([prefix]) => trimmed.startsWith(prefix));
  return alias ? alias[1] : trimmed.replace(/\s+/g, " ");
}

function canonicalRoom(room) {
  const trimmed = (room || "").trim().replace(/\s+/g, " ");
  return roomAliases.get(trimmed) || trimmed;
}

function setOptions(select, options, allLabel) {
  select.replaceChildren();
  select.append(new Option(allLabel, "all"));
  options.forEach((option) => select.append(new Option(option, option)));
}

function setupDayFilter() {
  const days = [...new Set(state.sessions.map((session) => session.dayKey))];
  setOptions(elements.day, days, "All days");
  [...elements.day.options].forEach((option) => {
    if (option.value !== "all") option.textContent = formatDay(option.value);
  });
}

function setupTrackFilter() {
  const availableSessions = state.day === "all"
    ? state.sessions
    : state.sessions.filter((session) => session.dayKey === state.day);
  const tracks = [...new Set(availableSessions.map((session) => session.trackDisplay).filter(Boolean))].sort();
  if (state.track !== "all" && !tracks.includes(state.track)) {
    state.track = "all";
  }
  setOptions(elements.track, tracks, "All tracks");
  elements.track.value = state.track;
}

function filteredSessions() {
  return state.sessions.filter((session) => {
    if (state.view === "mine" && !state.saved.has(session.id)) return false;
    if (state.day !== "all" && session.dayKey !== state.day) return false;
    if (state.track !== "all" && session.trackDisplay !== state.track) return false;
    if (state.query && !session.searchText.includes(state.query)) return false;
    return true;
  });
}

function isBreakSession(session) {
  const breakKeywords = ["☕", "🍽️", "🎤", "🥂", "🎉", "🤝", "🏛️", "🎪", "Coffee Break", "Lunch Break", "Career Fair", "Pre-Conference Break", "Welcome Networking", "President's Reception", "Success Circles", "ISCB Town Hall", "Caffeinate & Connect"];
  return breakKeywords.some((kw) => session.title.includes(kw));
}

function createSessionCard(session) {
  const isBreak = isBreakSession(session);
  const card = document.createElement("article");
  card.className = `session-card${state.saved.has(session.id) ? " saved" : ""}${isBreak ? " break-card" : ""}`;

  const time = document.createElement("div");
  time.className = "time-block";
  time.innerHTML = `<span>${session.startLabel}</span><span>${session.endLabel}</span>`;

  const main = document.createElement("div");
  main.className = "session-main";

  if (isBreak) {
    const title = document.createElement("p");
    title.className = "break-title";
    title.textContent = session.title;
    if (session.roomDisplay && session.roomDisplay !== "All Rooms") {
      const loc = document.createElement("span");
      loc.className = "break-location";
      loc.textContent = session.roomDisplay;
      main.append(title, loc);
    } else {
      main.append(title);
    }
    card.append(time, main);
    return card;
  }

  const title = document.createElement("button");
  title.className = "session-title";
  title.type = "button";
  title.textContent = session.title;
  title.addEventListener("click", () => showSession(session));

  const meta = document.createElement("p");
  meta.className = "meta";
  meta.textContent = [session.roomDisplay, session.format].filter(Boolean).join(" | ");

  const presenter = document.createElement("p");
  presenter.className = "presenter";
  presenter.textContent = `Presenter: ${session.presenter}`;

  const authors = document.createElement("p");
  authors.className = "authors";
  authors.textContent = session.authors;

  const track = document.createElement("span");
  track.className = "track";
  track.textContent = session.trackDisplay;

  main.append(title, meta);
  if (session.presenter) main.append(presenter);
  if (session.authors) main.append(authors);
  if (session.trackDisplay) main.append(track);

  const save = document.createElement("button");
  save.className = "save-button";
  save.type = "button";
  save.setAttribute("aria-label", `Save ${session.title}`);
  save.setAttribute("aria-pressed", String(state.saved.has(session.id)));
  save.title = "Save session";
  save.textContent = state.saved.has(session.id) ? "*" : "+";
  save.addEventListener("click", () => toggleSaved(session.id));

  card.append(time, main, save);
  return card;
}

function render() {
  const sessions = filteredSessions();
  elements.list.replaceChildren();
  elements.savedCount.textContent = state.saved.size;
  elements.allTab.classList.toggle("active", state.view === "all");
  elements.mineTab.classList.toggle("active", state.view === "mine");

  if (!sessions.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = state.view === "mine" ? "No saved sessions match these filters." : "No sessions match these filters.";
    elements.list.append(empty);
    elements.status.textContent = "0 sessions";
    return;
  }

  let currentDay = "";
  sessions.forEach((session) => {
    if (session.dayKey !== currentDay) {
      currentDay = session.dayKey;
      const heading = document.createElement("div");
      heading.className = "day-heading";
      heading.textContent = formatDay(currentDay);
      elements.list.append(heading);
    }
    elements.list.append(createSessionCard(session));
  });

  elements.status.textContent = `${sessions.length} session${sessions.length === 1 ? "" : "s"}`;
}

function toggleSaved(id) {
  if (state.saved.has(id)) {
    state.saved.delete(id);
  } else {
    state.saved.add(id);
  }
  persistSaved();
  render();
}

function showSession(session) {
  elements.dialogTime.textContent = `${formatDay(session.date)} | ${sessionTime(session)} | ${session.roomDisplay}`;
  elements.dialogTitle.textContent = session.title;
  elements.dialogMeta.textContent = [session.trackDisplay, session.format].filter(Boolean).join(" | ");
  elements.dialogPresenter.textContent = session.presenter ? `Presenter: ${session.presenter}` : "";
  elements.dialogAuthors.textContent = session.authors || "";
  elements.dialogAbstract.textContent = session.abstract || "No abstract provided.";
  elements.dialog.showModal();
}

async function shareSchedule() {
  const ids = [...state.saved];
  const url = new URL(window.location.href);
  if (ids.length) {
    url.searchParams.set("s", ids.join(","));
  } else {
    url.searchParams.delete("s");
  }
  const text = ids.length ? `My ISMB 2026 schedule (${ids.length} sessions)` : "ISMB 2026 schedule";
  if (navigator.share) {
    await navigator.share({ title: "ISMB 2026", text, url: url.toString() });
  } else {
    await navigator.clipboard.writeText(url.toString());
    elements.status.textContent = "Share link copied.";
  }
}

function bindEvents() {
  elements.search.addEventListener("input", () => {
    state.query = elements.search.value.trim().toLowerCase();
    render();
  });
  elements.day.addEventListener("change", () => {
    state.day = elements.day.value;
    setupTrackFilter();
    render();
  });
  elements.track.addEventListener("change", () => {
    state.track = elements.track.value;
    render();
  });
  elements.allTab.addEventListener("click", () => {
    state.view = "all";
    render();
  });
  elements.mineTab.addEventListener("click", () => {
    state.view = "mine";
    render();
  });
  elements.share.addEventListener("click", () => {
    shareSchedule().catch(() => {
      elements.status.textContent = "Could not share this browser session.";
    });
  });
  elements.closeDialog.addEventListener("click", () => elements.dialog.close());
}

async function init() {
  loadSaved();
  bindEvents();
  const payload = window.SCHEDULE_DATA || await fetch("data/schedule.json").then((response) => response.json());
  state.sessions = payload.sessions.map((session) => {
    const trackDisplay = canonicalTrack(session.track);
    const roomDisplay = canonicalRoom(session.room);
    return {
      ...session,
      trackDisplay,
      roomDisplay,
      searchText: [
        session.date,
        session.start,
        session.end,
        session.title,
        session.presenter,
        session.authors,
        session.room,
        roomDisplay,
        session.abstract,
      ].join(" ").toLowerCase(),
    };
  });
  setupDayFilter();
  setupTrackFilter();
  render();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

init().catch((error) => {
  elements.status.textContent = `Could not load schedule: ${error.message}`;
});
