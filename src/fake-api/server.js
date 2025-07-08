import express from 'express';
import cors from 'cors';
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.post('/chat', (req, res) => {
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
});

app.post('/test', (req, res) => {
  console.log('Mensagem recebida:', req.body);
  res.json({ 
    response: "Disciplina não escolhida, contate o administrador." 
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});