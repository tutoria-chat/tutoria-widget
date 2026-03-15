# UP Business Mode - Widget Integration

## Overview

The tutoria-widget now supports **UP Business Game** mode, enabling students to interact with an AI tutor specialized in the UP Business Game without requiring a module token. This mode uses UP API Key authentication and provides automatic conversation persistence via `up_id`.

---

## What's New

### Two Authentication Modes

| Mode | Authentication | Use Case | Conversation Persistence |
|------|----------------|----------|-------------------------|
| **Module Mode** (existing) | `module_token` | Regular tutoria courses | Optional (via `conversation_id`) |
| **UP Business Mode** (new) | `up_api_key` | UP Business Game | **Automatic** (via `up_id`) |

---

## UP Business Mode Features

### ✅ Enabled Features
- **UP API Key Authentication** - No module token required
- **Automatic Conversation Persistence** - If `up_id` is provided
- **Team Identification** - Display team name in header
- **Temporary Conversations** - If no `up_id`, conversation lost on close
- **Specialized AI Tutor** - UP Business Game specific responses
- **File Upload Support** (backend only) - Not available in widget
- **Multi-language** - English responses by default

### ⚠️ Disabled Features (in UP Mode)
- Module information loading (no module)
- File downloads (no files panel)
- Permission checks (not applicable)

---

## URL Parameters

### Required Parameters (Choose One)

**For UP Business Mode**:
```
up_api_key=your-up-business-api-key
```

**For Module Mode** (existing):
```
module_token=64-character-module-token
```

