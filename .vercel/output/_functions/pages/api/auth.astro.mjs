export { renderers } from '../../renderers.mjs';

const prerender = false;
const API_BASE_URL = "http://localhost:8000";
async function GET({ request }) {
  const url = new URL(request.url);
  const moduleToken = url.searchParams.get("module_token");
  if (!moduleToken) {
    return new Response("Missing module_token parameter.", { status: 400 });
  }
  try {
    const response = await fetch(`${API_BASE_URL}/api/widget/info?module_token=${moduleToken}`);
    if (!response.ok) {
      const errorText = await response.text();
      return new Response(errorText, { status: response.status });
    }
    const moduleInfo = await response.json();
    return new Response(JSON.stringify(moduleInfo), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error fetching module info:", error);
    return new Response("Failed to fetch module information.", { status: 500 });
  }
}

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
