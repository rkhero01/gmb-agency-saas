/**
 * GMB Agency SaaS - API Service Client
 * Handles communication with the Node.js REST API backend.
 */

const API_BASE = '/api/v1';
const TOKEN_KEY = 'gmb_saas_auth_token';

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Base fetch wrapper with standardized error handling and JWT injection
 */
async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      // If 401 Unauthorized, clear stored token
      if (response.status === 401 && !endpoint.includes('/auth/login')) {
        clearStoredToken();
      }

      throw new ApiError(
        data?.error?.message || `HTTP request failed with status ${response.status}`,
        response.status,
        data?.error?.code || 'HTTP_ERROR',
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      error.message || 'Network connection failed. Ensure backend API is running.',
      0,
      'NETWORK_ERROR'
    );
  }
}

/**
 * System Health
 */
export async function getBackendHealth() {
  return request('/health');
}

/**
 * Authentication API
 */
export async function login(email, password) {
  const res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (res.data?.token) {
    setStoredToken(res.data.token);
  }
  return res.data;
}

export async function registerAgency(data) {
  const res = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (res.data?.token) {
    setStoredToken(res.data.token);
  }
  return res.data;
}

export async function logout() {
  try {
    await request('/auth/logout', { method: 'POST' });
  } finally {
    clearStoredToken();
  }
}

export async function getMe() {
  const res = await request('/auth/me');
  return res.data;
}

/**
 * Team Management API
 */
export async function getTeamMembers() {
  const res = await request('/team');
  return res.data;
}

export async function inviteTeamMember(data) {
  const res = await request('/team/invite', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function updateMemberRole(userId, role) {
  const res = await request(`/team/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
  return res.data;
}

export async function updateMemberStatus(userId, status) {
  const res = await request(`/team/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return res.data;
}

/**
 * Client Management API
 */
export async function listClients() {
  const res = await request('/clients');
  return res.data;
}

export async function getClient(clientId) {
  const res = await request(`/clients/${clientId}`);
  return res.data;
}

export async function createClient(data) {
  const res = await request('/clients', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function updateClient(clientId, data) {
  const res = await request(`/clients/${clientId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function deleteClient(clientId) {
  const res = await request(`/clients/${clientId}`, {
    method: 'DELETE',
  });
  return res.data;
}

/**
 * Location Management API
 */
export async function listLocations(clientId) {
  const res = await request(`/clients/${clientId}/locations`);
  return res.data;
}

export async function getLocation(locationId) {
  const res = await request(`/locations/${locationId}`);
  return res.data;
}

export async function createLocation(clientId, data) {
  const res = await request(`/clients/${clientId}/locations`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function updateLocation(locationId, data) {
  const res = await request(`/locations/${locationId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function deleteLocation(locationId) {
  const res = await request(`/locations/${locationId}`, {
    method: 'DELETE',
  });
  return res.data;
}

/**
 * Google Cloud OAuth & Business Profile API
 */
export async function getGoogleConnectUrl() {
  const res = await request('/google/connect');
  return res.data;
}

export async function getGoogleStatus() {
  const res = await request('/google/status');
  return res.data;
}

export async function getGoogleAccounts() {
  const res = await request('/google/accounts');
  return res.data;
}

export async function getGoogleLocations(accountId) {
  const query = accountId ? `?accountId=${encodeURIComponent(accountId)}` : '';
  const res = await request(`/google/locations${query}`);
  return res.data;
}

export async function getLinkedProfiles() {
  const res = await request('/google/profiles');
  return res.data;
}

export async function linkGoogleLocation(locationId, linkData) {
  const res = await request(`/google/locations/${locationId}/link`, {
    method: 'POST',
    body: JSON.stringify(linkData),
  });
  return res.data;
}

export async function unlinkGoogleLocation(locationId) {
  const res = await request(`/google/locations/${locationId}/link`, {
    method: 'DELETE',
  });
  return res.data;
}

export async function disconnectGoogle() {
  const res = await request('/google/disconnect', {
    method: 'POST',
  });
  return res.data;
}

export default {
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  getBackendHealth,
  login,
  registerAgency,
  logout,
  getMe,
  getTeamMembers,
  inviteTeamMember,
  updateMemberRole,
  updateMemberStatus,
  listClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  listLocations,
  getLocation,
  createLocation,
  updateLocation,
  deleteLocation,
  getGoogleConnectUrl,
  getGoogleStatus,
  getGoogleAccounts,
  getGoogleLocations,
  getLinkedProfiles,
  linkGoogleLocation,
  unlinkGoogleLocation,
  disconnectGoogle,
};
