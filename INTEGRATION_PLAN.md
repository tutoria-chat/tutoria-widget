# Tutoria Widget - Conversation Threading Integration Plan

## Overview
Integrate the new DynamoDB-backed conversation threading features into the tutoria-widget to provide seamless conversation continuity and better user experience.

## Current State Analysis

### What Works ✅
- Basic chat functionality with markdown rendering
- Module token authentication
- Student ID parameter (optional)
- File download functionality
- Dark/light theme support
- Auto-scrolling chat interface

### What's Missing ❌
- Conversation persistence across page refreshes
- Conversation ID tracking
- Backend conversation history retrieval
- Message metadata display (model, provider)
- Clear conversation functionality
- LocalStorage for conversation continuity
- Anonymous user support (no student_id required)

## Implementation Plan

### Phase 1: Conversation ID Management

#### 1.1 LocalStorage Key Structure
```typescript
// Key format: `tutoria_conversation_${moduleToken}_${studentId || 'anonymous'}`
// Stores: { conversationId: string, lastMessageAt: number, messageCount: number }
```

#### 1.2 Conversation ID Lifecycle
- **On component mount**: Check localStorage for existing conversation_id
- **On first message**: If no conversation_id, backend generates UUID and returns it
- **On subsequent messages**: Send existing conversation_id from localStorage
- **On clear conversation**: Remove from localStorage, generate new conversation_id

#### 1.3 Anonymous User Support
- If `student_id` param not provided, use `studentId = 0` or omit it
- Backend already handles this (defaults to 0 for anonymous)
- Conversation still persisted per module token in localStorage

### Phase 2: API Integration Updates

#### 2.1 Update POST /api/widget/chat Request
```typescript
// Current
{
  message: string,
  student_id?: string
}

// New
{
  message: string,
  student_id?: string,
  conversation_id?: string  // Send existing conversation_id if available
}
```

#### 2.2 Handle Response Metadata
```typescript
// Backend returns
{
  response: string,
  module_name: string,
  files_used: string[],
  conversation_id: string,    // NEW - Store in localStorage
  message_id?: string,        // NEW - For debugging/tracking
  model_used?: string,        // NEW - Display in UI
  provider?: string           // NEW - Display in UI
}
```

#### 2.3 Update Message Interface
```typescript
interface ChatMessage {
  content: string;
  role: 'user' | 'assistant';
  timestamp?: number;
  messageId?: string;      // From backend response
  modelUsed?: string;      // e.g., "gpt-4o", "claude-3-5-sonnet"
  provider?: string;       // "openai" or "anthropic"
}
```

### Phase 3: UI Enhancements

#### 3.1 Conversation Metadata Display
**Location**: CardHeader (next to module info)

**Show**:
- AI Model badge (e.g., "GPT-4o" or "Claude 3.5 Sonnet")
- Message count in current conversation
- Optional: Provider logo/icon

**Example**:
```
Module Name                        [Model: GPT-4o] [5 msgs] [Clear]
2º Semestre, 2024
```

#### 3.2 Clear Conversation Button
**Location**: CardHeader (next to Files button)

**Functionality**:
- Clear all messages from state
- Remove conversation_id from localStorage
- Show confirmation dialog (optional)
- Show success toast/message

**Button**:
```tsx
<Button
  variant="outline"
  size="sm"
  onClick={handleClearConversation}
  className="flex items-center gap-2"
>
  <RotateCcw className="w-4 h-4" />
  Nova conversa
</Button>
```

#### 3.3 Message Metadata (Optional Enhancement)
**Show per message** (subtle, collapsed by default):
- Timestamp (relative: "2 minutes ago")
- Model used (icon or badge)
- Token count (if available)

**Example** (hover or click to expand):
```
[Assistant Message]
Response text here...
              [i] GPT-4o • 2 min ago • 150 tokens
```

### Phase 4: Persistence & Recovery

#### 4.1 Message History in localStorage
**Store messages** (optional, for offline viewing):
```typescript
// Key: `tutoria_messages_${conversationId}`
// Value: ChatMessage[] (limited to last 50 messages)
```

**Benefits**:
- Messages survive page refresh
- Better UX for students
- No need to re-fetch from backend

**Limitations**:
- Storage size limits (~5-10MB per domain)
- Need cleanup strategy (delete old conversations)

#### 4.2 Conversation Recovery
**On page load**:
1. Check localStorage for active conversation_id
2. Check if conversation is "recent" (< 24 hours since last message)
3. If yes: Load messages from localStorage
4. If no: Start fresh conversation

#### 4.3 Cleanup Strategy
- Delete conversations older than 7 days
- Keep only most recent 3 conversations per module
- Clear on logout (if auth added later)

### Phase 5: Error Handling & Edge Cases

#### 5.1 Conversation ID Mismatch
**Scenario**: Backend conversation_id doesn't match localStorage

**Solution**:
- Trust backend response
- Update localStorage with new conversation_id
- Log warning for debugging

#### 5.2 Stale Conversation
**Scenario**: Conversation ID exists but backend has no history (DynamoDB TTL expired)

**Solution**:
- Backend returns empty history (works already)
- AI responds without context
- Show warning: "Conversation history unavailable"

