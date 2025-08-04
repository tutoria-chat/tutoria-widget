# Chatbot Widget para Disciplinas

Este projeto é um **front-end leve e responsivo**, desenvolvido para ser **embedado via `iframe`** em plataformas de ensino (como Moodle, Canvas, ou portais institucionais). Ele serve como interface de um **chatbot com IA**, que **responde perguntas apenas com base no conteúdo de uma disciplina específica**, garantindo confiabilidade e foco no material da instituição.

---

## ✨ Funcionalidades

- ✅ Interface minimalista e acessível.
- 🧠 Respostas geradas por IA com base no conteúdo da disciplina.
- 🔐 Prevenção contra alucinações: o modelo só responde se houver conteúdo relevante na base da disciplina.
- 🌗 Suporte a tema escuro automático ou forçado via parâmetros.
- 🖼️ Fácil integração com `iframe`.
- ⚙️ Personalização por parâmetros na URL.

---

## 📦 Instalação

1. Clone o projeto:
   ```bash
   git clone https://github.com/seu-usuario/chatbot-widget.git
   ```
2. Instale as dependências:
    ```bash
    npm install
    ```
3. Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:
    ```env
    PUBLIC_ENABLE_DARK_MODE=auto

    API_BASE_URL=https://api.sua-instituicao.com/
    API_AUTH_URL=https://api.sua-instituicao.com/auth
    API_AUTH_USERNAME=yourusername
    API_AUTH_PASSWORD=yourpassword
    ```
- `PUBLIC_ENABLE_DARK_MODE`: Controla se o suporte a tema escuro automático será habilitado (true ou false).
- `API_BASE_URL`: URL base da API do backend que recebe as mensagens e responde com o conteúdo da disciplina.
- `API_AUTH_URL`: URL da API do backend que autentifica o token de acesso.
- `API_BASE_USERNAME`: Usuário cadastrado na API do backend.
- `API_BASE_PASSWORD`: Senha cadastrada na API do backend.

## 🚀 Execução local
```bash
npm run dev
```

Por padrão, a aplicação roda em `http://localhost:4321.`

## 🧩 Uso via iframe
Você pode embedar o chatbot em qualquer página com o seguinte código:
```html
<iframe
  src="https://seu-dominio.com/chatbot?apiRoute=/disciplina-x&dark=auto"
  loading="lazy"
></iframe>
```
Apenas substitua o link no src pelo seu domínio.

### Parâmetros suportados
- `apiRoute`: Sufixo da rota da API (ex: `/disciplina-x`, `/materia-y`). Será concatenado com `API_BASE_URL`.
- `dark`: Controla o tema do widget. Valores:
    - `auto`: usa a preferência do usuário (padrão)
    - `true`: força modo escuro
    - `false`: força modo claro
- `buttonColor`: Cor do botão de enviar em hexcode sem o `#`.
- `userMessageColor`: Cor do fundo do balão da mensagem do usuário em hexcode sem o `#`.
- `agentMessageColor`: Cor do fundo do balão da mensagem do agente em hexcode sem o `#`.