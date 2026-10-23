/**
 * De Grupo en Grupo 2026 × Leonora Studio — servidor de reservaciones
 *
 * Se pega en un Google Sheets (Extensiones > Apps Script) y se publica como
 * "Aplicación web". Hace cuatro cosas:
 *   1. Guarda cada cita en la hoja "Reservaciones" (esa hoja es tu Excel).
 *   2. Controla los cupos (4 por servicio en cada horario).
 *   3. Entrega a la página de trabajadoras SOLO nombre, horario y servicio.
 *   4. Envía el correo de confirmación al correo institucional.
 */

var CONFIG = {
  SHEET_NAME: 'Reservaciones',
  TZ: 'America/Mexico_City',

  // Código para abrir la página de trabajadoras (cámbialo)
  STAFF_CODE: 'leonora2026',

  CAPACITY: 4,
  FECHA_TEXTO: 'Viernes 13 de noviembre de 2026',
  START: '12:00',
  END: '16:00',
  DURATION_MIN: 30,
  LUGAR: 'Por confirmar',

  ALLOWED_DOMAINS: ['tec.mx', 'itesm.mx'],

  SENDER_NAME: 'De Grupo en Grupo × Leonora Studio',
  REPLY_TO: '',        // opcional: correo al que responderán las personas
  EMAIL_LOGO_URL: ''   // opcional: URL pública de un logo (https://...) para el correo
};

var SERVICES = {
  peinado: 'Peinado',
  unas: 'Aplicación de gelish liso'
};

var HEADERS = [
  'Fecha de registro', 'Fecha de la cita', 'Horario', 'Servicio', 'Nombre completo',
  'Correo institucional', 'Puesto', 'Grupo estudiantil', 'Tipo (CSE / CGIV / FETEC)', 'Correo enviado'
];

/* ---------- horarios ---------- */
function toMin_(s) { var p = s.split(':'); return Number(p[0]) * 60 + Number(p[1]); }
function pad_(n) { return (n < 10 ? '0' : '') + n; }
function fromMin_(m) { return pad_(Math.floor(m / 60)) + ':' + pad_(m % 60); }
function slots_() {
  var out = [];
  for (var m = toMin_(CONFIG.START); m + CONFIG.DURATION_MIN <= toMin_(CONFIG.END); m += CONFIG.DURATION_MIN) {
    out.push({ id: fromMin_(m), label: fromMin_(m) + ' – ' + fromMin_(m + CONFIG.DURATION_MIN) });
  }
  return out;
}
function slotLabel_(id) {
  var s = slots_();
  for (var i = 0; i < s.length; i++) if (s[i].id === id) return s[i].label;
  return null;
}

/* ---------- hoja ---------- */
function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.SHEET_NAME);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
      .setFontWeight('bold').setBackground('#1e3a2f').setFontColor('#fbf5ea');
    sh.setFrozenRows(1);
    sh.getRange('B:C').setNumberFormat('@');   // texto, para que "12:00" no se convierta en hora
    sh.setColumnWidths(1, HEADERS.length, 170);
    sh.setColumnWidth(5, 240); sh.setColumnWidth(6, 260); sh.setColumnWidth(8, 260);
  }
  return sh;
}
function rows_() {
  var sh = sheet_();
  var n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, HEADERS.length).getValues() : [];
}
function serviceKey_(label) {
  for (var k in SERVICES) if (SERVICES[k] === label) return k;
  return null;
}
function takenMap_() {
  var t = {};
  slots_().forEach(function (s) { t[s.id] = { peinado: 0, unas: 0 }; });
  rows_().forEach(function (r) {
    var hora = String(r[2]).split(' ')[0];
    var k = serviceKey_(r[3]);
    if (t[hora] && k) t[hora][k]++;
  });
  return t;
}

/* ---------- utilidades ---------- */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function clean_(v, max) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().substring(0, max); }
function safeCell_(v) { return /^[=+\-@]/.test(v) ? "'" + v : v; }   // evita fórmulas inyectadas
function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ---------- API ---------- */
function doGet(e) {
  var a = (e && e.parameter && e.parameter.action) || '';
  try {
    if (a === 'availability') return json_({ ok: true, taken: takenMap_() });

    if (a === 'staff') {
      if (!e.parameter.code || e.parameter.code !== CONFIG.STAFF_CODE) return json_({ ok: false, error: 'bad_code' });
      // Solo nombre, horario y servicio: nada de correos ni grupos.
      var citas = rows_().map(function (r) {
        return { nombre: String(r[4]), hora: String(r[2]).split(' ')[0], servicio: serviceKey_(r[3]) };
      }).filter(function (c) { return c.servicio; });
      return json_({ ok: true, citas: citas });
    }
    return json_({ ok: true, service: 'reservaciones' });
  } catch (err) {
    return json_({ ok: false, error: 'server' });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ ok: false, error: 'busy' });
  }
  var result;
  try {
    var d = JSON.parse(e.postData.contents);
    if (d.action !== 'book') { result = { ok: false, error: 'invalid' }; }
    else if (d.website) { result = { ok: true, emailSent: false }; }   // trampa para bots
    else result = book_(d);
  } catch (err) {
    result = { ok: false, error: 'server' };
  } finally {
    lock.releaseLock();
  }
  if (result && result._mail) {            // el correo se manda fuera del bloqueo
    var m = result._mail; delete result._mail;
    result.emailSent = sendConfirmation_(m);
    if (result._row) { sheet_().getRange(result._row, HEADERS.length).setValue(result.emailSent ? 'Sí' : 'No'); }
  }
  if (result) delete result._row;
  return json_(result);
}

