import apiClient from '../lib/api';

export interface UserCoins {
  balance: number;
  totalEarned: number;
  totalSpent: number;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface AwardCoinsRequest {
  toUserId: string;
  amount: number;
  reason: string;
  clubId: string;
}

export interface AdjustCoinsRequest {
  userId: string;
  amount: number;
  reason: string;
}

export interface CoinTransaction {
  id: string;
  fromUserId: string | null;
  toUserId: string | null;
  amount: number;
  reason: string;
  transactionType: string;
  clubId: string | null;
  clubName: string | null;
  createdAt: string;
  fromUser: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  toUser: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export interface LeaderboardEntry {
  userId: string;
  balance: number;
  totalEarned: number;
  firstName: string;
  lastName: string;
  email: string;
}

export const coinService = {
  async getUserCoins(userId: string): Promise<UserCoins> {
    const response = await apiClient.get(`/users/${userId}/coins`);
    return response.data.data || response.data;
  },

  async awardCoins(data: AwardCoinsRequest): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post('/coins/award', data);
    return response.data;
  },

  async adjustCoins(data: AdjustCoinsRequest): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post('/coins/adjust', data);
    return response.data;
  },

  async getTransactions(userId?: string, limit: number = 50): Promise<CoinTransaction[]> {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    params.append('limit', limit.toString());
    
    const response = await apiClient.get(`/coins/transactions?${params.toString()}`);
    return response.data.data || response.data;
  },

  async getLeaderboard(clubId?: string, limit: number = 10): Promise<LeaderboardEntry[]> {
    const params = new URLSearchParams();
    if (clubId) params.append('clubId', clubId);
    params.append('limit', limit.toString());
    
    const response = await apiClient.get(`/coins/leaderboard?${params.toString()}`);
    return response.data.data || response.data;
  }
};
