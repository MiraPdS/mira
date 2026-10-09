import type {
  AddMemberInput,
  CreateProjectInput,
  ListProjectsResponse,
  ProjectDto,
  ProjectMemberDto,
  ProjectResponse,
  UpdateProjectInput,
} from '@mira/shared';
import { api } from '@/lib/api-client';

export type ProjectMemberRole = 'OWNER' | 'MEMBER' | 'VIEWER';

interface AddMemberResponse {
  member: {
    id: string;
    userId: string;
    projectId: string;
    role: ProjectMemberRole;
    joinedAt: string;
  };
}

interface GetMembersResponse {
  members: (ProjectMemberDto & {
    userId: string;
    projectId: string;
  })[];
}

interface ChangeMemberRoleResponse {
  member: {
    id: string;
    userId: string;
    projectId: string;
    role: ProjectMemberRole;
    joinedAt: string;
  };
}

export const projectApi = {
  /** Proyectos donde el usuario autenticado es miembro, con su rol en cada uno. */
  list: async (): Promise<ProjectDto[]> => {
    const { projects } = await api.get<ListProjectsResponse>('/projects');
    return projects;
  },

  /** Crea un proyecto; quien lo crea queda como OWNER. */
  create: async (input: CreateProjectInput): Promise<ProjectDto> => {
    const { project } = await api.post<ProjectResponse>('/projects', input);
    return project;
  },

  /** Un proyecto con el rol del usuario autenticado. 403 si no es miembro. */
  get: async (projectId: string): Promise<ProjectDto> => {
    const { project } = await api.get<ProjectResponse>(`/projects/${projectId}`);
    return project;
  },

  /** Edita nombre y/o descripcion. Solo el OWNER; 403 para el resto. */
  update: async (projectId: string, input: UpdateProjectInput): Promise<ProjectDto> => {
    const { project } = await api.patch<ProjectResponse>(`/projects/${projectId}`, input);
    return project;
  },

  addMember: (projectId: string, input: AddMemberInput) =>
    api.post<AddMemberResponse>(`/projects/${projectId}/members`, input),

  getMembers: (projectId: string) => api.get<GetMembersResponse>(`/projects/${projectId}/members`),

  changeMemberRole: (projectId: string, userId: string, role: ProjectMemberRole) =>
    api.patch<ChangeMemberRoleResponse>(`/projects/${projectId}/members/${userId}/role`, { role }),

  removeMember: (projectId: string, userId: string) =>
    api.delete<void>(`/projects/${projectId}/members/${userId}`),
};
