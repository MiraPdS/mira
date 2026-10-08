import type {
  AddMemberInput,
  ListProjectsResponse,
  ProjectDto,
  ProjectMemberDto,
} from '@mira/shared';
import { api } from '@/lib/api-client';

interface AddMemberResponse {
  member: {
    id: string;
    userId: string;
    projectId: string;
    role: 'OWNER' | 'MEMBER' | 'VIEWER';
    joinedAt: string;
  };
}

interface GetMembersResponse {
  members: (ProjectMemberDto & {
    userId: string;
    projectId: string;
  })[];
}

export const projectApi = {
  /** Proyectos donde el usuario autenticado es miembro, con su rol en cada uno. */
  list: async (): Promise<ProjectDto[]> => {
    const { projects } = await api.get<ListProjectsResponse>('/projects');
    return projects;
  },

  addMember: (projectId: string, input: AddMemberInput) =>
    api.post<AddMemberResponse>(`/projects/${projectId}/members`, input),

  getMembers: (projectId: string) => api.get<GetMembersResponse>(`/projects/${projectId}/members`),
};
