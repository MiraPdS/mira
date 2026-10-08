import type { ListProjectsResponse, ProjectDto } from '@mira/shared';
import { api } from '@/lib/api-client';

/** Proyectos donde el usuario autenticado es miembro, con su rol en cada uno. */
export async function listProjects(): Promise<ProjectDto[]> {
  const { projects } = await api.get<ListProjectsResponse>('/projects');
  return projects;
}
