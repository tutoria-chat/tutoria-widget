export const prerender = false;

// Base URL for the tutoria API
const API_BASE_URL = import.meta.env.API_BASE_URL || 'http://localhost:8000';

/**
 * Handles GET requests to download a specific file.
 * 
 * @param params Route parameters
 * @param request Incoming Request object
 * @returns {Response} Redirect to the file download URL or an error message.
 */
export async function GET({ params, request }: { params: any; request: Request }) {
  const { fileId } = params;
  const url = new URL(request.url);
  const moduleToken = url.searchParams.get('module_token');

  if (!moduleToken) {
    return new Response('Missing module_token parameter.', { status: 400 });
  }

  if (!fileId) {
    return new Response('Missing file ID.', { status: 400 });
  }

  try {
    // Get download URL from the tutoria API (this will redirect to Azure Blob Storage)
    const downloadUrl = `${API_BASE_URL}/api/widget/files/${fileId}/download?module_token=${moduleToken}`;
    
    // Redirect to the tutoria API download endpoint
    return Response.redirect(downloadUrl, 302);
  } catch (error) {
    console.error('Error downloading file:', error);
    return new Response('Failed to download file.', { status: 500 });
  }
}