function book_(d) {
  var servicio = clean_(d.servicio, 20);
  var hora = clean_(d.hora, 5);
  var nombre = clean_(d.nombre, 120);
  var correo = clean_(d.correo, 120).toLowerCase();
  var puesto = clean_(d.puesto, 80);
  var grupo = clean_(d.grupo, 120);
  var tipo = clean_(d.tipo, 10);

  var label = slotLabel_(hora);
  var mail = /^[a-z0-9][a-z0-9._%+\-]*@([a-z0-9.\-]+\.[a-z]{2,})$/.exec(correo);
  if (!SERVICES[servicio] || !label || nombre.split(' ').length < 2 || !puesto || !grupo || !mail) return { ok: false, error: 'invalid' };
  if (CONFIG.ALLOWED_DOMAINS.indexOf(mail[1]) === -1) return { ok: false, error: 'bad_domain' };
  if (['CSE', 'CGIV', 'FETEC'].indexOf(tipo) === -1) return { ok: false, error: 'invalid' };

  var existing = rows_();
  var count = 0;
  for (var i = 0; i < existing.length; i++) {
    var r = existing[i];
    var rHora = String(r[2]).split(' ')[0];
    if (String(r[5]).toLowerCase() === correo) {
      if (r[3] === SERVICES[servicio]) return { ok: false, error: 'duplicate_service' };
      if (rHora === hora) return { ok: false, error: 'duplicate_slot' };
    }
    if (rHora === hora && r[3] === SERVICES[servicio]) count++;
  }
  if (count >= CONFIG.CAPACITY) return { ok: false, error: 'full' };

  var sh = sheet_();
  var now = Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm:ss');
  sh.appendRow([now, CONFIG.FECHA_TEXTO, label + ' h', SERVICES[servicio], safeCell_(nombre), correo,
                safeCell_(puesto), safeCell_(grupo), tipo, '']);
  var row = sh.getLastRow();
  sh.getRange(row, 2, 1, 2).setNumberFormat('@');
  SpreadsheetApp.flush();

  return { ok: true, _row: row, _mail: { nombre: nombre, correo: correo, servicio: SERVICES[servicio], horario: label } };
}

/* ---------- correo de confirmación ---------- */
function sendConfirmation_(m) {
  try {
    var logo = CONFIG.EMAIL_LOGO_URL
      ? '<img src="' + esc_(CONFIG.EMAIL_LOGO_URL) + '" alt="" style="height:54px;margin-bottom:18px">' : '';
    var row = function (k, v) {
      return '<tr><td style="padding:10px 0;border-bottom:1px solid #e6d9c4;font:500 11px Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#6b2335;width:110px">' + k +
        '</td><td style="padding:10px 0;border-bottom:1px solid #e6d9c4;font:16px Georgia,serif;color:#2a211e">' + v + '</td></tr>';
    };
    var html =
      '<div style="background:#f3e7d3;padding:32px 12px">' +
      '<div style="max-width:560px;margin:0 auto;background:#fbf5ea;border:1px solid #d6bd8c;border-radius:14px;padding:38px 34px;text-align:center">' +
      logo +
      '<div style="font:500 11px Arial,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#6b2335">De Grupo en Grupo 2026 × Leonora Studio</div>' +
      '<h1 style="font:italic 400 32px Georgia,serif;color:#1e3a2f;margin:14px 0 8px">Tu cita está confirmada</h1>' +
      '<p style="font:16px/1.6 Arial,sans-serif;color:#6b5d57;margin:0 0 22px">Hola, ' + esc_(m.nombre.split(' ')[0]) + '. Aquí están los detalles de tu reservación.</p>' +
      '<table style="width:100%;border-collapse:collapse;text-align:left">' +
      row('Nombre', esc_(m.nombre)) +
      row('Servicio', esc_(m.servicio)) +
      row('Horario', esc_(CONFIG.FECHA_TEXTO) + '<br>' + esc_(m.horario) + ' h') +
      row('Lugar', esc_(CONFIG.LUGAR)) +
      '</table>' +
      '<p style="font:14px/1.6 Arial,sans-serif;color:#6b5d57;margin:24px 0 0">Te avisaremos cuando el lugar esté confirmado. Recuerda que el servicio es exclusivamente para miembros de grupos estudiantiles.</p>' +
      '</div></div>';

    var text = 'Tu cita está confirmada\n\nNombre: ' + m.nombre + '\nServicio: ' + m.servicio +
      '\nHorario: ' + CONFIG.FECHA_TEXTO + ', ' + m.horario + ' h\nLugar: ' + CONFIG.LUGAR +
      '\n\nEl servicio es exclusivamente para miembros de grupos estudiantiles.';

    var opts = { name: CONFIG.SENDER_NAME, htmlBody: html };
    if (CONFIG.REPLY_TO) opts.replyTo = CONFIG.REPLY_TO;
    MailApp.sendEmail(m.correo, 'Confirmación de tu cita · De Grupo en Grupo × Leonora Studio', text, opts);
    return true;
  } catch (err) {
    return false;
  }
}

/** Opcional: ejecútala una vez para autorizar permisos y crear la hoja. */
function configurar() {
  sheet_();
  MailApp.getRemainingDailyQuota();
}
