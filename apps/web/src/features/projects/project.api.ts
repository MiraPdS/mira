import type { AddMemberInput, ProjectMemberDto } from '@mira/shared';
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
  addMember: (projectId: string, input: AddMemberInput) =>
    api.post<AddMemberResponse>(`/projects/${projectId}/members`, input),

  getMembers: (projectId: string) => api.get<GetMembersResponse>(`/projects/${projectId}/members`),
};
