import apiClient, { PaginatedResponse } from '../lib/api';
import { Activity, CreateActivityRequest, UpdateActivityRequest, ActivityFilters } from '../types';

export const activityService = {
  async getActivities(filters?: ActivityFilters): Promise<PaginatedResponse<Activity>> {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    
    const response = await apiClient.get<PaginatedResponse<Activity>>(`/activities?${params.toString()}`);
    return response.data;
  },

  async getUpcomingActivities(limit: number = 10): Promise<Activity[]> {
    const response = await apiClient.get(`/activities/upcoming?limit=${limit}`);
    return response.data.data || response.data;
  },

  async getClubActivities(clubId: string): Promise<Activity[]> {
    const response = await apiClient.get(`/activities/club/${clubId}`);
    return response.data.data || response.data;
  },

  async getActivity(id: string): Promise<Activity> {
    const response = await apiClient.get(`/activities/${id}`);
    return response.data.data || response.data;
  },

  async createActivity(activityData: CreateActivityRequest): Promise<Activity> {
    const response = await apiClient.post<Activity>('/activities', activityData);
    return response.data;
  },

  async updateActivity(id: string, updates: UpdateActivityRequest): Promise<Activity> {
    const response = await apiClient.put<Activity>(`/activities/${id}`, updates);
    return response.data;
  },

  async deleteActivity(id: string): Promise<void> {
    await apiClient.delete(`/activities/${id}`);
  },

  async getActivityHistory(id: string): Promise<any[]> {
    const response = await apiClient.get(`/activities/${id}/history`);
    return response.data;
  },

  async rollbackActivity(id: string, versionId: string): Promise<Activity> {
    const response = await apiClient.post<Activity>(`/activities/${id}/rollback`, { versionId });
    return response.data;
  },

  async compareActivityVersions(id: string, version1Id: string, version2Id: string): Promise<any> {
    const response = await apiClient.get(`/activities/${id}/compare/${version1Id}/${version2Id}`);
    return response.data;
  },

  async updateActivityStatuses(): Promise<{ updated: number }> {
    const response = await apiClient.post('/activities/update-statuses');
    return response.data;
  },

  // Activity Participants
  async registerForActivity(activityId: string): Promise<any> {
    const response = await apiClient.post(`/activities/${activityId}/register`);
    return response.data;
  },

  async unregisterFromActivity(activityId: string): Promise<void> {
    await apiClient.delete(`/activities/${activityId}/register`);
  },

  async getActivityParticipants(activityId: string): Promise<any[]> {
    const response = await apiClient.get(`/activities/${activityId}/participants`);
    return response.data.data || response.data;
  },

  async checkRegistration(activityId: string): Promise<{ isRegistered: boolean; registration?: any }> {
    const response = await apiClient.get(`/activities/${activityId}/check-registration`);
    return response.data;
  }
};