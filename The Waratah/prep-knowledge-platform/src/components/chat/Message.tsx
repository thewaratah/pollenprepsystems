'use client';

import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { Message as MessageType } from '@/types/chat';

interface MessageProps {
  message: MessageType;
}

export function Message({ message }: MessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex gap-3 p-4',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          className={cn(
            'text-xs font-medium',
            isUser
              ? 'bg-[#4A5D23] text-white'
              : 'bg-gradient-to-br from-orange-400 to-pink-500 text-white'
          )}
        >
          {isUser ? 'You' : 'AI'}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          'flex-1 space-y-2',
          isUser ? 'text-right' : 'text-left'
        )}
      >
        <div
          className={cn(
            'inline-block rounded-2xl px-4 py-2 max-w-[85%]',
            isUser
              ? 'bg-[#4A5D23] text-white rounded-br-md'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-md'
          )}
        >
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {message.content}
          </div>
        </div>

        {/* Sources citation */}
        {message.sources && message.sources.length > 0 && (
          <div className="text-xs text-zinc-500 mt-2">
            <span className="font-medium">Sources:</span>
            <ul className="mt-1 space-y-1">
              {message.sources.map((source) => (
                <li key={source.id} className="flex items-center gap-1">
                  <span className="text-zinc-400">•</span>
                  <span className="truncate">{source.filename}</span>
                  <span className="text-zinc-400">
                    ({Math.round(source.similarity * 100)}%)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
