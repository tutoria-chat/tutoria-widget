# Tutoria Widget v2.0

Este projeto é um **front-end leve e responsivo** que conecta com a **Tutoria API v2.0**, desenvolvido para ser **embedado via `iframe`** em plataformas de ensino (como Moodle, Canvas, ou portais institucionais). Ele serve como interface de um **chatbot com IA**, que **responde perguntas apenas com base no conteúdo de um módulo específico**, garantindo confiabilidade e foco no material da instituição.

---

## ✨ Funcionalidades

- ✅ **Interface minimalista e acessível** adaptada para iframe
- 🧠 **Respostas geradas por IA** com base no conteúdo específico do módulo
- 🔐 **Autenticação por token de módulo** sem necessidade de login do estudante
- 📁 **Download de arquivos** do módulo (se habilitado pelo professor)
- 🌗 **Suporte a tema escuro** automático ou forçado via parâmetros
- 🖼️ **Fácil integração** com qualquer LMS via iframe
- ⚙️ **Personalização** por parâmetros na URL (cores, tema, etc.)
- 📊 **Analytics** opcional com identificação externa do estudante

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
3. Configure as variáveis de ambiente:
    ```bash
    cp .env.example .env
    ```
    Edite o arquivo `.env` e configure:
    ```env
    PUBLIC_API_BASE_URL=http://localhost:8000
    ```
    - `PUBLIC_API_BASE_URL`: URL base da API Tutoria v2.0
      - Desenvolvimento local: `http://localhost:8000`
      - Produção: URL do seu servidor de API

> **⚠️ Importante**: Nunca commite o arquivo `.env` no git! Ele já está no `.gitignore` para sua segurança.

## 🚀 Execução local
```bash
npm run dev
```

Por padrão, a aplicação roda em `http://localhost:4321.`

## 🌐 Deploy em Produção

### Vercel (Recomendado)

1. **Faça push do código para o GitHub** (certifique-se de que `.env` não foi commitado!)
2. **Importe o projeto no Vercel**:
   - Acesse [vercel.com](https://vercel.com)
   - Clique em "Import Project"
   - Selecione seu repositório GitHub
3. **Configure as variáveis de ambiente** no Vercel:
   - Vá em **Settings** → **Environment Variables**
   - Adicione:
     - `PUBLIC_API_BASE_URL`: URL da sua API em produção
       ```
       https://tutoria-api-dev.orangesmoke-8addc8f4.eastus2.azurecontainerapps.io
       ```
4. **Deploy**: O Vercel fará o deploy automaticamente a cada push!

> **🔒 Segurança**: As variáveis de ambiente configuradas no Vercel são privadas e seguras. Apenas variáveis com prefixo `PUBLIC_` são expostas no cliente.

### Outras Plataformas
Para Netlify, Cloudflare Pages, ou outras plataformas:
- Configure `PUBLIC_API_BASE_URL` nas variáveis de ambiente da plataforma
- Build command: `npm run build`
- Output directory: `dist/`

## 🧩 Uso via iframe
Você pode embedar o chatbot em qualquer página com o seguinte código:
```html
<iframe
  src="https://seu-dominio.com/?module_token=SEU_TOKEN_DE_MODULO&dark=auto"
  width="100%"
  height="600px"
  loading="lazy"
></iframe>
```

### Como obter o token de módulo
1. Acesse a API Tutoria v2.0 como professor
2. Crie um token de acesso para o módulo desejado em `/api/v2/module-tokens/`
3. Use o token de 64 caracteres no parâmetro `module_token`

### Parâmetros suportados
- `module_token`: **Obrigatório**. Token de 64 caracteres para autenticação do módulo.
- `student_id`: Opcional. Identificador externo do estudante para analytics.
- `dark`: Controla o tema do widget. Valores:
    - `auto`: usa a preferência do usuário (padrão)
    - `true`: força modo escuro
    - `false`: força modo claro
- `buttonColor`: Cor do botão de enviar em hexcode sem o `#`.
- `userMessageColor`: Cor do fundo do balão da mensagem do usuário em hexcode sem o `#`.
- `agentMessageColor`: Cor do fundo do balão da mensagem do agente em hexcode sem o `#`.

### Funcionalidades do Widget
- **Chat com IA**: Conversa com tutor virtual baseado no conteúdo do módulo
- **Download de arquivos**: Acesso aos materiais de estudo (se habilitado)
- **Interface responsiva**: Funciona em desktop e mobile
- **Tema customizável**: Suporte a modo claro/escuro
- **Sem login necessário**: Estudantes acessam via token do módulo