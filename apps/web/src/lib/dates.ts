const dateTimeFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Fecha y hora legibles (es-CL) para marcas de tiempo de la API. */
export function fechaLegible(isoDate: string): string {
  return dateTimeFormatter.format(new Date(isoDate));
}
