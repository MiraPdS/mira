import type {
  AddMemberInput,
  ActivityAction,
  ListProjectsResponse,
  ProjectDto,
  ProjectMemberDto,
  WorkItemPriority,
  WorkItemStatus,
  WorkItemType,
} from '@mira/shared';

import { api } from '@/lib/api-client';

export type ProjectMemberRole = 'OWNER' | 'MEMBER' | 'VIEWER';

// MIR-9: Respuesta al agregar un miembro.
interface AddMemberResponse {
  member: {
    id: string;
    userId: string;
    projectId: string;
    role: ProjectMemberRole;
    joinedAt: string;
  };
}

// MIR-9: Respuesta del listado de miembros.
interface GetMembersResponse {
  members: (ProjectMemberDto & {
    userId: string;
    projectId: string;
  })[];
}

// MIR-10: Respuesta al cambiar el rol de un miembro.
interface ChangeMemberRoleResponse {
  member: {
    id: string;
    userId: string;
    projectId: string;
    role: ProjectMemberRole;
    joinedAt: string;
  };
}

// MIR-23: Actividad reciente del proyecto.
export interface ProjectActivity {
  id: string;
  action: ActivityAction;
  workItemId: string | null;
  actor: {
    id: string;
    name: string;
  };
  field: string | null;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
}

// MIR-23: Datos del panel de resumen.
export interface ProjectSummary {
  total: number;
  byStatus: Record<WorkItemStatus, number>;
  byType: Record<WorkItemType, number>;
  byPriority: Record<WorkItemPriority, number>;
  recentActivity: ProjectActivity[];
}

// MIR-23: Respuesta de la API del resumen.
interface GetProjectSummaryResponse {
  summary: ProjectSummary;
}

export const projectApi = {
  // MIR-6: Listar proyectos del usuario.
  list: async (): Promise<ProjectDto[]> => {
    const { projects } = await api.get<ListProjectsResponse>('/projects');
    return projects;
  },

  // MIR-9: Agregar miembro al proyecto.
  addMember: (projectId: string, input: AddMemberInput) =>
    api.post<AddMemberResponse>(`/projects/${projectId}/members`, input),

  // MIR-9: Obtener miembros del proyecto.
  getMembers: (projectId: string) => api.get<GetMembersResponse>(`/projects/${projectId}/members`),

  // MIR-10: Cambiar rol de un miembro.
  changeMemberRole: (projectId: string, userId: string, role: ProjectMemberRole) =>
    api.patch<ChangeMemberRoleResponse>(`/projects/${projectId}/members/${userId}/role`, { role }),

  // MIR-10: Quitar miembro del proyecto.
  removeMember: (projectId: string, userId: string) =>
    api.delete<void>(`/projects/${projectId}/members/${userId}`),

  // MIR-23: Obtener estadisticas y actividad reciente.
  getSummary: async (projectId: string): Promise<ProjectSummary> => {
    const { summary } = await api.get<GetProjectSummaryResponse>(`/projects/${projectId}/summary`);

    return summary;
  },
};
