// Vocabulario del dictado por voz (fuente única): lo usan el normalizador
// (lib/voice/normalize.ts) y la Guía de dictado. Un test verifica que cada
// ejemplo se interprete sin advertencias.

/** Números dichos en palabras. */
export const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veinticinco: 25,
  treinta: 30,
  cuarenta: 40,
  "cuarenta y cinco": 45,
  cincuenta: 50,
};

export const MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

/** Palabras que separan una tarea de la siguiente. */
export const ITEM_SEPARATORS = [
  "y luego",
  "luego",
  "y después",
  "después",
  "y también",
  "también",
  "además",
  "otra tarea",
  "siguiente tarea",
  "primero",
  "segundo",
  "tercero",
  // "cuarto" no: se confunde con "hora y cuarto".
  "por último",
  "finalmente",
];

/** Muletillas que se descartan. */
export const FILLERS = ["eh", "ehh", "em", "mmm", "este", "bueno", "o sea", "pues"];

export type VoiceExample = { spoken: string; result: string };

/** Frases de ejemplo para la guía (y el test de sincronía). */
export const VOICE_EXAMPLES: VoiceExample[] = [
  {
    spoken:
      "Para mi día de hoy voy a revisar la propuesta del proyecto web, dos horas, y luego llamar al contador, media hora.",
    result: "2 tareas en Mi día: “Revisar la propuesta” (WEB, ~2 h) y “Llamar al contador” (~30 min).",
  },
  {
    spoken:
      "Proyecto web. Ajustar el formulario, dos horas. Revisar el menú. Proyecto acme. Enviar la propuesta. Personal. Llamar al contador.",
    result:
      "Bloques por proyecto: 2 tareas en WEB, 1 en ACM y 1 personal, sin elegir el proyecto en cada una. También sirve escribir “WEB:” o “@WEB” en su propia línea.",
  },
  {
    spoken: "Enviar la cuenta de cobro para el viernes, prioridad alta.",
    result: "Tarea con fecha límite el próximo viernes y prioridad alta.",
  },
  {
    spoken: "Seguimiento: respuesta de la cotización esperando a Ana, para el lunes.",
    result: "Seguimiento “Respuesta de la cotización”, esperando a Ana, vence el lunes.",
  },
  {
    spoken: "Ticket para el proyecto web de tres horas: maquetar la página de contacto.",
    result: "Candidato a ticket en WEB “Maquetar la página de contacto” (~3 h).",
  },
];
