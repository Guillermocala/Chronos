// Tipos comunes de la carga de datos externos (informes de otras plataformas).

/** Texto de un PDF con su posición (origen abajo a la izquierda, como pdf.js). */
export type PdfTextItem = { str: string; x: number; y: number; page: number };

/** Un registro de actividad listo para revisar y cargar. */
export type ExternalRow = {
  /** Huella estable del registro para no cargarlo dos veces. */
  externalId: string;
  date: string;
  /** Nombre del proyecto en la plataforma externa (se mapea a un proyecto de Chronos). */
  externalProject: string;
  hours: number;
  billable: boolean;
  title: string;
  notes: string;
  tags: string[];
  /** Columnas extra para mostrar en la vista previa. */
  details: { client: string; type: string; interlocutor: string };
};

export type ExternalReportMeta = {
  code: string | null;
  person: string | null;
  email: string | null;
  organization: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  /** Totales que declara el informe, para comprobar la lectura. */
  declaredHours: number | null;
  declaredRecords: number | null;
};

export type ExternalReport = {
  meta: ExternalReportMeta;
  rows: ExternalRow[];
  warnings: string[];
};
