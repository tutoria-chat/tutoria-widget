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

---

## 🔧 Troubleshooting & Reliability Features

### Automatic Error Recovery

The widget now includes **robust error handling** to prevent random failures:

#### Built-in Reliability Features
- ✅ **Automatic Retry Logic**: Failed requests automatically retry up to 3 times
- ✅ **Exponential Backoff**: Intelligent waiting between retries (1s → 2s → 4s)
- ✅ **Request Timeout**: 60-second timeout for AI responses, 15s for metadata
- ✅ **Connection Keep-Alive**: Reuses connections to prevent cold starts
- ✅ **Jitter Prevention**: Random delays prevent thundering herd issues
- ✅ **Graceful Degradation**: User-friendly error messages instead of crashes

### Common Issues & Solutions

#### Issue: Widget stops working after 2 days of inactivity

**Cause**: Serverless cold starts on Vercel

**Solution**: The widget now automatically handles this with:
- Automatic request retries
- Extended timeouts for cold starts
- Keep-alive headers

**Action Required**: None - handled automatically

---

#### Issue: "Network error" or timeout messages

**Possible Causes**:
1. Backend API is down or slow
2. Network connectivity issues
3. CORS configuration problems

**Solutions**:
1. Check if `PUBLIC_API_BASE_URL` is correctly set in Vercel environment variables
2. Verify the API is responding: `curl https://your-api-url.com/health`
3. Check browser console for CORS errors
4. The widget will automatically retry 3 times with exponential backoff

---

#### Issue: "Invalid or expired token" after page refresh

**Cause**: Module access token has an expiration date

**Solution**:
1. Check token expiration in the database: `SELECT ExpiresAt FROM ModuleAccessTokens WHERE Token = '...'`
2. Generate a new token from the admin panel
3. Update the iframe URL with the new token

---

#### Issue: Requests fail randomly with no clear pattern

**Cause**: Network instability or rate limiting

**Solution**: The widget now includes:
- Automatic retry with exponential backoff
- Rate limit detection (429 status code)
- User-friendly error messages

**No action required** - the widget handles this automatically

---

### Vercel Deployment Best Practices

1. **Environment Variables**
   - Always set `PUBLIC_API_BASE_URL` in Vercel dashboard
   - Set for both Preview and Production environments
   - Redeploy after changing environment variables

2. **Monitoring**
   - Check Vercel logs for errors: `vercel logs`
   - Monitor browser console for client-side errors
   - Use Vercel Analytics for performance tracking

3. **Performance**
   - The widget uses static site generation (SSG)
   - No serverless functions needed in the widget itself
   - All dynamic content comes from the API

---

### Debug Mode

To see detailed logs of retry attempts and API calls:

1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Look for messages prefixed with `[API]`

Example output:
```
[API] Attempt 1/4 for https://api.example.com/widget/chat
[API] Success on attempt 1
```

Or in case of failures:
```
[API] Attempt 1/4 for https://api.example.com/widget/chat
[API] Retryable status 503, will retry
[API] Waiting 1234ms before retry 2
[API] Attempt 2/4 for https://api.example.com/widget/chat
[API] Success on attempt 2
```

---

### Health Check

The API client includes a health check method. To verify API connectivity:

```typescript
import { apiClient } from '@/lib/api-client';

const isHealthy = await apiClient.healthCheck();
console.log('API is reachable:', isHealthy);
```

---

## 📊 API Reliability Metrics

The widget automatically retries failed requests with these parameters:

| Metric | Value |
|--------|-------|
| Max Retries | 3 attempts |
| Initial Delay | 1 second |
| Max Delay | 10 seconds |
| Backoff Multiplier | 2x |
| Chat Timeout | 60 seconds |
| Metadata Timeout | 15 seconds |
| Retryable Status Codes | 408, 429, 500, 502, 503, 504 |

---

## 🆘 Getting Help

If you encounter issues not covered in this troubleshooting guide:

1. **Check the logs**: Browser console + Vercel dashboard
2. **Verify environment**: Ensure `PUBLIC_API_BASE_URL` is set correctly
3. **Test the API directly**: Use curl or Postman to test endpoints
4. **Open an issue**: Include error logs and steps to reproduce

---