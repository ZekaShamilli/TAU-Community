import apiClient, { PaginatedResponse } from '../lib/api';
import { User } from '../types';

export interface UserFilters {
  role?: string;
  clubId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  isActive?: boolean;
}

export const userService = {
  async getUsers(filters?: UserFilters): Promise<PaginatedResponse<User>> {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    
    const response = await apiClient.get(`/users?${params.toString()}`);
    return response.data.data ? response.data : { data: response.data, pagination: null };
  },

  async getUser(id: string): Promise<User> {
    const response = await apiClient.get(`/users/${id}`);
    return response.data.data || response.data;
  },

  async updateUser(id: string, updates: UpdateUserRequest): Promise<User> {
    const response = await apiClient.put(`/users/${id}`, updates);
    return response.data.data || response.data;
  },

  async updateGPA(userId: string, gpa: number): Promise<{ gpa: number }> {
    const response = await apiClient.put(`/users/${userId}/gpa`, { gpa });
    return response.data.data;
  },

  async deleteUser(id: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.delete(`/users/${id}`);
    return response.data;
  },

  async getClubMembers(clubId: string, filters?: { search?: string; page?: number; limit?: number }): Promise<PaginatedResponse<User & { membershipStatus: string; joinedAt: string; approvedAt: string }>> {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    
    const response = await apiClient.get(`/clubs/${clubId}/members?${params.toString()}`);
    return response.data.data ? response.data : { data: response.data, pagination: null };
  }
};