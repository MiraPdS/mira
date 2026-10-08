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

// MIR-23: Tipos del panel de resumen.
export interface ProjectActivity {
  id: string;
  action: string;
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

export interface ProjectSummary {
  total: number;
  byStatus: {
    BACKLOG: number;
    TODO: number;
    IN_PROGRESS: number;
    IN_REVIEW: number;
    DONE: number;
  };
  byType: {
    EPIC: number;
    STORY: number;
    TASK: number;
    BUG: number;
  };
  byPriority: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    CRITICAL: number;
  };
  recentActivity: ProjectActivity[];
}

interface GetProjectSummaryResponse {
  summary: ProjectSummary;
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

  /** MIR-23: Obtiene los conteos y la actividad reciente del proyecto. */
  getSummary: async (projectId: string): Promise<ProjectSummary> => {
    const { summary } = await api.get<GetProjectSummaryResponse>(`/projects/${projectId}/summary`);

    return summary;
  },
};
