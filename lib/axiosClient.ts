import axios from "axios";
import axiosRetry from "axios-retry";
import { getSupabase } from "@/lib/supabaseClient";

// Create axios instance with extended timeout for long-running requests (up to 10 minutes)
const axiosClient = axios.create({
  timeout: 600000, // 10 minutes timeout (600,000ms)
  headers: {
    "Content-Type": "application/json",
  },
});

// Configure automatic retry for failed requests
axiosRetry(axiosClient, {
  retries: 3, // Number of retry attempts
  retryDelay: axiosRetry.exponentialDelay, // Exponential backoff
  retryCondition: (error) => {
    // Retry on network errors or 5xx server errors
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      (error.response?.status !== undefined && error.response.status >= 500)
    );
  },
  onRetry: (retryCount, error, requestConfig) => {
    console.log(
      `Retry attempt ${retryCount} for ${requestConfig.url}: ${error.message}`
    );
  },
});

// Request interceptor to attach Supabase auth token
axiosClient.interceptors.request.use(
  async (config) => {
    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
      }
    } catch {
      // If we can't get the session, proceed without auth header
    }
    console.log(`[Axios] Making request to: ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for logging/debugging
axiosClient.interceptors.response.use(
  (response) => {
    console.log(`[Axios] Response received from: ${response.config.url}`);
    return response;
  },
  (error) => {
    if (error.code === "ECONNABORTED") {
      console.error(`[Axios] Request timeout: ${error.config?.url}`);
    } else if (error.response) {
      console.error(
        `[Axios] Response error ${error.response.status}: ${error.config?.url}`
      );
    } else {
      console.error(`[Axios] Network error: ${error.message}`);
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
