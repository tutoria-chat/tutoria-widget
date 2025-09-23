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
3. Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:
    ```env
    PUBLIC_ENABLE_DARK_MODE=auto
    API_BASE_URL=http://localhost:8000
    ```
- `PUBLIC_ENABLE_DARK_MODE`: Controla se o suporte a tema escuro automático será habilitado (auto, true ou false).
- `API_BASE_URL`: URL base da API Tutoria v2.0 (padrão: http://localhost:8000).

## 🚀 Execução local
```bash
npm run dev
```

Por padrão, a aplicação roda em `http://localhost:4321.`

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