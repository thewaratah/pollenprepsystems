'use client';

import { useState, useCallback, useEffect } from 'react';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { PrepStatusCard } from '@/components/prep';
import type { Message, DocumentSource } from '@/types/chat';

const CATEGORIES = [
  { id: 'all', label: 'All Knowledge' },
  { id: 'food-science', label: 'Food Science' },
  { id: 'cocktails', label: 'Cocktails' },
  { id: 'fermentation', label: 'Fermentation' },
  { id: 'prep-ops', label: 'Prep Operations' },
];

interface KnowledgeStats {
  totalDocuments: number;
  totalChunks: number;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [stats, setStats] = useState<KnowledgeStats | null>(null);

  // Fetch knowledge base stats on mount
  useEffect(() => {
    fetch('/api/stats')
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(() => setStats(null));
  }, []);

  // Search for relevant sources
  const searchSources = async (query: string): Promise<DocumentSource[]> => {
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          limit: 5,
          category: selectedCategory,
        }),
      });

      if (!response.ok) return [];

      const data = await response.json();
      return data.sources || [];
    } catch {
      console.error('Search failed');
      return [];
    }
  };

  const handleSubmit = useCallback(async (content: string) => {
    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Search for sources first (in parallel with chat request)
      const sourcesPromise = searchSources(content);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      // Get sources
      const sources = await sourcesPromise;

      // Add assistant message placeholder with sources
      const assistantMessageId = crypto.randomUUID();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        sources: sources.length > 0 ? sources : undefined,
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      // Read stream
      let fullContent = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        // Handle plain text stream (toTextStreamResponse)
        fullContent += chunk;
        setMessages((prev) => {
          const updated = [...prev];
          const lastMessage = updated[updated.length - 1];
          if (lastMessage?.role === 'assistant' && lastMessage.id === assistantMessageId) {
            lastMessage.content = fullContent;
          }
          return [...updated];
        });
      }
    } catch (error) {
      console.error('Chat error:', error);

      // Add error message
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          createdAt: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, selectedCategory]);

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center">
              <span className="text-white text-sm font-bold">P</span>
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                PREP Agent
              </h1>
              <p className="text-xs text-zinc-500">
                Knowledge assistant for food science & prep operations
              </p>
            </div>
            <div className="flex items-center gap-3">
              <PrepStatusCard />
              {stats && stats.totalDocuments > 0 && (
                <div className="text-right">
                  <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                    {stats.totalDocuments.toLocaleString()} docs
                  </div>
                  <div className="text-xs text-zinc-500">
                    {stats.totalChunks.toLocaleString()} chunks indexed
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Category filter */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-orange-500 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Messages */}
      <MessageList messages={messages} isLoading={isLoading} />

      {/* Input */}
      <ChatInput onSubmit={handleSubmit} isLoading={isLoading} />
    </div>
  );
}
