/**
 * GMB Agency SaaS - API Service Client
 * Handles communication with the Node.js REST API backend.
 */

// In development, the Vite proxy directs /api to http://localhost:5000
const API_BASE = '/api/v1';

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

/**
 * Base fetch wrapper with standardized error handling and tenant headers
 */
async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.agencyId ? { 'x-agency-id': options.agencyId } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
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
    // Network or parse error
    throw new ApiError(
      error.message || 'Network connection failed. Ensure backend API is running.',
      0,
      'NETWORK_ERROR'
    );
  }
}

/**
 * Fetch Backend System Health
 */
export async function getBackendHealth() {
  return request('/health');
}

export default {
  getBackendHealth,
  request,
};
