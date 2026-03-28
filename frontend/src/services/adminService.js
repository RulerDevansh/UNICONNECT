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

export const getTrends = (params) => {
  const query = buildQuery(params);
  return api.get(`/admin/analytics/trends${query ? `?${query}` : ''}`);
};

export const getFlaggedListings = (params) => {
  const query = buildQuery(params);
  return api.get(`/admin/flagged${query ? `?${query}` : ''}`);
};

export const reviewListing = (listingId, payload) => api.post(`/admin/flagged/${listingId}`, payload);

export const getDisputes = (params) => {
  const query = buildQuery(params);
  return api.get(`/admin/disputes${query ? `?${query}` : ''}`);
};

export const resolveDispute = (disputeId, payload) => api.post(`/admin/disputes/${disputeId}/resolve`, payload);

export const getUsers = (params) => {
  const query = buildQuery(params);
  return api.get(`/admin/users${query ? `?${query}` : ''}`);
};

export const updateUserSuspension = (userId, payload) => api.patch(`/admin/users/${userId}/suspension`, payload);

export const warnUser = (userId, payload) => api.post(`/admin/users/${userId}/warn`, payload);

