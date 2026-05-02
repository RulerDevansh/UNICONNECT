import api from './api';

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.set(key, value);
  });
  return query.toString();
};

export const getOverviewMetrics = () => api.get('/admin/analytics/overview');
export const getTrends = (params) => api.get(`/admin/analytics/trends${buildQuery(params) ? `?${buildQuery(params)}` : ''}`);
export const getFlaggedListings = (params) => api.get(`/admin/flagged${buildQuery(params) ? `?${buildQuery(params)}` : ''}`);
export const reviewListing = (listingId, payload) => api.post(`/admin/flagged/${listingId}`, payload);
export const getDisputes = (params) => api.get(`/admin/disputes${buildQuery(params) ? `?${buildQuery(params)}` : ''}`);
export const resolveDispute = (disputeId, payload) => api.post(`/admin/disputes/${disputeId}/resolve`, payload);
export const getUsers = (params) => api.get(`/admin/users${buildQuery(params) ? `?${buildQuery(params)}` : ''}`);
export const updateUserSuspension = (userId, payload) => api.patch(`/admin/users/${userId}/suspension`, payload);
export const warnUser = (userId, payload) => api.post(`/admin/users/${userId}/warn`, payload);

