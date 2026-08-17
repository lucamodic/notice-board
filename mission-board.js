const ASSETS = "/Graphic Elements";
const STORAGE_KEY = "mission-board-data-v1";
const seals = ["Sin sello", "Crown Seal.png", "Eagle Seal.png", "Flower Seal.png", "Sigil Seal.png"];
const CAMPAIGNS = [
  { id: "zaremis", name: "Zaremis" },
  { id: "liris", name: "Liris" },
  { id: "amstrad", name: "Amstrad" }
];
let state = { schemaVersion: 2, activeCampaign: "liris", campaigns: {} };
let adminCampaign = "liris";
let selectedId = null;
let editingId = null;

const campaignMissions = (id = adminCampaign) => state.campaigns[id]?.missions || [];

const posterSrc = (n, type = "ruined") => type === "blank"
  ? `${ASSETS}/Blanks/Blanks w Shadow/Poster${n}.png`
  : `${ASSETS}/Ruined Posters/Ruined w Shadow/Ruined Poster ${n}.png`;
const sealSrc = name => `${ASSETS}/Wax Seals/${name}`;
const uid = () => `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

async function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      state = JSON.parse(saved);
      normalizeState();
      return;
    } catch {}
  }
  state = await fetch("/data/missions.json").then(r => r.json());
  normalizeState();
  saveState();
}

function normalizeState() {
  const legacyMissions = Array.isArray(state.missions) ? state.missions : [];
  const storedCampaigns = state.campaigns && typeof state.campaigns === "object" ? state.campaigns : {};
  const needsLirisMigration = state.schemaVersion !== 2;
  const zaremisMissions = Array.isArray(storedCampaigns.zaremis?.missions) ? storedCampaigns.zaremis.missions : [];
  const lirisMissions = Array.isArray(storedCampaigns.liris?.missions) ? storedCampaigns.liris.missions : [];
  const initialLirisMissions = needsLirisMigration && lirisMissions.length === 0
    ? (zaremisMissions.length ? zaremisMissions : legacyMissions)
    : lirisMissions;
  state = {
    schemaVersion: 2,
    activeCampaign: needsLirisMigration ? "liris" : (CAMPAIGNS.some(c => c.id === state.activeCampaign) ? state.activeCampaign : "liris"),
    campaigns: Object.fromEntries(CAMPAIGNS.map(c => [c.id, {
      name: c.name,
      missions: (c.id === "liris"
        ? initialLirisMissions
        : c.id === "zaremis" && needsLirisMigration
          ? []
          : Array.isArray(storedCampaigns[c.id]?.missions) ? storedCampaigns[c.id].missions : []).map(normalizeMission)
    }]))
  };
  adminCampaign = state.activeCampaign;
}

function normalizeMission(m) {
  return {
    posterType: "ruined",
    wanted: false,
    characterImage: "",
    characterX: 50, characterY: 49,
    characterScale: 1,
    titleX: 50, titleY: 16,
    bodyX: 50, bodyY: 44,
    rewardX: 50, rewardY: 78,
    sealX: 80, sealY: 86,
    ...m
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function missionMarkup(m, admin = false) {
  m = normalizeMission(m);
  const editable = part => admin ? ` editable-part" data-part="${part}` : "";
  return `
    <article class="mission-card${selectedId === m.id ? " is-selected" : ""}" data-id="${m.id}"
      style="--x:${m.x}%;--y:${m.y}%;--r:${m.rotation}deg;--s:${m.scale || 1};--ink:${m.color};
      --title-x:${m.titleX}%;--title-y:${m.titleY}%;--body-x:${m.bodyX}%;--body-y:${m.bodyY}%;
      --reward-x:${m.rewardX}%;--reward-y:${m.rewardY}%;--seal-x:${m.sealX}%;--seal-y:${m.sealY}%;
      --character-x:${m.characterX}%;--character-y:${m.characterY}%;--character-scale:${m.characterScale}">
      <img class="paper" src="${posterSrc(m.poster, m.posterType)}" alt="" draggable="false">
      ${m.wanted && m.characterImage ? `<img class="wanted-character ${admin ? `editable-part" data-part="character` : ""}" src="${attr(m.characterImage)}" alt="Personaje buscado" draggable="false">` : ""}
      <div class="mission-copy">
        ${m.wanted ? `<span class="wanted-heading">SE BUSCA</span>` : ""}
        <h2 class="${editable("title")}">${formatInlineText(m.title)}</h2>
        <span class="divider">◆</span>
        <p class="mission-body ${editable("body")}">${formatInlineText(m.body)}</p>
        ${m.reward ? `<p class="reward ${editable("reward")}"><small>RECOMPENSA</small>${formatInlineText(m.reward)}</p>` : ""}
      </div>
      ${m.seal && m.seal !== "Sin sello" ? `<img class="seal ${editable("seal")}" src="${sealSrc(m.seal)}" alt="Sello de cera" draggable="false">` : ""}
      ${admin ? `
        <button class="edit-pin" data-edit="${m.id}" aria-label="Editar ${escapeHtml(m.title)}">✎</button>
        <button class="rotate-handle" data-rotate="${m.id}" aria-label="Rotar ${escapeHtml(m.title)}" title="Arrastra para rotar">↻</button>
      ` : ""}
    </article>`;
}

function renderMissions() {
  const campaign = state.campaigns[state.activeCampaign];
  const missions = campaign?.missions || [];
  document.title = "Misiones · Tablón de aventureros";
  app.innerHTML = `
    <main class="missions-page">
      <section class="board" aria-label="Tablón de ${escapeHtml(campaign?.name || "Zaremis")}">
        <div class="board-posts">${missions.map(m => missionMarkup(m)).join("")}</div>
      </section>
      <div class="scrim" aria-hidden="true"></div>
    </main>`;

  document.querySelectorAll(".mission-card").forEach(card => {
    card.addEventListener("click", e => {
      e.stopPropagation();
      selectedId = card.dataset.id;
      document.body.classList.add("reading");
      card.classList.add("is-selected");
    });
  });
  document.addEventListener("click", closeSelected, { once: true });
}

function closeSelected(e) {
  if (!selectedId) {
    document.addEventListener("click", closeSelected, { once: true });
    return;
  }
  const chosen = document.querySelector(".mission-card.is-selected");
  if (chosen && !chosen.contains(e.target)) {
    animateMissionClose(chosen);
    selectedId = null;
  }
  document.addEventListener("click", closeSelected, { once: true });
}

async function animateMissionClose(card) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    card.classList.remove("is-selected");
    document.body.classList.remove("reading");
    return;
  }

  card.classList.add("no-transition");
  card.classList.remove("is-selected");
  const target = card.getBoundingClientRect();
  card.classList.add("is-selected");
  const start = card.getBoundingClientRect();
  card.classList.remove("no-transition");

  const dx = target.left + target.width / 2 - (start.left + start.width / 2);
  const dy = target.top + target.height / 2 - (start.top + start.height / 2);
  const scale = target.width / start.width;
  const mission = campaignMissions(state.activeCampaign).find(item => item.id === card.dataset.id);
  const rotation = mission?.rotation || 0;

  const animation = card.animate([
    { transform: "translate(-50%, -50%) rotate(0deg) scale(1)" },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${rotation}deg) scale(${scale})` }
  ], {
    duration: 480,
    easing: "cubic-bezier(.55, 0, .35, 1)",
    fill: "forwards"
  });

  try { await animation.finished; } catch {}
  card.classList.add("no-transition");
  card.classList.remove("is-selected");
  animation.cancel();
  document.body.classList.remove("reading");
  requestAnimationFrame(() => card.classList.remove("no-transition"));
}

