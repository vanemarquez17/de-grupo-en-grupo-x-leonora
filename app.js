/* Página pública: selección de servicio, horario y registro de la cita */
(function () {
  const { SERVICIOS, HORARIOS, API, servicioNombre } = window.APP;
  const C = window.CONFIG;
  const GRUPOS = window.GRUPOS || [];
  const $ = (s, r = document) => r.querySelector(s);

  const state = { servicio: null, hora: null, grupo: null, taken: null };
  const els = {
    form: $("#bookForm"), svcGrid: $("#svcGrid"), slotGrid: $("#slotGrid"), slotHint: $("#slotHint"),
    summary: $("#summary"), msg: $("#formMsg"), submit: $("#submitBtn"), check: $("#checkWrap"),
    acepto: $("#acepto"), success: $("#success"), card: $("#formCard"),
    combo: $("#combo"), comboInput: $("#grupo"), comboList: $("#comboList")
  };
  if (API.demo) $("#demoNote").hidden = false;

  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const horarioLabel = (id) => (HORARIOS.find((h) => h.id === id) || {}).label || id;

  /* ---------- servicios ---------- */
  SERVICIOS.forEach((s) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "svc"; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", "false");
    b.dataset.id = s.id;
    b.innerHTML = "<strong></strong><span>30 minutos</span>";
    b.querySelector("strong").textContent = s.nombre;
    b.addEventListener("click", () => { state.servicio = s.id; renderServices(); renderSlots(); updateSummary(); });
    els.svcGrid.appendChild(b);
  });
  function renderServices() {
    els.svcGrid.querySelectorAll(".svc").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.id === state.servicio)));
  }

  /* ---------- horarios ---------- */
  function remaining(hora) {
    if (!state.taken || !state.servicio) return null;
    const t = state.taken[hora];
    return t ? C.CAPACIDAD - (t[state.servicio] || 0) : null;
  }
  function renderSlots() {
    els.slotGrid.innerHTML = "";
    if (state.hora && state.servicio && remaining(state.hora) !== null && remaining(state.hora) <= 0) state.hora = null;
    els.slotHint.textContent = state.servicio
      ? "Viernes 13 de noviembre · " + servicioNombre(state.servicio) + " · lugares disponibles por horario."
      : "Viernes 13 de noviembre · primero elige un servicio.";
    HORARIOS.forEach((h) => {
      const left = remaining(h.id);
      const b = document.createElement("button");
      b.type = "button"; b.className = "slot"; b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(state.hora === h.id));
      b.innerHTML = "<b></b><small></small>";
      b.querySelector("b").textContent = h.label;
      const small = b.querySelector("small");
      if (!state.servicio) { b.disabled = true; small.textContent = "—"; }
      else if (left === null) { small.textContent = "Cargando…"; b.disabled = true; }
      else if (left <= 0) { b.disabled = true; b.classList.add("full"); small.textContent = "Agotado"; }
      else if (left === 1) { b.classList.add("last"); small.textContent = "Último lugar"; }
      else small.textContent = left + " lugares";
      b.addEventListener("click", () => { state.hora = h.id; renderSlots(); updateSummary(); });
      els.slotGrid.appendChild(b);
    });
  }
  async function refreshAvailability() {
    try { const r = await API.disponibilidad(); state.taken = r.taken; }
    catch (e) { state.taken = {}; HORARIOS.forEach((h) => (state.taken[h.id] = { peinado: 0, unas: 0 })); }
    renderSlots(); updateSummary();
  }

  function updateSummary() {
    if (state.servicio && state.hora) els.summary.textContent = servicioNombre(state.servicio) + " · viernes 13 de noviembre · " + horarioLabel(state.hora) + " h";
    else els.summary.textContent = "";
  }

  /* ---------- lista desplegable de grupos ---------- */
  const SECCIONES = [
    { tag: "CSE", titulo: "Sociedades" },
    { tag: "CGIV", titulo: "Grupos estudiantiles" },
    { tag: "FETEC", titulo: "Comités y órganos" }
  ];
  let activeIdx = -1, visible = [];
  const fmt = (g) => g.name + "  ·  " + g.tag;

  function renderCombo(query) {
    const q = norm(query || "");
    els.comboList.innerHTML = ""; visible = [];
    SECCIONES.forEach((sec) => {
      const items = GRUPOS.filter((g) => g.tag === sec.tag && (!q || norm(g.name).includes(q)));
      if (!items.length) return;
      const h = document.createElement("div"); h.className = "combo-group"; h.textContent = sec.titulo; h.setAttribute("role", "presentation");
      els.comboList.appendChild(h);
      items.forEach((g) => {
        const o = document.createElement("div");
        o.className = "combo-opt"; o.setAttribute("role", "option");
        o.setAttribute("aria-selected", String(state.grupo === g));
        o.innerHTML = "<span></span><span class='badge'></span>";
        o.firstChild.textContent = g.name; o.lastChild.textContent = g.tag;
        o.addEventListener("mousedown", (e) => { e.preventDefault(); pick(g); });
        o.addEventListener("mousemove", () => setActive(visible.indexOf(o)));
        els.comboList.appendChild(o); visible.push(o); o._g = g;
      });
    });
    if (!visible.length) { const e = document.createElement("div"); e.className = "combo-empty"; e.textContent = "No encontramos ese grupo."; els.comboList.appendChild(e); }
    activeIdx = -1;
  }
  function setActive(i) {
    visible.forEach((o, k) => o.classList.toggle("active", k === i));
    activeIdx = i;
    if (visible[i]) visible[i].scrollIntoView({ block: "nearest" });
  }
  function openCombo() { els.combo.classList.add("open"); els.comboInput.setAttribute("aria-expanded", "true"); }
  function closeCombo() { els.combo.classList.remove("open"); els.comboInput.setAttribute("aria-expanded", "false"); }
  function pick(g) {
    state.grupo = g; els.comboInput.value = fmt(g); closeCombo(); clearErr("grupo");
  }
  els.comboInput.addEventListener("focus", () => { renderCombo(state.grupo ? "" : els.comboInput.value); openCombo(); if (state.grupo) els.comboInput.select(); });
  els.comboInput.addEventListener("click", () => { renderCombo(state.grupo ? "" : els.comboInput.value); openCombo(); });
  els.comboInput.addEventListener("input", () => { state.grupo = null; renderCombo(els.comboInput.value); openCombo(); });
  els.comboInput.addEventListener("blur", () => {
    closeCombo();
    if (!state.grupo) {
      const exact = GRUPOS.find((g) => norm(g.name) === norm(els.comboInput.value));
      if (exact) pick(exact); else els.comboInput.value = "";
    }
  });
  els.comboInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); openCombo(); setActive(Math.min(visible.length - 1, activeIdx + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(Math.max(0, activeIdx - 1)); }
    else if (e.key === "Enter" && els.combo.classList.contains("open") && visible[activeIdx]) { e.preventDefault(); pick(visible[activeIdx]._g); }
    else if (e.key === "Escape") closeCombo();
  });

  /* ---------- validación ---------- */
  const fieldEl = (k) => document.querySelector('[data-f="' + k + '"]');
  const setErr = (k, on) => fieldEl(k).classList.toggle("invalid", on);
  const clearErr = (k) => setErr(k, false);
  ["nombre", "correo", "puesto"].forEach((k) => $("#" + k).addEventListener("input", () => clearErr(k)));
  els.acepto.addEventListener("change", () => els.check.classList.remove("invalid"));

  function showMsg(t) { els.msg.textContent = t; els.msg.classList.toggle("show", !!t); }
  function validEmail(v) {
    const m = /^[a-z0-9][a-z0-9._%+\-]*@([a-z0-9.\-]+\.[a-z]{2,})$/i.exec(v);
    return !!m && C.DOMINIOS.includes(m[1].toLowerCase());
  }

  function validate() {
    let ok = true; showMsg("");
    const nombre = $("#nombre").value.trim().replace(/\s+/g, " ");
    const correo = $("#correo").value.trim();
    const puesto = $("#puesto").value.trim();
    const bad = (k, c) => { setErr(k, c); if (c) ok = false; };
    bad("nombre", nombre.split(" ").length < 2 || nombre.length < 5);
    bad("correo", !validEmail(correo));
    bad("puesto", puesto.length < 2);
    bad("grupo", !state.grupo);
    if (!state.servicio) { showMsg("Elige un servicio."); ok = false; }
    else if (!state.hora) { showMsg("Elige un horario disponible."); ok = false; }
    else if (!els.acepto.checked) { els.check.classList.add("invalid"); showMsg("Para continuar confirma que perteneces a un grupo estudiantil."); ok = false; }
    else if (!ok) showMsg("Revisa los campos marcados.");
    if (!ok) {
      const first = els.form.querySelector(".invalid input") || (!state.servicio ? els.svcGrid : !state.hora ? els.slotGrid : els.check);
      first.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    return ok ? { nombre, correo, puesto } : null;
  }

  const ERRORES = {
    full: "Ese horario se acaba de llenar. Elige otro, por favor.",
    duplicate_service: "Ya tienes una cita agendada para este servicio con ese correo.",
    duplicate_slot: "Ya tienes otra cita en ese mismo horario. Elige un horario distinto.",
    bad_domain: "Usa tu correo institucional (@tec.mx).",
    invalid: "Revisa tus datos e inténtalo de nuevo."
  };

  els.form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const d = validate(); if (!d) return;
    els.submit.disabled = true; els.submit.textContent = "Reservando…";
    try {
      const r = await API.reservar({
        servicio: state.servicio, hora: state.hora, ...d,
        grupo: state.grupo.name, tipo: state.grupo.tag, website: $("#website").value
      });
      if (!r.ok) {
        showMsg(ERRORES[r.error] || "No pudimos registrar tu cita. Inténtalo de nuevo en un momento.");
        await refreshAvailability();
      } else {
        showSuccess(d, r);
        refreshAvailability();
      }
    } catch (e) {
      showMsg("No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.");
    } finally {
      els.submit.disabled = false; els.submit.textContent = "Confirmar mi cita";
    }
  });

  function showSuccess(d, r) {
    $("#sNombre").textContent = d.nombre;
    $("#sServicio").textContent = servicioNombre(state.servicio);
    $("#sHorario").textContent = "Viernes 13 de noviembre · " + horarioLabel(state.hora) + " h";
    $("#successMail").textContent = r.demo
      ? "Modo demostración: no se envió correo."
      : r.emailSent === false
        ? "Tu cita quedó registrada, pero no pudimos enviar el correo de confirmación. Guarda esta pantalla."
        : "Te enviamos la confirmación a " + d.correo + ".";
    els.form.hidden = true; els.success.hidden = false;
    els.card.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  $("#againBtn").addEventListener("click", () => {
    els.form.reset(); state.servicio = null; state.hora = null; state.grupo = null;
    renderServices(); renderSlots(); updateSummary(); showMsg("");
    els.success.hidden = true; els.form.hidden = false;
  });

  /* ---------- inicio ---------- */
  renderServices(); renderSlots(); renderCombo("");
  refreshAvailability();
  setInterval(refreshAvailability, 45000);
})();
