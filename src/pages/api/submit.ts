// src/pages/api/submit.ts
export const prerender = false;

const API_BASE_URL = import.meta.env.API_BASE_URL;

export async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json();
    const pergunta = body.pergunta;
    const suffix = body.suffix || '';
    const usuario = 'codephoenix';

    const token = request.headers.get('authorization')?.replace('Bearer ', '');

    if (!pergunta || !token) {
      return new Response('Pergunta ou token ausente.', { status: 400 });
    }

    const formData = new FormData();
    formData.append('usuario', usuario);
    formData.append('pergunta', pergunta);

    const baseUrl = API_BASE_URL;
    if (!baseUrl) {
      return new Response('API_BASE_URL não configurada.', { status: 500 });
    }
   
    const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    let url = base;
    if (suffix) {
    const suffixPath = suffix.startsWith('/') ? suffix : `/${suffix}`;
    url += suffixPath;
    }
    console.log(url)


    const apiResponse = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!apiResponse.ok) {
      const error = await apiResponse.text();
      return new Response(error, { status: apiResponse.status });
    }

    const resposta = await apiResponse.json();
    return new Response(
      JSON.stringify({ response: resposta?.resposta ?? resposta }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Erro interno na rota /api/submit:', err);
    return new Response('Erro interno no servidor.', { status: 500 });
  }
}
