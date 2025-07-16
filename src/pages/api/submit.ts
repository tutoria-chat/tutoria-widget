export const prerender = false;

// Base URL for the external API endpoint
const API_BASE_URL = import.meta.env.API_BASE_URL;
const API_AUTH_USERNAME = import.meta.env.API_AUTH_USERNAME;

/**
 * Handles POST requests that forward a user's question to an external API.
 * 
 * Expects a JSON body with the following fields:
 * - pergunta: string (the user question)
 * - suffix: optional string (used to append to the API base URL)
 * 
 * Requires an Authorization header with a Bearer token.
 * 
 * @param request Incoming Request object
 * @returns {Response} A JSON response containing the external API's answer or an error
 */
export async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json();
    const pergunta = body.pergunta; // User's question (keep in Portuguese)
    const suffix = body.suffix || '';
    const usuario = API_AUTH_USERNAME; // Static user identifier (keep in Portuguese)

    const token = request.headers.get('authorization')?.replace('Bearer ', '');

    // Validate required fields
    if (!pergunta || !token) {
      return new Response('Missing pergunta or token.', { status: 400 });
    }

    // Build FormData to forward to external API
    const formData = new FormData();
    formData.append('usuario', usuario);
    formData.append('pergunta', pergunta);

    // Validate base API URL
    const baseUrl = API_BASE_URL;
    if (!baseUrl) {
      return new Response('API_BASE_URL is not configured.', { status: 500 });
    }

    // Build final request URL by appending optional suffix
    const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    let url = base;
    if (suffix) {
      const suffixPath = suffix.startsWith('/') ? suffix : `/${suffix}`;
      url += suffixPath;
    }

    // Forward request to external API
    const apiResponse = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    // Handle failure response
    if (!apiResponse.ok) {
      const error = await apiResponse.text();
      return new Response(error, { status: apiResponse.status });
    }

    // Return response content
    const resposta = await apiResponse.json();
    return new Response(
      JSON.stringify({ response: resposta?.resposta ?? resposta }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Internal error in /api/submit route:', err);
    return new Response('Internal server error.', { status: 500 });
  }
}
