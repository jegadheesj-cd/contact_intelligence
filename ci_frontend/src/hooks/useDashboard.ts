import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApiResponse } from '../types/api';
import type { DashboardWidgets, DashboardAnalytics } from '../types/dashboard';

export function useDashboardWidgets() {
  return useQuery<DashboardWidgets>({
    queryKey: ['dashboard-widgets'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<DashboardWidgets>>('/dashboard/widgets');
      return response.data.data;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes stale time
  });
}

export function useDashboardAnalytics() {
  return useQuery<DashboardAnalytics>({
    queryKey: ['dashboard-analytics'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<DashboardAnalytics>>('/dashboard/analytics');
      return response.data.data;
    },
    staleTime: 1000 * 60 * 1, // 1 minute stale time
  });
}
