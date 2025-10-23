import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

// For Next.js API routes, we use relative paths
const apiClient: AxiosInstance = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  // Credentials are handled automatically by cookies
  withCredentials: true,
});

// Request interceptor - no longer need to manually add JWT (handled by cookies)
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // JWT is now in HTTP-only cookies, no need to add manually
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
export { apiClient };