function blankMission() {
  return normalizeMission({ id: uid(), title: "Nueva misión", body: "Describe aquí el encargo para los aventureros.", reward: "", poster: 1, seal: "Crown Seal.png", color: "#30170d", x: 50, y: 50, rotation: 0, scale: 0.9 });
}

function renderAdmin() {
  const missions = campaignMissions();
  const campaign = state.campaigns[adminCampaign];
  document.title = "Administrar · Tablón de misiones";
  if (!editingId && missions[0]) editingId = missions[0].id;
  if (!editingId) editingId = uid();
  const m = missions.find(item => item.id === editingId) || { ...blankMission(), id: editingId };
  app.innerHTML = `
    <main class="admin-page">
      <aside class="editor-panel">
        <div class="brand"><span>✦</span><div><small>GREMIO</small><strong>Maestro del tablón</strong></div></div>
        <div class="campaign-admin">
          <label>Campaña<select id="campaign-select">${CAMPAIGNS.map(c => `<option value="${c.id}" ${c.id === adminCampaign ? "selected" : ""}>${c.name}</option>`).join("")}</select></label>
          <button id="publish-campaign" type="button" ${state.activeCampaign === adminCampaign ? "disabled" : ""}>${state.activeCampaign === adminCampaign ? "Board visible" : "Mostrar este board"}</button>
        </div>
        <div class="panel-heading"><div><p>Editor de encargos · ${escapeHtml(campaign.name)}</p><h1>${missions.some(x => x.id === m.id) ? "Editar misión" : "Nueva misión"}</h1></div><a href="/missions">Ver tablón →</a></div>
        <form id="mission-form" data-mission-id="${m.id}">
          <label>Título<input name="title" maxlength="48" required value="${attr(m.title)}"></label>
          <label>Descripción<textarea name="body" maxlength="280" required>${escapeHtml(m.body)}</textarea><span class="char-count">${m.body.length}/280</span></label>
          <label>Recompensa<input name="reward" maxlength="40" value="${attr(m.reward)}" placeholder="Ej: 300 coronas"></label>
          <div class="field-group wanted-editor">
            <label class="wanted-toggle"><input type="checkbox" name="wanted" ${m.wanted ? "checked" : ""}> Póster tipo «Se busca»</label>
            <div class="wanted-controls" ${m.wanted ? "" : "hidden"}>
              <label class="character-upload">Subir personaje PNG<input id="character-upload" type="file" accept="image/png,.png"></label>
              <button id="remove-character" type="button" ${m.characterImage ? "" : "disabled"}>Quitar imagen</button>
              <small>${m.characterImage ? "PNG cargado · arrástralo sobre el póster para colocarlo" : "Sube un PNG con fondo transparente (máximo 1,5 MB)"}</small>
              <label>Tamaño del personaje <span><input type="range" name="characterScale" min=".25" max="2.5" step=".01" value="${m.characterScale}"><output>${Math.round(m.characterScale * 100)}%</output></span></label>
            </div>
          </div>
          <div class="field-group"><span>Estilo del pergamino</span>
            <div class="paper-library">
              <small>Deteriorados</small>
              <div class="poster-options">${[1,2,3,4,5,6,7,8].map(n => `<label class="poster-choice"><input type="radio" name="paper" value="ruined:${n}" ${m.posterType === "ruined" && m.poster === n ? "checked" : ""}><img src="${posterSrc(n, "ruined")}" alt="Pergamino deteriorado ${n}"></label>`).join("")}</div>
              <small>Limpios</small>
              <div class="poster-options poster-options-clean">${[1,2,3,4,5,6].map(n => `<label class="poster-choice"><input type="radio" name="paper" value="blank:${n}" ${m.posterType === "blank" && m.poster === n ? "checked" : ""}><img src="${posterSrc(n, "blank")}" alt="Pergamino limpio ${n}"></label>`).join("")}</div>
            </div>
          </div>
          <div class="two-cols">
            <label>Sello<select name="seal">${seals.map(s => `<option ${m.seal === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
            <label>Color de texto<span class="color-control"><input type="color" name="color" value="${m.color}"><output>${m.color}</output></span></label>
          </div>
          <input type="hidden" name="x" value="${m.x}">
          <input type="hidden" name="y" value="${m.y}">
          <input type="hidden" name="rotation" value="${m.rotation}">
          ${["titleX","titleY","bodyX","bodyY","rewardX","rewardY","sealX","sealY","characterX","characterY"].map(key => `<input type="hidden" name="${key}" value="${m[key]}">`).join("")}
          <div class="position-fields">
            <p class="mouse-help"><span>↖</span><strong>Edición directa</strong>Arrastra el papel para mover la misión. Arrastra cada texto, sello o personaje para acomodarlo por separado.</p>
            <label>Tamaño <span><input type="range" name="scale" min=".65" max="1.15" step=".01" value="${m.scale}"><output>${Math.round(m.scale*100)}%</output></span></label>
          </div>
          <div class="form-actions"><button type="button" class="danger" id="delete">Eliminar</button><button type="submit" class="primary">Guardar misión</button></div>
        </form>
        <div class="data-actions">
          <button id="new">＋ Nueva misión</button>
          <button id="export">Exportar JSON</button>
          <label class="import">Importar JSON<input id="import" type="file" accept=".json,application/json"></label>
        </div>
      </aside>
      <section class="admin-preview">
        <div class="preview-top"><div><small>VISTA PREVIA · ${escapeHtml(campaign.name.toUpperCase())}</small><strong>${missions.length} ${missions.length === 1 ? "misión" : "misiones"}</strong></div><span>${state.activeCampaign === adminCampaign ? "Este board está visible" : `Actualmente se muestra ${escapeHtml(state.campaigns[state.activeCampaign].name)}`}</span></div>
        <div class="board admin-board"><div class="board-posts">${missions.map(item => missionMarkup(item, true)).join("")}${!missions.some(x => x.id === m.id) ? missionMarkup(m, true) : ""}</div></div>
      </section>
    </main>`;
  bindAdmin(m);
}

function formToMission(form, base) {
  const data = new FormData(form);
  const [posterType, poster] = String(data.get("paper") || "ruined:1").split(":");
  return normalizeMission({
    ...base,
    title: data.get("title"), body: data.get("body"), reward: data.get("reward"),
    wanted: data.has("wanted"),
    poster: +poster, posterType, seal: data.get("seal"), color: data.get("color"),
    x: +data.get("x"), y: +data.get("y"), scale: +data.get("scale"), rotation: +data.get("rotation"),
    titleX: +data.get("titleX"), titleY: +data.get("titleY"),
    bodyX: +data.get("bodyX"), bodyY: +data.get("bodyY"),
    rewardX: +data.get("rewardX"), rewardY: +data.get("rewardY"),
    sealX: +data.get("sealX"), sealY: +data.get("sealY"),
    characterX: +data.get("characterX"), characterY: +data.get("characterY"),
    characterScale: +data.get("characterScale")
  });
}

function bindAdmin(base) {
  const missions = campaignMissions();
  const form = document.querySelector("#mission-form");
  const updatePreview = () => {
    const current = formToMission(form, base);
    const existing = missions.findIndex(m => m.id === current.id);
    if (existing >= 0) missions[existing] = current;
    else base = current;
    const card = document.querySelector(`.mission-card[data-id="${current.id}"]`);
    if (card) card.outerHTML = missionMarkup(current, true);
    form.querySelector(".char-count").textContent = `${current.body.length}/280`;
    form.querySelectorAll('input[type="range"]').forEach(input => {
      input.nextElementSibling.value = `${Math.round(input.value*100)}%`;
    });
    form.querySelector('[name="color"]').nextElementSibling.value = current.color;
    form.querySelector(".wanted-controls").hidden = !current.wanted;
  };
  form.addEventListener("input", updatePreview);
  form.addEventListener("change", updatePreview);
  form.querySelector("#character-upload").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== "image/png" || file.size > 1.5 * 1024 * 1024) {
      e.target.value = "";
      toast("Elegí un PNG de hasta 1,5 MB", true);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      base.characterImage = reader.result;
      base.wanted = true;
      form.elements.wanted.checked = true;
      updatePreview();
      form.querySelector("#remove-character").disabled = false;
      form.querySelector(".wanted-controls small").textContent = "PNG cargado · arrástralo sobre el póster para colocarlo";
      toast("Personaje cargado; ahora podés arrastrarlo sobre el póster");
    };
    reader.readAsDataURL(file);
  });
  form.querySelector("#remove-character").onclick = () => {
    base.characterImage = "";
    updatePreview();
    form.querySelector("#remove-character").disabled = true;
    form.querySelector(".wanted-controls small").textContent = "Sube un PNG con fondo transparente (máximo 1,5 MB)";
  };
  form.addEventListener("submit", e => {
    e.preventDefault();
    const mission = formToMission(form, base);
    const index = missions.findIndex(m => m.id === mission.id);
    if (index >= 0) missions[index] = mission; else missions.push(mission);
    editingId = mission.id; saveState(); toast("Misión guardada en el tablón"); renderAdmin();
  });
  document.querySelector("#new").onclick = () => { editingId = blankMission().id; renderAdmin(); };
  document.querySelector("#delete").onclick = () => {
    if (!missions.some(m => m.id === base.id)) return;
    state.campaigns[adminCampaign].missions = missions.filter(m => m.id !== base.id); editingId = null; saveState(); renderAdmin(); toast("Misión retirada");
  };
  document.querySelector("#campaign-select").onchange = e => {
    adminCampaign = e.target.value; editingId = null; renderAdmin();
  };
  document.querySelector("#publish-campaign").onclick = () => {
    state.activeCampaign = adminCampaign; saveState(); renderAdmin(); toast(`${state.campaigns[adminCampaign].name} ahora se muestra en el tablón`);
  };
  bindBoardGestures(form);
  document.querySelector("#export").onclick = exportJson;
  document.querySelector("#import").onchange = importJson;
}

function bindBoardGestures(form) {
  const posts = document.querySelector(".admin-board .board-posts");
  if (!posts) return;
  let gesture = null;

  posts.addEventListener("click", e => {
    const edit = e.target.closest("[data-edit]");
    if (!edit) return;
    editingId = edit.dataset.edit;
    renderAdmin();
  });
  posts.addEventListener("dragstart", e => e.preventDefault());

  const applyTransform = (mission, card) => {
    card.style.setProperty("--x", `${mission.x}%`);
    card.style.setProperty("--y", `${mission.y}%`);
    card.style.setProperty("--r", `${mission.rotation}deg`);
    if (mission.id === form.dataset.missionId) {
      form.elements.x.value = mission.x;
      form.elements.y.value = mission.y;
      form.elements.rotation.value = mission.rotation;
    }
  };

  const applyPartPosition = (mission, card, part) => {
    card.style.setProperty(`--${part}-x`, `${mission[`${part}X`]}%`);
    card.style.setProperty(`--${part}-y`, `${mission[`${part}Y`]}%`);
    if (mission.id === form.dataset.missionId) {
      form.elements[`${part}X`].value = mission[`${part}X`];
      form.elements[`${part}Y`].value = mission[`${part}Y`];
    }
  };

  posts.addEventListener("pointerdown", e => {
    const card = e.target.closest(".mission-card");
    if (!card || e.target.closest(".edit-pin")) return;
    const mission = campaignMissions().find(item => item.id === card.dataset.id)
      || formToMission(form, { id: card.dataset.id });
    e.preventDefault();
    window.getSelection?.().removeAllRanges();

    const partElement = e.target.closest("[data-part]");
    if (e.target.closest(".rotate-handle")) {
      const rect = card.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const pointerAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
      gesture = {
        type: "rotate",
        card,
        mission,
        centerX,
        centerY,
        offset: mission.rotation - pointerAngle,
        x: mission.x,
        y: mission.y
      };
      card.classList.add("is-rotating");
    } else if (partElement) {
      const part = partElement.dataset.part;
      gesture = {
        type: "part",
        card,
        mission,
        part,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: mission[`${part}X`],
        startY: mission[`${part}Y`]
      };
      partElement.classList.add("is-moving-part");
    } else {
      gesture = { type: "move", card, mission, rect: posts.getBoundingClientRect() };
      card.classList.add("is-dragging");
    }
    posts.setPointerCapture(e.pointerId);
  });

  posts.addEventListener("pointermove", e => {
    if (!gesture) return;
    if (gesture.type === "move") {
      gesture.mission.x = Math.round(Math.max(5, Math.min(95, (e.clientX - gesture.rect.left) / gesture.rect.width * 100)) * 10) / 10;
      gesture.mission.y = Math.round(Math.max(8, Math.min(92, (e.clientY - gesture.rect.top) / gesture.rect.height * 100)) * 10) / 10;
      applyTransform(gesture.mission, gesture.card);
    } else if (gesture.type === "rotate") {
      const angle = Math.atan2(e.clientY - gesture.centerY, e.clientX - gesture.centerX) * 180 / Math.PI;
      let rotation = angle + gesture.offset;
      rotation = ((rotation + 180) % 360 + 360) % 360 - 180;
      gesture.mission.x = gesture.x;
      gesture.mission.y = gesture.y;
      gesture.mission.rotation = Math.round(rotation * 10) / 10;
      applyTransform(gesture.mission, gesture.card);
    } else {
      const angle = (gesture.mission.rotation || 0) * Math.PI / 180;
      const dx = e.clientX - gesture.startClientX;
      const dy = e.clientY - gesture.startClientY;
      const scale = gesture.mission.scale || 1;
      const localDx = (dx * Math.cos(angle) + dy * Math.sin(angle)) / (gesture.card.offsetWidth * scale) * 100;
      const localDy = (-dx * Math.sin(angle) + dy * Math.cos(angle)) / (gesture.card.offsetHeight * scale) * 100;
      gesture.mission[`${gesture.part}X`] = Math.round(Math.max(4, Math.min(96, gesture.startX + localDx)) * 10) / 10;
      gesture.mission[`${gesture.part}Y`] = Math.round(Math.max(4, Math.min(96, gesture.startY + localDy)) * 10) / 10;
      applyPartPosition(gesture.mission, gesture.card, gesture.part);
    }
  });

  const finishGesture = e => {
    if (!gesture) return;
    gesture.card.classList.remove("is-dragging", "is-rotating");
    gesture.card.querySelector(".is-moving-part")?.classList.remove("is-moving-part");
    saveState();
    if (posts.hasPointerCapture?.(e.pointerId)) posts.releasePointerCapture(e.pointerId);
    gesture = null;
  };
  posts.addEventListener("pointerup", finishGesture);
  posts.addEventListener("pointercancel", finishGesture);

  posts.addEventListener("dblclick", e => {
    const handle = e.target.closest(".rotate-handle");
    if (!handle) return;
    const mission = campaignMissions().find(item => item.id === handle.dataset.rotate);
    const card = handle.closest(".mission-card");
    if (!mission || !card) return;
    mission.rotation = 0;
    applyTransform(mission, card);
    saveState();
    toast("Rotación restablecida");
  });
}

function exportJson() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "mission-boards.json" });
  a.click(); URL.revokeObjectURL(url);
}

async function importJson(e) {
  try {
    const parsed = JSON.parse(await e.target.files[0].text());
    if (!Array.isArray(parsed.missions) && (!parsed.campaigns || typeof parsed.campaigns !== "object")) throw new Error();
    state = parsed; normalizeState();
    editingId = null; saveState(); renderAdmin(); toast("JSON importado correctamente");
  } catch { toast("Ese archivo no es un JSON válido", true); }
}

function toast(message, error = false) {
  const el = document.createElement("div"); el.className = `toast${error ? " error" : ""}`; el.textContent = message;
  document.body.append(el); setTimeout(() => el.remove(), 2400);
}
function escapeHtml(value = "") { return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c])); }
function formatInlineText(value = "") {
  return escapeHtml(value).replace(/~([^~\r\n]+)~/g, "<s>$1</s>");
}
function attr(value = "") { return escapeHtml(value); }

await loadState();
if (location.pathname === "/admin") renderAdmin();
else if (location.pathname !== "/missions") history.replaceState({}, "", "/missions"), renderMissions();
else renderMissions();
