export const prerender = false;

// Base URL for the tutoria API
const API_BASE_URL = import.meta.env.API_BASE_URL || 'http://localhost:8000';

/**
 * Handles POST requests that forward a user's question to the tutoria widget chat API.
 * 
 * Expects a JSON body with the following fields:
 * - message: string (the user question)
 * - module_token: string (the module access token)
 * - student_id: optional string (external student identifier)
 * 
 * @param request Incoming Request object
 * @returns {Response} A JSON response containing the AI tutor's answer or an error
 */
export async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json();
    const { message, module_token, student_id } = body;

    // Validate required fields
    if (!message || !module_token) {
      return new Response('Missing message or module_token.', { status: 400 });
    }

    // Validate base API URL
    const baseUrl = API_BASE_URL;
    if (!baseUrl) {
      return new Response('API_BASE_URL is not configured.', { status: 500 });
    }

    // Build final request URL
    const url = `${baseUrl}/api/widget/chat?module_token=${module_token}`;

    // Forward request to tutoria widget API
    const apiResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        student_id,
      }),
    });

    // Handle failure response
    if (!apiResponse.ok) {
      const error = await apiResponse.text();
      return new Response(error, { status: apiResponse.status });
    }

    // Return response content
    const responseData = await apiResponse.json();
    return new Response(
      JSON.stringify({ 
        response: responseData.response,
        module_name: responseData.module_name,
        files_used: responseData.files_used 
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Internal error in /api/submit route:', err);
    return new Response('Internal server error.', { status: 500 });
  }
}
