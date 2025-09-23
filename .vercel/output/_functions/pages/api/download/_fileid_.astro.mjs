export { renderers } from '../../../renderers.mjs';

const prerender = false;
const API_BASE_URL = "http://localhost:8000";
async function GET({ params, request }) {
  const { fileId } = params;
  const url = new URL(request.url);
  const moduleToken = url.searchParams.get("module_token");
  if (!moduleToken) {
    return new Response("Missing module_token parameter.", { status: 400 });
  }
  if (!fileId) {
    return new Response("Missing file ID.", { status: 400 });
  }
  try {
    const downloadUrl = `${API_BASE_URL}/api/widget/files/${fileId}/download?module_token=${moduleToken}`;
    return Response.redirect(downloadUrl, 302);
  } catch (error) {
    console.error("Error downloading file:", error);
    return new Response("Failed to download file.", { status: 500 });
  }
}

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
