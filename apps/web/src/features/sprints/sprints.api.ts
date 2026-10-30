import type {
  CreateSprintInput,
  SprintDto,
  SprintListItemDto,
  SprintListResponse,
  SprintResponse,
  UpdateSprintInput,
} from '@mira/shared';
import { api } from '@/lib/api-client';

const base = (projectId: string) => `/projects/${encodeURIComponent(projectId)}/sprints`;

/** MIR-44: cliente HTTP de la API de sprints (MIR-43). */
export const sprintsApi = {
  /** Sprints del proyecto ordenados por fecha de inicio, con items y puntos. */
  list: async (projectId: string): Promise<SprintListItemDto[]> => {
    const { data } = await api.get<SprintListResponse>(base(projectId));
    return data;
  },

  /** Crea un sprint; el servidor siempre lo deja en PLANNED. */
  create: async (projectId: string, input: CreateSprintInput): Promise<SprintDto> => {
    const { sprint } = await api.post<SprintResponse>(base(projectId), input);
    return sprint;
  },

  /** Edita nombre, objetivo y/o fechas; el estado no se cambia por aqui. */
  update: async (
    projectId: string,
    sprintId: string,
    input: UpdateSprintInput,
  ): Promise<SprintDto> => {
    const { sprint } = await api.patch<SprintResponse>(
      `${base(projectId)}/${encodeURIComponent(sprintId)}`,
      input,
    );
    return sprint;
  },
};
