/* Vista de trabajadoras: solo nombre, horario y servicio */
(function () {
  const { HORARIOS, API, servicioNombre } = window.APP;
  const $ = (s) => document.querySelector(s);
  let code = "", filter = "todos", citas = [], timer = null;
  try { code = sessionStorage.getItem("dgg_staff_code") || ""; } catch (e) {}

  function render() {
    const tl = $("#timeline"); tl.innerHTML = "";
    HORARIOS.forEach((h) => {
      const rows = citas.filter((c) => c.hora === h.id && (filter === "todos" || c.servicio === filter))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      const block = document.createElement("div"); block.className = "block";
      const when = document.createElement("div"); when.className = "when";
      when.textContent = h.label;
      const sm = document.createElement("small"); sm.textContent = rows.length + (rows.length === 1 ? " cita" : " citas");
      when.appendChild(sm); block.appendChild(when);
      if (!rows.length) {
        const e = document.createElement("div"); e.className = "empty"; e.textContent = "Sin citas en este horario."; block.appendChild(e);
      } else {
        const ul = document.createElement("ul");
        rows.forEach((c) => {
          const li = document.createElement("li");
          const n = document.createElement("span"); n.textContent = c.nombre;
          const p = document.createElement("span"); p.className = "pill " + c.servicio; p.textContent = servicioNombre(c.servicio);
          li.append(n, p); ul.appendChild(li);
        });
        block.appendChild(ul);
      }
      tl.appendChild(block);
    });
    $("#updated").textContent = "Actualizado a las " + new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) +
      " · " + citas.length + (citas.length === 1 ? " cita en total" : " citas en total");
  }

  async function load(showErr) {
    try {
      const r = await API.trabajadoras(code);
      if (!r.ok) {
        if (showErr) { $("#codeErr").textContent = r.error === "bad_code" ? "Código incorrecto." : "No se pudo cargar la agenda."; $("#codeField").classList.add("invalid"); }
        $("#gate").hidden = false; $("#board").hidden = true; clearInterval(timer);
        return false;
      }
      citas = r.citas || [];
      $("#gate").hidden = true; $("#board").hidden = false; render();
      return true;
    } catch (e) {
      if (showErr) { $("#codeErr").textContent = "Sin conexión con el servidor."; $("#codeField").classList.add("invalid"); }
      return false;
    }
  }

  $("#gateForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    code = $("#code").value.trim();
    if (await load(true)) {
      try { sessionStorage.setItem("dgg_staff_code", code); } catch (e) {}
      timer = setInterval(() => load(false), 30000);
    }
  });
  document.querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => {
    filter = b.dataset.f;
    document.querySelectorAll(".chip").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    render();
  }));

  if (code) load(false).then((ok) => { if (ok) timer = setInterval(() => load(false), 30000); });
})();
