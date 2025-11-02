/**
 * Robust API client with retry logic, timeouts, and error handling
 * Designed to handle Vercel serverless cold starts and network issues
 */

interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableStatuses: number[];
}

interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504], // Timeout, rate limit, server errors
};

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(attempt: number, config: RetryConfig): number {
  const delay = Math.min(
    config.initialDelay * Math.pow(config.backoffMultiplier, attempt),
    config.maxDelay
  );
  // Add jitter to prevent thundering herd
  return delay + Math.random() * 1000;
}

/**
 * Check if error is retryable
 */
function isRetryable(error: any, status?: number): boolean {
  // Network errors (no response)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // Timeout errors
  if (error.name === 'AbortError') {
    return true;
  }

  // Server errors
  if (status && DEFAULT_RETRY_CONFIG.retryableStatuses.includes(status)) {
    return true;
  }

  return false;
}

/**
 * Enhanced fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { timeout = 30000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'Connection': 'keep-alive',
        'Keep-Alive': 'timeout=5, max=100',
        ...fetchOptions.headers,
      },
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Robust API request with automatic retry logic
 */
export async function robustFetch(
  url: string,
  options: FetchOptions = {},
  retryConfig: Partial<RetryConfig> = {}
): Promise<Response> {
  const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  const maxRetries = options.retries ?? config.maxRetries;

  let lastError: any;
  let lastStatus: number | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[API] Attempt ${attempt + 1}/${maxRetries + 1} for ${url}`);

      const response = await fetchWithTimeout(url, options);

      // Success - return response
      if (response.ok) {
        console.log(`[API] Success on attempt ${attempt + 1}`);
        return response;
      }

      // Check if we should retry based on status
      lastStatus = response.status;
      if (!isRetryable(null, response.status)) {
        console.warn(`[API] Non-retryable status ${response.status}, returning response`);
        return response; // Return non-retryable error responses
      }

      console.warn(`[API] Retryable status ${response.status}, will retry`);
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);

    } catch (error: any) {
      lastError = error;
      console.error(`[API] Attempt ${attempt + 1} failed:`, error.message);

      // Don't retry if not retryable
      if (!isRetryable(error, lastStatus)) {
        console.error(`[API] Non-retryable error, throwing immediately`);
        throw error;
      }
    }

    // If we have more attempts, wait before retrying
    if (attempt < maxRetries) {
      const delay = getRetryDelay(attempt, config);
      console.log(`[API] Waiting ${Math.round(delay)}ms before retry ${attempt + 2}`);
      await sleep(delay);
    }
  }

  // All retries exhausted
  console.error(`[API] All ${maxRetries + 1} attempts failed`);
  throw lastError || new Error('Request failed after all retries');
}

/**
 * API client for widget endpoints
 */
export class WidgetAPIClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    // Fallback chain for API URL
    this.baseUrl =
      baseUrl ||
      import.meta.env.PUBLIC_API_BASE_URL ||
      (typeof window !== 'undefined' && (window as any).TUTORIA_API_URL) ||
      'https://tutoria-api-dev.orangesmoke-8addc8f4.eastus2.azurecontainerapps.io';

    console.log('[API Client] Initialized with base URL:', this.baseUrl);
  }

  /**
   * Fetch module information
   */
  async getModuleInfo(moduleToken: string): Promise<any> {
    const url = `${this.baseUrl}/api/widget/info?module_token=${encodeURIComponent(moduleToken)}`;

    try {
      const response = await robustFetch(url, {
        method: 'GET',
        timeout: 15000, // 15 seconds for info requests
        retries: 2, // 2 retries for metadata
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to fetch module info: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('[API] getModuleInfo failed:', error);
      throw new Error(`Unable to load module information: ${error.message}`);
    }
  }

  /**
   * Fetch module files
   */
  async getModuleFiles(moduleToken: string): Promise<any[]> {
    const url = `${this.baseUrl}/api/widget/files?module_token=${encodeURIComponent(moduleToken)}`;

    try {
      const response = await robustFetch(url, {
        method: 'GET',
        timeout: 15000,
        retries: 2,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to fetch files: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('[API] getModuleFiles failed:', error);
      throw new Error(`Unable to load module files: ${error.message}`);
    }
  }

  /**
   * Send chat message (student mode)
   */
  async sendChatMessage(params: {
    moduleToken: string;
    message: string;
    studentId?: string;
    conversationId?: string | null;
  }): Promise<any> {
    const url = `${this.baseUrl}/api/widget/chat?module_token=${encodeURIComponent(params.moduleToken)}`;

    try {
      const response = await robustFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: params.message,
          student_id: params.studentId,
          conversation_id: params.conversationId,
        }),
        timeout: 60000, // 60 seconds for AI responses
        retries: 3, // 3 retries for chat (most critical)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');

        // Provide user-friendly error messages
        if (response.status === 401 || response.status === 403) {
          throw new Error('Invalid or expired access token. Please refresh the page.');
        }
        if (response.status === 429) {
          throw new Error('Too many requests. Please wait a moment and try again.');
        }

        throw new Error(`Chat request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (!data?.response) {
        throw new Error('Invalid response from server');
      }

      return data;
    } catch (error: any) {
      console.error('[API] sendChatMessage failed:', error);

      // Re-throw with user-friendly message
      if (error.message.includes('fetch')) {
        throw new Error('Network error. Please check your connection and try again.');
      }
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. The server may be slow. Please try again.');
      }

      throw error;
    }
  }

  /**
   * Send professor chat message
   */
  async sendProfessorChatMessage(params: {
    professorAgentToken: string;
    message: string;
    conversationId?: string | null;
  }): Promise<any> {
    const url = `${this.baseUrl}/api/widget/professor-chat?professor_agent_token=${encodeURIComponent(params.professorAgentToken)}`;

    try {
      const response = await robustFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: params.message,
          conversation_id: params.conversationId,
        }),
        timeout: 60000,
        retries: 3,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');

        if (response.status === 401 || response.status === 403) {
          throw new Error('Invalid or expired professor token. Please refresh the page.');
        }
        if (response.status === 429) {
          throw new Error('Too many requests. Please wait a moment and try again.');
        }

        throw new Error(`Chat request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (!data?.response) {
        throw new Error('Invalid response from server');
      }

      return data;
    } catch (error: any) {
      console.error('[API] sendProfessorChatMessage failed:', error);

      if (error.message.includes('fetch')) {
        throw new Error('Network error. Please check your connection and try again.');
      }
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. The server may be slow. Please try again.');
      }

      throw error;
    }
  }

  /**
   * Health check - verify API is reachable
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await robustFetch(`${this.baseUrl}/health`, {
        method: 'GET',
        timeout: 5000,
        retries: 1,
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const apiClient = new WidgetAPIClient();
