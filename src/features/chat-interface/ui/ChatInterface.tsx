'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Sparkles, MessageCircle, Lightbulb, Copy, Check } from 'lucide-react';
import { ChatMessage } from '@/types';
import { cn } from '@/shared/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatInterfaceProps {
  fileId: string;
  fileName: string;
}

interface HistoryItem {
  id: number;
  userMessage: string;
  aiResponse: string;
  timestamp: string;
}

// 마크다운 후처리 함수
function preprocessMarkdown(content: string): string {
  // 백틱-볼드 조합 수정: **`텍스트`** → **텍스트**
  let processed = content.replace(/\*\*`([^`]+)`\*\*/g, '**$1**');
  
  // 볼드-백틱 조합 수정: `**텍스트**` → **텍스트**
  processed = processed.replace(/`\*\*([^*]+)\*\*`/g, '**$1**');
  
  // 중첩된 백틱-볼드 조합들 추가 처리
  processed = processed.replace(/\*\*`([^`]*)`([^*]*)\*\*/g, '**$1$2**');
  processed = processed.replace(/`\*\*([^*]*)\*\*([^`]*)`/g, '**$1$2**');
  
  return processed;
}

// 마크다운 렌더링 컴포넌트
function MarkdownRenderer({ content, showCopyButton = false }: { content: string; showCopyButton?: boolean }) {
  const [copied, setCopied] = useState(false);

  // 마크다운 전처리
  const processedContent = preprocessMarkdown(content);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(processedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('복사 실패:', err);
    }
  };

  return (
    <div className="relative group">
      <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-headings:font-semibold prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-gray-900 prose-strong:font-bold prose-code:text-beige-800 prose-code:bg-beige-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-50 prose-pre:border prose-pre:border-gray-200 prose-blockquote:border-l-beige-400 prose-blockquote:bg-beige-50 prose-blockquote:text-gray-700 prose-table:text-sm prose-th:bg-beige-100 prose-th:text-gray-900 prose-th:font-semibold prose-td:border-beige-200 prose-ul:my-4 prose-ol:my-4 prose-li:my-1">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            table: ({ children }) => (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse border border-beige-200 rounded-lg">
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className="bg-beige-100">
                {children}
              </thead>
            ),
            th: ({ children }) => (
              <th className="border border-beige-200 px-4 py-3 text-left font-semibold text-gray-900 text-sm">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border border-beige-200 px-4 py-3 text-gray-700 text-sm">
                {children}
              </td>
            ),
            h1: ({ children }) => (
              <h1 className="text-3xl font-bold text-gray-900 mt-8 mb-4 first:mt-0 border-b border-gray-200 pb-2">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3 first:mt-0 border-b border-gray-200 pb-1">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-lg font-semibold text-gray-900 mt-4 mb-2 first:mt-0">
                {children}
              </h3>
            ),
            h4: ({ children }) => (
              <h4 className="text-base font-semibold text-gray-900 mt-3 mb-2 first:mt-0">
                {children}
              </h4>
            ),
            h5: ({ children }) => (
              <h5 className="text-sm font-semibold text-gray-900 mt-3 mb-1 first:mt-0">
                {children}
              </h5>
            ),
            h6: ({ children }) => (
              <h6 className="text-sm font-semibold text-gray-700 mt-3 mb-1 first:mt-0">
                {children}
              </h6>
            ),
            p: ({ children }) => (
              <p className="text-gray-700 leading-relaxed my-3 first:mt-0 last:mb-0">
                {children}
              </p>
            ),
            ul: ({ children }) => (
              <ul className="list-disc ml-6 space-y-1 my-4 text-gray-700 [&_ul]:list-[circle] [&_ul]:ml-6 [&_ul_ul]:list-[square] [&_ul_ul]:ml-6">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal ml-6 space-y-1 my-4 text-gray-700 [&_ol]:list-[lower-alpha] [&_ol]:ml-6 [&_ol_ol]:list-[lower-roman] [&_ol_ol]:ml-6">
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li className="text-gray-700 leading-relaxed">
                {children}
              </li>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-beige-400 bg-beige-50 pl-4 py-2 my-4 italic text-gray-700">
                {children}
              </blockquote>
            ),
            code: ({ children, className }) => {
              const isInline = !className;
              if (isInline) {
                return (
                  <code className="bg-beige-100 text-beige-800 px-1.5 py-0.5 rounded text-sm font-mono">
                    {children}
                  </code>
                );
              }
              return (
                <code className={className}>
                  {children}
                </code>
              );
            },
            pre: ({ children }) => (
              <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 my-4 overflow-x-auto">
                {children}
              </pre>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
      {showCopyButton && (
        <button
          onClick={handleCopy}
          className="absolute -top-2 -right-2 p-1.5 rounded-md bg-white hover:bg-gray-50 border border-gray-200 shadow-sm transition-all duration-200 opacity-0 group-hover:opacity-100 z-10"
          title="마크다운 복사"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Copy className="w-4 h-4 text-gray-600" />
          )}
        </button>
      )}
    </div>
  );
}

export function ChatInterface({ fileId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentReasoning, setCurrentReasoning] = useState('');
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesStartRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadingMessages = [
    "데이터를 분석하고 있습니다.",
    "질문을 이해하고 있습니다.",
    "최적의 답변을 준비하고 있습니다.",
    "데이터를 꼼꼼히 살펴보고 있습니다.",
    "유용한 정보를 찾고 있습니다.",
    "결과를 정리하고 있습니다."
  ];

  const loadChatHistory = useCallback(async () => {
    try {
      const response = await fetch(`/api/chat/history?fileId=${fileId}&page=1&limit=10`);
      if (!response.ok) {
        throw new Error('히스토리 로드 실패');
      }
      
      const data = await response.json();
      if (data.success && data.history.length > 0) {
        const chatMessages: ChatMessage[] = [];
        
        data.history.forEach((item: HistoryItem) => {
          // 사용자 메시지 추가
          chatMessages.push({
            id: `user-${item.id}`,
            content: item.userMessage,
            role: 'user',
            timestamp: new Date(item.timestamp)
          });
          
          // AI 응답 추가
          chatMessages.push({
            id: `ai-${item.id}`,
            content: item.aiResponse,
            role: 'assistant',
            timestamp: new Date(item.timestamp)
          });
        });
        
        setMessages(chatMessages);
        setHasMoreHistory(data.hasMore || false);
        setCurrentPage(1);
      } else {
        setMessages([]);
        setHasMoreHistory(false);
        setCurrentPage(1);
      }
    } catch (error) {
      console.error('채팅 히스토리 로드 실패:', error);
      setMessages([]);
      setHasMoreHistory(false);
      setCurrentPage(1);
    }
  }, [fileId]);

  const loadMoreHistory = useCallback(async () => {
    if (!hasMoreHistory || isLoadingHistory) return;

    setIsLoadingHistory(true);
    try {
      const nextPage = currentPage + 1;
      const response = await fetch(`/api/chat/history?fileId=${fileId}&page=${nextPage}&limit=10`);
      if (!response.ok) {
        throw new Error('추가 히스토리 로드 실패');
      }
      
      const data = await response.json();
      if (data.success && data.history.length > 0) {
        const newChatMessages: ChatMessage[] = [];
        
        data.history.forEach((item: HistoryItem) => {
          // 사용자 메시지 추가
          newChatMessages.push({
            id: `user-${item.id}`,
            content: item.userMessage,
            role: 'user',
            timestamp: new Date(item.timestamp)
          });
          
          // AI 응답 추가
          newChatMessages.push({
            id: `ai-${item.id}`,
            content: item.aiResponse,
            role: 'assistant',
            timestamp: new Date(item.timestamp)
          });
        });
        
        // 기존 메시지 앞에 새로운 메시지들 추가
        setMessages(prev => [...newChatMessages, ...prev]);
        setHasMoreHistory(data.hasMore || false);
        setCurrentPage(nextPage);
      } else {
        setHasMoreHistory(false);
      }
    } catch (error) {
      console.error('추가 히스토리 로드 실패:', error);
      setHasMoreHistory(false);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [fileId, hasMoreHistory, isLoadingHistory, currentPage]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // 파일이 변경되면 상태 초기화 후 해당 파일의 채팅 기록 로드
    setMessages([]);
    setHasMoreHistory(false);
    setCurrentPage(1);
    setIsLoadingHistory(false);
    loadChatHistory();
  }, [loadChatHistory]);

  // 로딩 메시지 순환
  useEffect(() => {
    if (isLoading) {
      loadingIntervalRef.current = setInterval(() => {
        loadingIntervalRef.current = null;
      }, 2000);
    } else {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
      }
    }

    return () => {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
      }
    };
  }, [isLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: input.trim(),
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setCurrentReasoning('답변을 준비하고 있습니다.');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: userMessage.content,
          fileId: fileId
        }),
      });

      if (!response.ok) {
        throw new Error('죄송합니다. 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
      }

      // 스트리밍 응답 처리
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let responseText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'reasoning') {
                  setCurrentReasoning(data.content);
                } else if (data.type === 'response') {
                  responseText = data.content;
                }
              } catch {
                // JSON 파싱 오류 무시
              }
            }
          }
        }
      } else {
        // 스트리밍이 지원되지 않는 경우 일반 응답 처리
        const data = await response.json();
        responseText = data.response;
      }
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: responseText,
        role: 'assistant',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
      
      // 새 메시지가 추가되었으므로 현재 페이지 상태 업데이트
      setCurrentPage(1);

    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: error instanceof Error ? error.message : '죄송합니다. 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
        role: 'assistant',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setCurrentReasoning('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const exampleQuestions = [
    "매출이 가장 높은 상위 10개 제품을 보여줘",
    "월별 매출 추이를 파악해줘",
    "고객 연령대별 구매 패턴을 알려줘",
    "데이터의 주요 통계를 분석해줘"
  ];

  return (
    <div className="flex flex-col h-full bg-beige-100">
      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div ref={messagesStartRef} />
        
        {/* 더 많은 히스토리 로드 버튼 */}
        {hasMoreHistory && (
          <div className="text-center py-4">
            <button
              onClick={loadMoreHistory}
              disabled={isLoadingHistory}
              className="px-4 py-2 bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingHistory ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>이전 대화 로드 중...</span>
                </div>
              ) : (
                '이전 대화 더 보기'
              )}
            </button>
          </div>
        )}
        {messages.length === 0 && (
          <div className="text-center py-16 max-w-2xl mx-auto">
            <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-glow">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              AI 데이터 분석을 시작하세요
            </h3>
            <p className="text-gray-600 mb-8 text-lg leading-relaxed">
              데이터에 대해 궁금한 것을 자연어로 질문해보세요.<br />
              AI가 데이터를 분석하여 인사이트를 제공합니다.
            </p>
            
            <div className="bg-beige-50 rounded-2xl p-6 shadow-card border border-beige-200">
              <div className="flex items-center mb-4">
                <Lightbulb className="w-5 h-5 text-warning-500 mr-2" />
                <p className="text-sm font-semibold text-gray-900">질문 예시</p>
              </div>
              <div className="grid gap-3">
                {exampleQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => setInput(question)}
                    className="text-left p-3 bg-beige-100 hover:bg-primary-50 rounded-lg transition-all duration-200 text-sm text-gray-700 hover:text-primary-700 border border-transparent hover:border-primary-200"
                  >
                    &quot;{question}&quot;
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex w-full',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-4 py-3 shadow-soft',
                message.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white border border-beige-200'
              )}
            >
              {message.role === 'assistant' ? (
                <MarkdownRenderer content={message.content} showCopyButton />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              )}
            </div>
          </div>
        ))}

        {/* 로딩 메시지 표시 */}
        {isLoading && (
          <div className="flex w-full justify-start">
            <div className="max-w-[80%] rounded-2xl px-4 py-3 shadow-soft bg-beige-100 border border-beige-200 animate-pulse">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <span className="text-sm text-gray-600 ml-2">
                  {currentReasoning || loadingMessages[Math.floor(Math.random() * loadingMessages.length)]}
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      <div className="border-t border-beige-300 bg-beige-50 p-6">
        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex items-end space-x-4">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="데이터에 대해 질문해보세요... (Shift+Enter로 줄바꿈)"
              className="w-full resize-none border border-beige-200 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 shadow-soft"
              rows={1}
              disabled={isLoading}
              style={{
                minHeight: '52px',
                maxHeight: '120px',
              }}
            />
            <div className="absolute right-3 bottom-3 flex items-center space-x-1">
              <MessageCircle className="w-4 h-4 text-gray-400" />
            </div>
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={cn(
              'flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 shadow-medium',
              input.trim() && !isLoading
                ? 'bg-primary-700 text-white hover:bg-primary-800 hover:shadow-xl transform hover:scale-105 border border-primary-800'
                : 'bg-beige-200 text-gray-400 cursor-not-allowed'
            )}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
        <div className="mt-3 text-xs text-gray-500 text-center flex items-center justify-center">
          <Sparkles className="w-3 h-3 mr-1" />
          AI가 데이터를 분석하여 정확한 답변을 제공합니다
        </div>
      </div>
    </div>
  );
} 