export const prerender = false;

// Environment variables for authentication endpoint
const API_AUTH_URL = import.meta.env.API_AUTH_URL;
const API_AUTH_USERNAME = import.meta.env.API_AUTH_USERNAME;
const API_AUTH_PASSWORD = import.meta.env.API_AUTH_PASSWORD;

/**
 * Handles POST requests to authenticate with an external API using configured credentials.
 * 
 * @returns {Response} JSON response containing a token or an error message.
 */
export async function POST() {
  // Check if authentication environment variables are defined
  if (!API_AUTH_URL || !API_AUTH_USERNAME || !API_AUTH_PASSWORD) {
    return new Response('Authentication environment variables are not configured.', { status: 500 });
  }

  // Send authentication request to the external API
  const response = await fetch(API_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: API_AUTH_USERNAME,
      password: API_AUTH_PASSWORD,
    }),
  });

  // Forward error response if the authentication request fails
  if (!response.ok) {
    const errorText = await response.text();
    return new Response(errorText, { status: response.status });
  }

  // Parse and extract token from response
  const data = await response.json();
  const token = data?.token || data?.access;

  // Handle missing token in successful response
  if (!token) {
    return new Response('Token not found in the authentication response.', { status: 500 });
  }

  // Return the token in a JSON response
  return new Response(JSON.stringify({ token }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