#### 5.3 Multiple Tabs
**Scenario**: User opens widget in multiple tabs

**Solution**:
- Each tab shares same conversation_id (localStorage)
- Messages might appear out of sync between tabs
- Consider using localStorage events to sync (advanced)

### Phase 6: Advanced Features (Future)

#### 6.1 Conversation History Sidebar
- List recent conversations (from localStorage)
- Click to switch between conversations
- Search within conversation history

#### 6.2 Export Conversation
- Download conversation as PDF or text
- Share conversation link (if backend supports)

#### 6.3 Feedback System
- Thumbs up/down on responses
- Report inappropriate responses
- Store feedback in backend

#### 6.4 Typing Indicators
- Show "AI is typing..." with animation
- Stream responses word-by-word (SSE/WebSocket)

## Implementation Checklist

### Must Have (MVP)
- [ ] Add conversation_id to state and localStorage
- [ ] Send conversation_id in POST requests
- [ ] Store returned conversation_id from backend
- [ ] Update ChatMessage interface with metadata
- [ ] Add "Clear Conversation" button
- [ ] Test anonymous users (no student_id)
- [ ] Test conversation continuity across refreshes

### Should Have
- [ ] Display AI model badge in header
- [ ] Show message count in conversation
- [ ] Store messages in localStorage
- [ ] Recover messages on page refresh
- [ ] Add confirmation dialog for clear conversation
- [ ] Show loading state for conversation recovery

### Nice to Have
- [ ] Message-level metadata (timestamp, tokens)
- [ ] Conversation cleanup strategy
- [ ] Multiple tab synchronization
- [ ] Toast notifications for actions
- [ ] Conversation expiry warning

## Code Changes Summary

### New State Variables
```typescript
const [conversationId, setConversationId] = useState<string | null>(null);
const [messageCount, setMessageCount] = useState(0);
const [currentModel, setCurrentModel] = useState<string | null>(null);
const [currentProvider, setCurrentProvider] = useState<string | null>(null);
```

### New Utility Functions
```typescript
// Get localStorage key for conversation
const getConversationKey = () =>
  `tutoria_conversation_${moduleToken}_${studentId || 'anonymous'}`;

// Load conversation from localStorage
const loadConversation = () => { ... };

// Save conversation to localStorage
const saveConversation = () => { ... };

// Clear conversation
const clearConversation = () => { ... };
```

### Updated API Call
```typescript
const response = await fetch(`${apiBaseUrl}/api/widget/chat?module_token=${moduleToken}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: currentMessage,
    student_id: studentId || undefined,  // Omit if not provided
    conversation_id: conversationId || undefined  // Send existing conversation_id
  }),
});

const data = await response.json();

// Store metadata from response
setConversationId(data.conversation_id);
setCurrentModel(data.model_used);
setCurrentProvider(data.provider);
setMessageCount(prev => prev + 1);

// Save to localStorage
saveConversation(data.conversation_id, messages.length + 1);
```

## Testing Checklist

### Functional Tests
- [ ] First message creates conversation_id
- [ ] Subsequent messages use same conversation_id
- [ ] Page refresh preserves conversation_id
- [ ] Clear conversation removes conversation_id
- [ ] Anonymous users (no student_id) work correctly
- [ ] Multiple modules use separate conversations
- [ ] Backend receives conversation history context

### Edge Case Tests
- [ ] Very long conversations (100+ messages)
- [ ] Rapid message sending
- [ ] Network failures during message send
- [ ] localStorage quota exceeded
- [ ] Invalid conversation_id handling
- [ ] Multiple tabs with same module

### UI/UX Tests
- [ ] Model badge displays correctly
- [ ] Message count updates accurately
- [ ] Clear button shows confirmation
- [ ] Loading states are clear
- [ ] Mobile responsiveness maintained
- [ ] Dark mode compatibility

## Dependencies
No new dependencies required! All features use existing libraries:
- localStorage API (built-in)
- React hooks (existing)
- Lucide icons (already installed)

## Rollout Plan

### Phase 1: Backend Validation (Week 1)
- Ensure backend handles conversation_id correctly
- Test with various scenarios (new, existing, invalid)
- Verify DynamoDB storage is working

### Phase 2: Core Features (Week 2)
- Implement conversation_id management
- Add localStorage persistence
- Update API integration
- Test basic conversation threading

### Phase 3: UI Polish (Week 3)
- Add metadata display
- Implement clear conversation
- Add visual indicators
- Test across browsers/devices

### Phase 4: Testing & QA (Week 4)
- Full functional testing
- Edge case validation
- Performance testing
- User acceptance testing

## Success Metrics
- Conversation continuity rate: >95% (messages maintain context)
- Anonymous user adoption: Track usage without student_id
- Average conversation length: Increase from 1-2 to 5-10 messages
- User satisfaction: Collect feedback on conversation quality
- Technical: Zero localStorage errors, <100ms overhead

## Notes
- **Student ID is optional**: Backend defaults to 0 for anonymous users
- **Conversation history**: Backend handles retrieval from DynamoDB
- **AI context**: Backend automatically includes previous messages
- **Scalability**: LocalStorage has ~5MB limit, plan cleanup strategy
- **Privacy**: Messages stored locally, cleared on conversation reset
