'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Suggested prompts that showcase the Super Agent's capabilities
const suggestedPrompts = [
  "Explain our house sugar syrup recipe (47.5 brix)",
  "What is a suitable replacement for citric acid?",
  "How can I prevent the fermentation of non alcoholic cocktails?",
  "What is the ABV of our Mule batch?",
];

// Generate a unique session ID
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function PrepAgentChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(generateSessionId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Commit current conversation to memory (fire and forget)
  const commitToMemory = useCallback(async (msgs: Message[], sid: string) => {
    if (msgs.length === 0) return;

    try {
      // Send a special request to commit the conversation
      await fetch('/api/chat/commit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sid,
        },
        body: JSON.stringify({
          sessionId: sid,
          messages: msgs.map((m) => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp.toISOString(),
          })),
        }),
      });
    } catch (error) {
      console.error('Failed to commit conversation to memory:', error);
    }
  }, []);

  // Start a new chat
  const handleNewChat = useCallback(() => {
    // Commit current conversation to memory in the background
    commitToMemory(messages, sessionId);

    // Generate new session and clear messages
    setSessionId(generateSessionId());
    setMessages([]);
    setInput('');
  }, [messages, sessionId, commitToMemory]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    // Add user message and create placeholder for assistant
    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Build message history for the API (include previous messages)
      const messageHistory = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Call the Super Agent endpoint with streaming
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
        },
        body: JSON.stringify({ messages: messageHistory }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      // Add placeholder for streaming assistant message
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        },
      ]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Decode the chunk and accumulate
          const chunk = decoder.decode(value, { stream: true });
          accumulatedContent += chunk;

          // Update the assistant message with accumulated content
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: accumulatedContent }
                : m
            )
          );
        }
      }

      // If no content was received, show error
      if (!accumulatedContent.trim()) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "I couldn't generate a response. Please try again." }
              : m
          )
        );
      }
    } catch (error) {
      console.error('Chat error:', error);
      // Add error message
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== assistantId),
        {
          id: assistantId,
          role: 'assistant',
          content: 'Sorry, I encountered an error connecting to the Super Agent. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
  };

  const hasMessages = messages.length > 0;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex flex-col items-center gap-1 group"
        aria-label="Open PREP AGENT"
      >
        <span
          className="text-xs font-bold tracking-wide opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: '#4A5D23' }}
        >
          SUPER AGENT
        </span>
        <div
          className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110"
          style={{ backgroundColor: '#4A5D23' }}
        >
          <Image
            src="/brand/waratah-agent.png"
            alt="PREP AGENT"
            width={36}
            height={36}
            className="rounded-full"
          />
        </div>
      </button>

      {/* Full-screen Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal Content */}
          <div
            className="relative w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            style={{ backgroundColor: '#f5f4f0' }}
          >
            {/* Header */}
            <div
              className="px-6 py-5 border-b flex items-center justify-between"
              style={{ backgroundColor: '#4A5D23', borderColor: '#4A5D23' }}
            >
              <div className="flex items-center gap-4">
                <Image
                  src="/brand/waratah-agent.png"
                  alt="PREP AGENT"
                  width={48}
                  height={48}
                  className="rounded-full"
                />
                <div>
                  <h2 className="text-xl font-bold text-white">PREP SUPER AGENT</h2>
                  <p className="text-sm text-white/70">Intelligent Operations Hub • Claude Sonnet 4</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* New Chat Button */}
                {hasMessages && (
                  <button
                    onClick={handleNewChat}
                    className="px-3 py-2 rounded-lg flex items-center gap-2 text-white/70 hover:text-white hover:bg-white/10 transition-colors text-sm"
                    aria-label="New Chat"
                    disabled={isLoading}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New Chat
                  </button>
                )}
                {/* Close Button */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {!hasMessages ? (
                <>
                  {/* Introduction */}
                  <div
                    className="rounded-xl p-5 mb-6"
                    style={{ backgroundColor: 'white', border: '1px solid #e5e5e5' }}
                  >
                    <p className="text-base leading-relaxed mb-3" style={{ color: '#1a1a1a' }}>
                      <strong>PREP SUPER AGENT</strong> is the intelligent brain of The Waratah operations. Powered by Claude Sonnet 4
                      with access to 87,000+ knowledge documents, real-time Airtable data, and operational tools.
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm" style={{ color: '#666' }}>
                      <div>✓ Check stocktake status</div>
                      <div>✓ Look up any recipe</div>
                      <div>✓ Scale recipes by constraint</div>
                      <div>✓ Get prep run progress</div>
                      <div>✓ Food science knowledge</div>
                      <div>✓ Remembers conversation</div>
                    </div>
                  </div>

                  {/* Suggested Prompts */}
                  <div className="mb-6">
                    <h3
                      className="text-sm font-semibold mb-3 uppercase tracking-wide"
                      style={{ color: '#8a8a8a' }}
                    >
                      Suggested Questions
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {suggestedPrompts.map((prompt, index) => (
                        <button
                          key={index}
                          onClick={() => handlePromptClick(prompt)}
                          className="text-left p-4 rounded-lg transition-all hover:shadow-md"
                          style={{
                            backgroundColor: 'white',
                            border: '1px solid #e5e5e5',
                            color: '#1a1a1a',
                          }}
                        >
                          <span className="text-sm">{prompt}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                /* Chat Messages */
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] px-4 py-3 rounded-xl text-sm ${
                          msg.role === 'user'
                            ? 'text-white'
                            : ''
                        }`}
                        style={
                          msg.role === 'user'
                            ? { backgroundColor: '#4A5D23' }
                            : { backgroundColor: 'white', border: '1px solid #e5e5e5', color: '#1a1a1a' }
                        }
                      >
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div
                        className="px-4 py-3 rounded-xl"
                        style={{ backgroundColor: 'white', border: '1px solid #e5e5e5' }}
                      >
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input Area */}
            <form
              onSubmit={handleSubmit}
              className="px-6 py-4 border-t"
              style={{ backgroundColor: 'white', borderColor: '#e5e5e5' }}
            >
              <div className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask me about stocktake, recipes, prep status..."
                  className="flex-1 px-4 py-3 rounded-lg text-sm focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: '#f5f4f0',
                    border: '1px solid #e5e5e5',
                    color: '#1a1a1a',
                  }}
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="px-6 py-3 rounded-lg text-white font-medium text-sm transition-colors hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#d85a3a' }}
                >
                  Send
                </button>
              </div>
              <p className="mt-2 text-xs text-center" style={{ color: '#8a8a8a' }}>
                Powered by Claude Sonnet 4 • RAG Knowledge Base • Real-time Tools
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