### Optional Parameters (UP Business Mode)

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `up_id` | string | User/team identifier for conversation persistence | `&up_id=student-42` |
| `team_name` | string | Team name to display in header | `&team_name=Team%20Alpha` |
| `dark` | "auto"\|"true"\|"false" | Theme control | `&dark=auto` |
| `buttonColor` | hex (no #) | Send button color | `&buttonColor=3b82f6` |
| `userMessageColor` | hex (no #) | User message bg color | `&userMessageColor=e5e7eb` |
| `agentMessageColor` | hex (no #) | AI message bg color | `&agentMessageColor=f3f4f6` |

---

## Usage Examples

### Example 1: UP Mode with Persistent Conversation

**Scenario**: Student with `up_id` gets automatic conversation continuity.

```html
<iframe
  src="https://tutoria-widget.vercel.app/?up_api_key=your-key-here&up_id=student-42&team_name=Team%20Alpha"
  width="100%"
  height="600px"
  style="border: none; border-radius: 8px;">
</iframe>
```

**What Happens**:
1. First visit: New conversation created, stored with `up_id`
2. Future visits: Same `up_id` → automatically continues previous conversation
3. AI has context from all previous questions
4. Conversation persists even if student closes widget

---

### Example 2: UP Mode without `up_id` (Temporary)

**Scenario**: Anonymous user or one-off questions.

```html
<iframe
  src="https://tutoria-widget.vercel.app/?up_api_key=your-key-here"
  width="100%"
  height="600px"
  style="border: none; border-radius: 8px;">
</iframe>
```

**What Happens**:
1. New conversation created each session
2. Conversation works during session
3. Closing widget → conversation lost (no persistence)
4. Next visit → fresh conversation (no history)

---

### Example 3: UP Mode with Team Name

**Scenario**: Display custom team name in widget header.

```html
<iframe
  src="https://tutoria-widget.vercel.app/?up_api_key=your-key-here&up_id=team-5&team_name=Innovators%20Inc"
  width="100%"
  height="600px"
  style="border: none; border-radius: 8px;">
</iframe>
```

**Widget Header Shows**:
```
UP Business Game
Innovators Inc
```

---

### Example 4: UP Mode with Custom Colors

```html
<iframe
  src="https://tutoria-widget.vercel.app/?up_api_key=your-key&up_id=user123&buttonColor=10b981&userMessageColor=dcfce7&agentMessageColor=f0fdf4"
  width="100%"
  height="600px"
  style="border: none; border-radius: 8px;">
</iframe>
```

---

## How Conversation Persistence Works

### With `up_id` (Persistent)

```
┌─────────────────────────────────────────────────────────┐
│ First Request                                           │
│ up_id: "student-42"                                     │
│ ↓                                                        │
│ Backend: Creates team → generates conversation_id       │
│ Backend: Stores conversation_id in UpBusinessTeams      │
│ ↓                                                        │
│ Widget: Stores conversation_id in React state           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Second Request (Same Session)                           │
│ up_id: "student-42"                                     │
│ conversation_id: Already in state                       │
│ ↓                                                        │
│ Backend: Uses provided conversation_id                  │
│ Backend: Retrieves previous messages                    │
│ ↓                                                        │
│ AI: Generates response with full context                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Third Request (NEW SESSION - Widget Closed & Reopened) │
│ up_id: "student-42"                                     │
│ conversation_id: NOT in state (widget reloaded)         │
│ ↓                                                        │
│ Backend: Looks up up_id → finds stored conversation_id  │
│ Backend: Automatically retrieves conversation history   │
│ ↓                                                        │
│ Widget: Receives conversation_id in response            │
│ Widget: Stores conversation_id in state                 │
│ ↓                                                        │
│ AI: Continues conversation with full history!           │
└─────────────────────────────────────────────────────────┘
```

### Without `up_id` (Temporary)

```
┌─────────────────────────────────────────────────────────┐
│ First Request                                           │
│ up_id: NOT PROVIDED                                     │
│ ↓                                                        │
│ Backend: Generates conversation_id                      │
│ Backend: Does NOT store (no up_id to link to)          │
│ ↓                                                        │
│ Widget: Stores conversation_id in React state           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Second Request (Same Session)                           │
│ conversation_id: In state                               │
│ ↓                                                        │
│ Backend: Uses provided conversation_id                  │
│ Backend: Retrieves messages from DynamoDB (if enabled)  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Third Request (NEW SESSION - Widget Closed & Reopened) │
│ up_id: STILL NOT PROVIDED                               │
│ conversation_id: LOST (widget reloaded)                 │
│ ↓                                                        │
│ Backend: Generates NEW conversation_id                  │
│ ↓                                                        │
│ Result: Fresh conversation, no history                  │
└─────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### API Client Changes

**File**: `src/lib/api-client.ts`

New method added:

```typescript
async sendUpBusinessChatMessage(params: {
  upApiKey: string;
  message: string;
  upId?: string;
  conversationId?: string | null;
  teamName?: string;
}): Promise<any>
```

**Endpoint**: `POST /api/upbusiness/chat`

**Authentication**: `X-API-Key` header (not query parameter)

**Request Format**: `multipart/form-data` (not JSON)

**Response**: Normalized to match widget expectations:
```typescript
{
  response: string,           // AI response text
  conversation_id: string,    // Thread ID
  files_used: any[]          // (Not used in widget)
}
```

---

### ChatForm Changes

**File**: `src/components/ChatForm.tsx`

#### 1. Parameter Parsing (lines 74-77)

```typescript
const upId = params.get('up_id') || '';
const upApiKey = params.get('up_api_key') || '';
const teamName = params.get('team_name') || '';
```

#### 2. Mode Detection (lines 90-91)

```typescript
const isProfessorMode = !!professorAgentToken;
const isUpBusinessMode = !!upApiKey;
```

#### 3. handleSubmit Updates (lines 232-240)

```typescript
if (isUpBusinessMode) {
  // UP Business mode
  data = await apiClient.sendUpBusinessChatMessage({
    upApiKey,
    message: currentMessage,
    upId: upId || undefined,
    teamName: teamName || undefined,
    conversationId,
  });
}
```

#### 4. UI Updates

**Header** (lines 400-406):
```typescript
{isUpBusinessMode ? (
  <>
    <CardTitle className="text-lg">UP Business Game</CardTitle>
    <p className="text-sm text-muted-foreground">
      {teamName || (upId ? `Team ${upId}` : 'AI Tutor')}
    </p>
  </>
) : ...}
```

**Empty State** (lines 476-480):
```typescript
{isUpBusinessMode
  ? 'How can I help you with the UP Business Game?'
  : moduleInfo
  ? `Qual sua dúvida sobre ${moduleInfo.module_name}?`
  : 'Qual sua dúvida?'}
```

**Files Panel**: Hidden in UP mode (line 418)
```typescript
{!isUpBusinessMode && moduleInfo?.permissions.allow_file_access && ...}
```

**Module Info Fetch**: Skipped in UP mode (line 189)
```typescript
if (!isUpBusinessMode) {
  fetchModuleInfo();
}
```

---

## Error Handling

### Authentication Errors

**401/403 Response**:
```
🔑 Your UP Business API key is invalid or expired. Please contact support.
```

### Network Errors

**Timeout**:
```
⏱️ Request timed out. The server is taking too long to respond. Please try again.
```

**Connection Error**:
```
🔌 Network error. Please check your internet connection.
```

### Rate Limiting

**429 Response**:
```
🚦 Too many requests. Please wait a moment before trying again.
```

---

## Security Considerations

### UP API Key

- **Never expose in public code** - Pass via secure URL parameters
- **Server-side validation** - Backend verifies key against `UP_BUSINESS_API_KEY` env var
- **Header-based** - Sent via `X-API-Key` header (not query param)
- **Single key** - One key per environment (not per user)

### Conversation Privacy

- **up_id-based isolation** - Each `up_id` has separate conversation
- **No cross-talk** - User A cannot access User B's conversation
- **Optional persistence** - Users without `up_id` get temporary conversations

### CORS & Embedding

- Widget designed for iframe embedding
- CORS handled by backend API
- Safe to embed in LMS platforms (Moodle, Canvas, etc.)

---

## Testing

### Local Testing

**Test URL**:
```
http://localhost:4321/?up_api_key=test-key&up_id=test-user&team_name=Test%20Team
```

**Test Without up_id**:
```
http://localhost:4321/?up_api_key=test-key
```

### Test Scenarios

#### ✅ Test 1: First Message with up_id

1. Open widget with `up_id=test-1`
2. Send message: "What is UP Business Game?"
3. Check response received
4. Check browser console: "Conversation ID: xxx"

**Expected**: New conversation created and stored.

---

#### ✅ Test 2: Second Message (Same Session)

1. Continue from Test 1 (don't reload)
2. Send message: "What should I do next?"
3. Check if AI references previous context

**Expected**: AI responds with context from first message.

---

#### ✅ Test 3: Widget Reload (Persistence Check)

1. Note the `up_id` from Test 1
2. Close widget (or reload page)
3. Open widget again with **same** `up_id`
4. Send message: "Remind me what we discussed?"

**Expected**: AI has full conversation history, references previous questions.

---

#### ✅ Test 4: No up_id (Temporary)

1. Open widget **without** `up_id` parameter
2. Send several messages
3. Close widget
4. Open widget again (still no `up_id`)

**Expected**: New conversation, no history from previous session.

---

#### ✅ Test 5: Invalid API Key

1. Open widget with `up_api_key=invalid-key`
2. Send message

**Expected**: Error message about invalid API key.

---

#### ✅ Test 6: Custom Team Name

1. Open widget with `team_name=My%20Custom%20Team`
2. Check header displays "My Custom Team"

**Expected**: Header shows: "UP Business Game / My Custom Team"

---

## Deployment

### Environment Variables

**Backend** (`tutoria-api`):
```bash
UP_BUSINESS_API_KEY=your-secure-api-key-here
```

**Widget** (no env vars needed):
- API key passed via URL parameter
- All configuration via URL

### Production URL

**Deployed Widget**:
```
https://tutoria-widget.vercel.app/
```

**Example Production Embed**:
```html
<iframe
  src="https://tutoria-widget.vercel.app/?up_api_key=prod-key&up_id={{student_id}}&team_name={{team_name}}"
  width="100%"
  height="600px"
  style="border: none; border-radius: 8px;">
</iframe>
```

---

## Comparison: Module Mode vs UP Mode

| Feature | Module Mode | UP Mode |
|---------|-------------|---------|
| **Authentication** | `module_token` (64 chars) | `up_api_key` |
| **User Identification** | `student_id` (optional) | `up_id` (optional) |
| **Conversation Persistence** | Manual (`conversation_id`) | **Automatic** (via `up_id`) |
| **Module Information** | Yes (name, semester, year) | No (not applicable) |
| **File Downloads** | Yes (if enabled) | No |
| **Permissions Check** | Yes (`allow_chat`, `allow_file_access`) | No (always allowed) |
| **Backend Endpoint** | `/api/widget/chat` | `/api/upbusiness/chat` |
| **Language** | Portuguese (default) | English (default) |
| **Use Case** | University courses | UP Business Game |

---

## Future Enhancements

### Planned Features

- [ ] **File Upload in Widget** - Allow students to upload reports via widget
- [ ] **Conversation History UI** - Display previous messages on reload
- [ ] **Multi-conversation Support** - Switch between different conversation threads
- [ ] **Export Conversation** - Download conversation as PDF/text
- [ ] **Voice Input** - Speech-to-text for questions
- [ ] **Offline Mode** - Queue messages when offline

---

## Troubleshooting

### Issue: "Authentication required" error

**Cause**: Missing `up_api_key` parameter

**Solution**: Add `?up_api_key=your-key` to URL

---

### Issue: Conversation not persisting across sessions

**Cause**: Missing `up_id` parameter

**Solution**: Add `&up_id=student-id` to URL for persistence

---

### Issue: "Invalid or expired UP Business API key"

**Cause**: Wrong API key or backend `UP_BUSINESS_API_KEY` not set

**Solution**:
1. Verify API key matches backend env var
2. Check backend logs: "UP_BUSINESS_API_KEY not set - allowing access"

---

### Issue: Widget shows "Carregando módulo..." forever

**Cause**: Widget in module mode but no module token

**Solution**: Ensure `up_api_key` is provided (not `module_token`)

---

## Development Tips

### Testing Locally with Backend

1. **Start tutoria-api**:
   ```bash
   cd tutoria-api
   uvicorn app.main:app --reload --port 8000
   ```

2. **Start tutoria-widget**:
   ```bash
   cd tutoria-widget
   npm run dev  # http://localhost:4321
   ```

3. **Test URL**:
   ```
   http://localhost:4321/?up_api_key=test&up_id=dev-user
   ```

### Debugging Conversation Persistence

**Check Backend Logs**:
```bash
# tutoria-api logs
📚 Found existing team with stored conversation ID: abc-123
🔄 Using team's stored conversation ID: abc-123
📖 Loaded 5 previous messages from conversation history
```

**Check Database**:
```sql
SELECT TeamName, UpId, ConversationId
FROM UpBusinessTeams
WHERE UpId = 'your-up-id';
```

**Check Browser Console**:
```
Conversation ID: abc-123-def-456
```

---

## Conclusion

UP Business Mode provides a seamless way to integrate the UP Business Game AI tutor into any platform. With automatic conversation persistence via `up_id`, students can have continuous, context-aware conversations without manually managing conversation IDs.

**Key Benefits**:
- ✅ No module token required
- ✅ Automatic conversation continuity
- ✅ Specialized UP Business AI
- ✅ Simple URL-based configuration
- ✅ Iframe-embeddable

**Deployment Status**: ✅ Ready for production

**Breaking Changes**: ❌ None - fully backward compatible with module mode

---

## Additional Resources

- **Backend Documentation**: `tutoria-api/UP_BUSINESS_CONVERSATION_LINKING.md`
- **Widget README**: `tutoria-widget/README.md`
- **API Guide**: `tutoria-api/UP_BUSINESS_API_GUIDE.md`
