import type { SprintDto } from '@mira/shared';

/** Las fechas del sprint son dias de calendario: se leen en UTC para no correrse. */
const calendarDate = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeZone: 'UTC' });

/** Una fecha `YYYY-MM-DD` del contrato, legible en es-CL. */
export function fechaCalendario(date: string): string {
  return calendarDate.format(new Date(`${date}T00:00:00Z`));
}

/** "2 nov 2026 – 13 nov 2026": periodo del sprint (MIR-44, MIR-47). */
export function rangoDeSprint(sprint: Pick<SprintDto, 'startDate' | 'endDate'>): string {
  return `${fechaCalendario(sprint.startDate)} – ${fechaCalendario(sprint.endDate)}`;
}
