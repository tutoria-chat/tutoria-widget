export { renderers } from '../../renderers.mjs';

const prerender = false;
const API_BASE_URL = "http://localhost:8000";
async function POST({ request }) {
  try {
    const body = await request.json();
    const { message, module_token, student_id } = body;
    if (!message || !module_token) {
      return new Response("Missing message or module_token.", { status: 400 });
    }
    const baseUrl = API_BASE_URL;
    if (!baseUrl) ;
    const url = `${baseUrl}/api/widget/chat?module_token=${module_token}`;
    const apiResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message,
        student_id
      })
    });
    if (!apiResponse.ok) {
      const error = await apiResponse.text();
      return new Response(error, { status: apiResponse.status });
    }
    const responseData = await apiResponse.json();
    return new Response(
      JSON.stringify({
        response: responseData.response,
        module_name: responseData.module_name,
        files_used: responseData.files_used
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Internal error in /api/submit route:", err);
    return new Response("Internal server error.", { status: 500 });
  }
}

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
