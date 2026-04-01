import apiClient, { PaginatedResponse } from '../lib/api';
import { Application, CreateApplicationRequest, UpdateApplicationStatusRequest, ApplicationFilters } from '../types';

export const applicationService = {
  async submitApplication(applicationData: { clubId: string; motivation: string }, userEmail?: string): Promise<Application> {
    const headers: Record<string, string> = {};
    if (userEmail) {
      headers['x-user-email'] = userEmail;
    }
    
    const response = await apiClient.post('/applications', applicationData, { headers });
    // Handle backend response format: { success: true, data: {...} }
    return response.data.data || response.data;
  },

  async getApplication(id: string): Promise<Application> {
    const response = await apiClient.get<Application>(`/applications/${id}`);
    return response.data;
  },

  async getApplications(filters?: ApplicationFilters): Promise<PaginatedResponse<Application>> {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    
    const response = await apiClient.get<PaginatedResponse<Application>>(`/applications?${params.toString()}`);
    return response.data;
  },

  async updateApplicationStatus(id: string, statusUpdate: UpdateApplicationStatusRequest): Promise<Application> {
    const response = await apiClient.put<Application>(`/applications/${id}/status`, statusUpdate);
    return response.data;
  },

  async getApplicationSummary(clubId: string): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    recent: Application[];
  }> {
    const response = await apiClient.get(`/applications/summary/${clubId}`);
    return response.data.data || response.data;
  },

  async getClubApplications(clubId: string): Promise<Application[]> {
    const response = await apiClient.get(`/applications?clubId=${clubId}`);
    return response.data.data || response.data;
  },

  async reviewApplication(id: string, status: 'APPROVED' | 'REJECTED'): Promise<Application> {
    const response = await apiClient.put(`/applications/${id}/status`, { status });
    return response.data.data || response.data;
  },

  async deleteApplication(id: string): Promise<void> {
    await apiClient.delete(`/applications/${id}`);
  },

  async checkExistingApplication(clubId: string, email: string): Promise<{
    exists: boolean;
    application?: Application;
  }> {
    const response = await apiClient.get(`/applications/check/${clubId}/${encodeURIComponent(email)}`);
    return response.data;
  }
};