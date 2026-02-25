'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Loader2 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

type Message = {
  id: string;
  role: 'user' | 'model';
  content: string;
};

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'model',
      content: 'Chào bạn! Tôi là trợ lý AI của ChiliPredict. Bạn cần hỏi gì về kinh doanh tương ớt hay cách sử dụng phần mềm?',
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
      const chat = ai.chats.create({
        model: 'gemini-3.1-pro-preview',
        config: {
          systemInstruction: 'Bạn là một chuyên gia tư vấn kinh doanh bán buôn tương ớt và hỗ trợ sử dụng phần mềm ChiliPredict. Hãy trả lời ngắn gọn, súc tích và hữu ích bằng tiếng Việt.',
        },
      });

      // Send history to chat instance
      for (const msg of messages.slice(1)) {
        await chat.sendMessage({ message: msg.content });
      }

      const response = await chat.sendMessage({ message: userMessage.content });

      const modelMessage: Message = {
        id: crypto.randomUUID(),
        role: 'model',
        content: response.text || 'Xin lỗi, tôi không thể trả lời lúc này.',
      };

      setMessages((prev) => [...prev, modelMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'model',
          content: 'Đã có lỗi xảy ra khi kết nối với AI. Vui lòng thử lại sau.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 w-14 h-14 bg-stone-900 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-stone-800 transition-all z-50 hover:scale-105 active:scale-95",
          isOpen ? "scale-0 opacity-0" : "scale-100 opacity-100"
        )}
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {/* Chat Window */}
      <div
        className={cn(
          "fixed bottom-6 right-6 w-[380px] h-[600px] max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-stone-200 flex flex-col transition-all origin-bottom-right z-50 overflow-hidden",
          isOpen ? "scale-100 opacity-100" : "scale-0 opacity-0 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="p-4 bg-stone-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-red-400" />
            <span className="font-semibold">Trợ lý AI (Pro)</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-stone-800 rounded-md transition-colors text-stone-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3 max-w-[85%]",
                msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  msg.role === 'user' ? "bg-stone-200 text-stone-600" : "bg-red-100 text-red-600"
                )}
              >
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div
                className={cn(
                  "p-3 rounded-2xl text-sm",
                  msg.role === 'user'
                    ? "bg-stone-900 text-white rounded-tr-sm"
                    : "bg-white border border-stone-200 text-stone-800 rounded-tl-sm"
                )}
              >
                <div className="markdown-body prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 max-w-[85%]">
              <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-4 rounded-2xl bg-white border border-stone-200 rounded-tl-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
                <span className="text-sm text-stone-500">Đang suy nghĩ...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-white border-t border-stone-200">
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Hỏi trợ lý AI..."
              className="flex-1 px-4 py-2 bg-stone-100 border-transparent rounded-full text-sm focus:bg-white focus:border-stone-300 focus:ring-2 focus:ring-stone-200 transition-all outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-10 h-10 bg-stone-900 text-white rounded-full flex items-center justify-center hover:bg-stone-800 disabled:opacity-50 disabled:hover:bg-stone-900 transition-colors shrink-0"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
