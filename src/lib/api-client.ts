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
        if (response.status === 404) {
          throw new Error('MODULE_NOT_AVAILABLE');
        }
        throw new Error(`Failed to fetch module info: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error: any) {
      if (error.message === 'MODULE_NOT_AVAILABLE') throw error;
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
    verificationToken?: string;
    authToken?: string;
  }): Promise<any> {
    const url = `${this.baseUrl}/api/widget/chat?module_token=${encodeURIComponent(params.moduleToken)}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (params.authToken) {
      headers['Authorization'] = `Bearer ${params.authToken}`;
    }

    try {
      const response = await robustFetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: params.message,
          student_id: params.studentId,
          conversation_id: params.conversationId,
          verification_token: params.verificationToken,
        }),
        timeout: 60000, // 60 seconds for AI responses
        retries: 3, // 3 retries for chat (most critical)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');

        // Provide user-friendly error messages
        if (response.status === 401) {
          throw new Error('Invalid or expired access token. Please refresh the page.');
        }
        if (response.status === 403) {
          // 403 may be verification-related (expired HMAC token, not enrolled, etc.)
          throw new Error(`Verification expired: ${errorText}`);
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
   * Send chat message with streaming (student mode)
   * Returns an async generator that yields response chunks
   */
  async *sendChatMessageStream(params: {
    moduleToken: string;
    message: string;
    studentId?: string;
    conversationId?: string | null;
    verificationToken?: string;
    authToken?: string;
  }): AsyncGenerator<{ type: 'chunk' | 'done' | 'error' | 'connected'; content?: string; conversationId?: string; error?: string }, void, unknown> {
    const url = `${this.baseUrl}/api/widget/chat/stream?module_token=${encodeURIComponent(params.moduleToken)}`;

    // Use AbortController with 120s timeout for streaming requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (params.authToken) {
      headers['Authorization'] = `Bearer ${params.authToken}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: params.message,
          student_id: params.studentId,
          conversation_id: params.conversationId,
          verification_token: params.verificationToken,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');

        // Provide user-friendly error messages
        if (response.status === 401) {
          throw new Error('Invalid or expired access token. Please refresh the page.');
        }
        if (response.status === 403) {
          // 403 may be verification-related (expired HMAC token, not enrolled, etc.)
          throw new Error(`Verification expired: ${errorText}`);
        }
        if (response.status === 429) {
          throw new Error('Too many requests. Please wait a moment and try again.');
        }
        if (response.status === 501) {
          throw new Error('Streaming is not enabled on the server. Please try again.');
        }

        throw new Error(`Chat request failed: ${response.status} - ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body received');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          // Decode the chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages (split by double newline)
          const messages = buffer.split('\n\n');
          buffer = messages.pop() || ''; // Keep incomplete message in buffer

          for (const message of messages) {
            if (!message.trim()) continue;

            // Parse SSE format: "data: {...}"
            const lines = message.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.substring(6));

                  if (data.event === 'connected') {
                    yield { type: 'connected' };
                  } else if (data.chunk) {
                    yield { type: 'chunk', content: data.chunk };
                  } else if (data.event === 'done') {
                    yield { type: 'done', conversationId: data.conversation_id };
                  } else if (data.event === 'error') {
                    yield { type: 'error', error: data.message };
                  }
                } catch (parseError) {
                  console.error('[API] Failed to parse SSE message:', line, parseError);
                }
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error: any) {
      console.error('[API] sendChatMessageStream failed:', error);

      // Re-throw with user-friendly message
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. The server took too long to respond. Please try again.');
      }
      if (error.message.includes('fetch')) {
        throw new Error('Network error. Please check your connection and try again.');
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
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
   * Send UP Business chat message
   * Uses UP Business API Key authentication instead of module token
   */
  async sendUpBusinessChatMessage(params: {
    upApiKey: string;
    message: string;
    upId?: string;
    conversationId?: string | null;
    teamName?: string;
  }): Promise<any> {
    const url = `${this.baseUrl}/api/upbusiness/chat`;

    try {
      // Build form data
      const formData = new FormData();
      formData.append('message', params.message);

      if (params.upId) {
        formData.append('up_id', params.upId);
      }

      if (params.conversationId) {
        formData.append('conversation_id', params.conversationId);
      }

      if (params.teamName) {
        formData.append('team_name', params.teamName);
      }

      const response = await robustFetch(url, {
        method: 'POST',
        headers: {
          'X-API-Key': params.upApiKey,
          // Note: Don't set Content-Type, browser will set it with boundary for FormData
        },
        body: formData,
        timeout: 60000, // 60 seconds for AI responses
        retries: 3, // 3 retries for chat
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');

        // Provide user-friendly error messages
        if (response.status === 401 || response.status === 403) {
          throw new Error('Invalid or expired UP Business API key. Please contact support.');
        }
        if (response.status === 429) {
          throw new Error('Too many requests. Please wait a moment and try again.');
        }

        throw new Error(`Chat request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // UP Business API returns different structure
      // { combined_analysis, conversation_id, files_analyzed, individual_analyses, ... }
      if (!data?.combined_analysis && !data?.response) {
        throw new Error('Invalid response from server');
      }

      // Normalize response to match widget expectations
      return {
        response: data.combined_analysis || data.response || '',
        conversation_id: data.conversation_id,
        files_used: data.individual_analyses || [],
      };
    } catch (error: any) {
      console.error('[API] sendUpBusinessChatMessage failed:', error);

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
   * Fetch quiz questions for a module.
   * Pass count=0 for a lightweight pre-flight that returns only available_difficulties.
   */
  async getQuizzes(params: {
    moduleToken: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    count?: number;
  }): Promise<{ quizzes: any[]; total_available: number; count: number; module_name: string; available_difficulties: string[] }> {
    const count = params.count ?? 5;
    let url = `${this.baseUrl}/api/widget/quizzes?module_token=${encodeURIComponent(params.moduleToken)}&count=${count}`;
    if (params.difficulty) {
      url += `&difficulty=${params.difficulty}`;
    }

    try {
      const response = await robustFetch(url, {
        method: 'GET',
        timeout: 15000,
        retries: 2,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to fetch quizzes: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('[API] getQuizzes failed:', error);
      throw new Error(`Unable to load quizzes: ${error.message}`);
    }
  }

  /**
   * Check if the module requires student verification (matricula)
   */
  async requiresVerification(moduleToken: string): Promise<{ requires_verification: boolean; course_name: string }> {
    const url = `${this.baseUrl}/api/widget/requires-verification?module_token=${encodeURIComponent(moduleToken)}`;

    try {
      const response = await robustFetch(url, {
        method: 'GET',
        timeout: 15000,
        retries: 2,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to check verification: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('[API] requiresVerification failed:', error);
      throw new Error(`Unable to check verification requirement: ${error.message}`);
    }
  }

  /**
   * Verify a student's matricula for a given module
   */
  async verifyStudent(moduleToken: string, matricula: string): Promise<{ verified: boolean; student_id?: number; student_name?: string; verification_token?: string; message?: string }> {
    const url = `${this.baseUrl}/api/widget/verify-student?module_token=${encodeURIComponent(moduleToken)}`;

    try {
      const response = await robustFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ matricula }),
        timeout: 15000,
        retries: 2,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');

        // Parse the detail from the backend error response
        let detail = '';
        try {
          const parsed = JSON.parse(errorText);
          detail = parsed.detail || '';
        } catch { /* ignore */ }

        // 401 from verify-student means matricula not found — return as unverified
        if (response.status === 401 && detail) {
          return { verified: false, message: detail };
        }

        if (response.status === 403) {
          throw new Error('Invalid or expired access token. Please refresh the page.');
        }

        throw new Error(`Verification failed: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('[API] verifyStudent failed:', error);

      if (error.message.includes('fetch')) {
        throw new Error('Network error. Please check your connection and try again.');
      }
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      }

      throw error;
    }
  }

  /**
   * Check if a student has given all required LGPD consents
   */
  async checkConsentStatus(moduleToken: string, studentId: number): Promise<{ has_all_consents: boolean; consents: Record<string, any> }> {
    const url = `${this.baseUrl}/api/widget/privacy/consent-status?module_token=${encodeURIComponent(moduleToken)}&student_id=${studentId}`;

    try {
      const response = await robustFetch(url, {
        method: 'GET',
        timeout: 15000,
        retries: 2,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to check consent: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('[API] checkConsentStatus failed:', error);
      throw new Error(`Unable to check consent status: ${error.message}`);
    }
  }

  /**
   * Record student consent for LGPD compliance
   */
  async recordConsent(moduleToken: string, studentId: number, consentTypes: string[]): Promise<{ status: string; recorded_consents: string[] }> {
    const url = `${this.baseUrl}/api/widget/privacy/record-consent?module_token=${encodeURIComponent(moduleToken)}`;

    try {
      const response = await robustFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          student_id: studentId,
          consent_types: consentTypes,
        }),
        timeout: 15000,
        retries: 2,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to record consent: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('[API] recordConsent failed:', error);
      throw new Error(`Unable to record consent: ${error.message}`);
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
