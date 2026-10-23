/* ------------------------------------------------------------------
   CONFIGURACIÓN DEL SITIO
   Después de publicar el script de Google (ver LEEME.md), pega aquí
   la URL de la "aplicación web". Mientras esté vacía, el sitio corre
   en MODO DEMO (guarda las citas solo en tu navegador, sin correos).
------------------------------------------------------------------- */
window.CONFIG = {
  API_URL: "",

  FECHA_ISO: "2026-11-13",
  FECHA_TEXTO: "Viernes 13 de noviembre",
  HORA_INICIO: "12:00",
  HORA_FIN: "16:00",
  DURACION_MIN: 30,
  CAPACIDAD: 4, // lugares por servicio en cada horario
  LUGAR: "Por confirmar",

  // Dominios de correo institucional aceptados
  DOMINIOS: ["tec.mx", "itesm.mx"],

  // Solo modo demo: código para abrir la vista de trabajadoras
  DEMO_CODIGO: "leonora"
};
