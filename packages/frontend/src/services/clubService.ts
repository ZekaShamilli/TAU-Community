import apiClient, { PaginatedResponse } from '../lib/api';
import { Club, CreateClubRequest, UpdateClubRequest, ClubFilters } from '../types';

export const clubService = {
  async getClubs(filters?: ClubFilters & { status?: string }): Promise<PaginatedResponse<Club>> {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    
    const response = await apiClient.get(`/clubs?${params.toString()}`);
    return response.data.data ? response.data : { data: response.data, pagination: null };
  },

  async getClub(id: string): Promise<Club> {
    const response = await apiClient.get(`/clubs/${id}`);
    return response.data.data || response.data;
  },

  async getClubBySlug(slug: string): Promise<Club> {
    const response = await apiClient.get(`/clubs/slug/${slug}`);
    return response.data.data || response.data;
  },

  async createClub(clubData: CreateClubRequest): Promise<Club> {
    try {
      const response = await apiClient.post('/clubs', clubData);
      return response.data.data || response.data;
    } catch (error: any) {
      // Re-throw with proper error structure for the frontend to handle
      throw error;
    }
  },

  async updateClub(id: string, updates: UpdateClubRequest): Promise<Club> {
    const response = await apiClient.put(`/clubs/${id}`, updates);
    return response.data.data || response.data;
  },

  async deleteClub(id: string): Promise<void> {
    await apiClient.delete(`/clubs/${id}`);
  },

  async archiveClub(id: string): Promise<Club> {
    const response = await apiClient.post<Club>(`/clubs/${id}/archive`);
    return response.data;
  },

  async getClubDeletionInfo(id: string): Promise<{
    activitiesCount: number;
    applicationsCount: number;
    canDelete: boolean;
    warnings: string[];
  }> {
    const response = await apiClient.get(`/clubs/${id}/deletion-info`);
    return response.data;
  },

  async restoreClub(id: string): Promise<void> {
    await apiClient.post(`/clubs/${id}/restore`);
  },

  async getClubNames(): Promise<string[]> {
    const response = await apiClient.get('/clubs/names');
    return response.data.data || response.data;
  },

  async getClubUrl(id: string): Promise<{ url: string; slug: string }> {
    const response = await apiClient.get(`/clubs/${id}/url`);
    return response.data;
  },

  async changePresident(clubId: string, presidentId: string): Promise<Club> {
    const response = await apiClient.put(`/clubs/${clubId}/president`, { presidentId });
    return response.data.data || response.data;
  },

  async getAvailablePresidents(): Promise<Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    currentClub: string | null;
    displayName: string;
  }>> {
    const response = await apiClient.get('/admin/available-presidents');
    return response.data.data || response.data;
  },

  async removeMember(clubId: string, memberEmail: string): Promise<void> {
    await apiClient.delete(`/clubs/${clubId}/members/${encodeURIComponent(memberEmail)}`);
  }
};