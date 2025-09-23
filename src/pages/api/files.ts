export const prerender = false;

// Base URL for the tutoria API
const API_BASE_URL = import.meta.env.API_BASE_URL || 'http://localhost:8000';

/**
 * Handles GET requests to list files available for a module.
 * 
 * @param request Incoming Request object
 * @returns {Response} JSON response containing available files or an error message.
 */
export async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const moduleToken = url.searchParams.get('module_token');

  if (!moduleToken) {
    return new Response('Missing module_token parameter.', { status: 400 });
  }

  try {
    // Fetch files list from the tutoria API
    const response = await fetch(`${API_BASE_URL}/api/widget/files?module_token=${moduleToken}`);

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(errorText, { status: response.status });
    }

    const files = await response.json();
    return new Response(JSON.stringify(files), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    return new Response('Failed to fetch files.', { status: 500 });
  }
}