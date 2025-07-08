export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  console.log('Mensagem recebida:', req.body);

  res.json({
    response: `
**Olá! Aqui está uma resposta em Markdown.**

Você pode usar _itálico_, **negrito**, ou até mesmo \`código embutido\`.

### Lista de coisas:

- Item 1
- Item 2
- Item 3

### Código de exemplo

\`\`\`js
function digaOla(nome) {
  console.log(\`Olá, \${nome}!\`);
}
\`\`\`
`.trim(),
  });
}
