import type { AddMemberInput, ProjectMemberDto } from '@mira/shared';
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
  addMember: (projectId: string, input: AddMemberInput) =>
    api.post<AddMemberResponse>(`/projects/${projectId}/members`, input),

  getMembers: (projectId: string) => api.get<GetMembersResponse>(`/projects/${projectId}/members`),

  changeMemberRole: (projectId: string, userId: string, role: ProjectMemberRole) =>
    api.patch<ChangeMemberRoleResponse>(`/projects/${projectId}/members/${userId}/role`, { role }),

  removeMember: (projectId: string, userId: string) =>
    api.delete<void>(`/projects/${projectId}/members/${userId}`),
};
