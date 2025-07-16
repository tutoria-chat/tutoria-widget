export const prerender = false;

const API_AUTH_URL = import.meta.env.API_AUTH_URL;
const API_AUTH_USERNAME = import.meta.env.API_AUTH_USERNAME;
const API_AUTH_PASSWORD = import.meta.env.API_AUTH_PASSWORD;

export async function POST() {
  if (!API_AUTH_URL || !API_AUTH_USERNAME || !API_AUTH_PASSWORD) {
    return new Response('Variáveis de ambiente de autenticação não configuradas', { status: 500 });
  }

  const response = await fetch(API_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: API_AUTH_USERNAME,
      password: API_AUTH_PASSWORD,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return new Response(errorText, { status: response.status });
  }

  const data = await response.json();
  const token = data?.token || data?.access;

  if (!token) {
    return new Response('Token não encontrado na resposta', { status: 500 });
  }

  return new Response(JSON.stringify({ token }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
