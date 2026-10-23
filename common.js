/* Utilidades compartidas: horarios, servicios y comunicación con el servidor */
(function () {
  const C = window.CONFIG;

  const SERVICIOS = [
    { id: "peinado", nombre: "Peinado" },
    { id: "unas", nombre: "Aplicación de gelish liso" }
  ];

  function pad(n) { return String(n).padStart(2, "0"); }
  function toMin(hhmm) { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; }
  function fromMin(m) { return pad(Math.floor(m / 60)) + ":" + pad(m % 60); }

  // 12:00, 12:30 … 15:30  (cada bloque dura 30 min y termina a las 16:00)
  const HORARIOS = [];
  for (let m = toMin(C.HORA_INICIO); m + C.DURACION_MIN <= toMin(C.HORA_FIN); m += C.DURACION_MIN) {
    HORARIOS.push({
      id: fromMin(m),
      label: fromMin(m) + " – " + fromMin(m + C.DURACION_MIN)
    });
  }

  const DEMO = !C.API_URL;
  const LS_KEY = "dgg_leonora_demo_citas_v1";
  const demoRead = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch (e) { return []; } };
  const demoWrite = (a) => { try { localStorage.setItem(LS_KEY, JSON.stringify(a)); } catch (e) {} };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function takenFrom(list) {
    const t = {};
    HORARIOS.forEach((h) => (t[h.id] = { peinado: 0, unas: 0 }));
    list.forEach((c) => { if (t[c.hora] && t[c.hora][c.servicio] !== undefined) t[c.hora][c.servicio]++; });
    return t;
  }

  async function call(params, body) {
    const url = C.API_URL + (params ? "?" + new URLSearchParams(params).toString() : "");
    const opts = body ? { method: "POST", body: JSON.stringify(body) } : {}; // text/plain: evita preflight CORS
    const res = await fetch(url, opts);
    return res.json();
  }

  const API = {
    demo: DEMO,

    async disponibilidad() {
      if (DEMO) { await wait(250); return { ok: true, taken: takenFrom(demoRead()) }; }
      const r = await call({ action: "availability" });
      if (!r.ok) throw new Error(r.error || "error");
      return r;
    },

    async reservar(d) {
      if (DEMO) {
        await wait(600);
        const list = demoRead();
        const mail = d.correo.toLowerCase();
        if (list.some((c) => c.correo === mail && c.servicio === d.servicio)) return { ok: false, error: "duplicate_service" };
        if (list.some((c) => c.correo === mail && c.hora === d.hora)) return { ok: false, error: "duplicate_slot" };
        if (list.filter((c) => c.hora === d.hora && c.servicio === d.servicio).length >= C.CAPACIDAD) return { ok: false, error: "full" };
        list.push({ ...d, correo: mail, registro: new Date().toISOString() });
        demoWrite(list);
        return { ok: true, emailSent: false, demo: true };
      }
      return call(null, { action: "book", ...d });
    },

    async trabajadoras(code) {
      if (DEMO) {
        await wait(250);
        if (code !== C.DEMO_CODIGO) return { ok: false, error: "bad_code" };
        return { ok: true, citas: demoRead().map(({ nombre, hora, servicio }) => ({ nombre, hora, servicio })) };
      }
      return call({ action: "staff", code });
    }
  };

  window.APP = { SERVICIOS, HORARIOS, API, servicioNombre: (id) => (SERVICIOS.find((s) => s.id === id) || {}).nombre || id };
})();
