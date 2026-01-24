import React from 'react';
import { Loader2, ArrowUp, User, Bot, Sparkles } from 'lucide-react';
import { AbsoluteFill } from 'remotion';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface MockChatProps {
  messages: Message[];
  inputValue: string;
  isThinking: boolean;
  opacity: number;
  scale: number;
  translateY: number;
}

export const MockChat: React.FC<MockChatProps> = ({
  messages,
  inputValue,
  isThinking,
  opacity,
  scale,
  translateY,
}) => {
  return (
    <AbsoluteFill
      className="bg-zinc-50 dark:bg-black items-center justify-center font-sans"
      style={{
        opacity,
        transform: `scale(${scale}) translateY(${translateY}px)`,
      }}
    >
      {/* Background Gradient / Noise matches globals.css */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_50%,rgba(240,245,255,0.8)_0%,transparent_25%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_30%,rgba(240,255,245,0.6)_0%,transparent_25%)]" />

      <div className="w-full max-w-3xl h-full flex flex-col relative z-10 pt-20 pb-4">
        {/* Header/Logo Area */}
        <div className="absolute top-0 left-0 w-full p-6 flex items-center justify-center">
          <div className="flex items-center gap-2">
             {/* Using a text logo for simplicity if image fails to load, or use Img from remotion if needed */}
             <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white">
                <Sparkles size={18} />
             </div>
             <span className="font-bold text-xl text-slate-800 tracking-tight">VibeDigest</span>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-hidden p-6 space-y-6 flex flex-col justify-end pb-32">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-6 py-5 text-[15.5px] leading-7 rounded-[20px] backdrop-blur-md border shadow-sm ${
                  m.role === 'user'
                    ? 'rounded-tr-sm bg-emerald-600/10 border-emerald-600/10 text-slate-800'
                    : 'rounded-tl-sm bg-white/60 border-white/40 text-slate-800'
                }`}
              >
                {/* Simple Markdown Simulation */}
                <div className="whitespace-pre-wrap font-medium">
                    {m.content}
                </div>
              </div>
            </div>
          ))}

          {/* Thinking Indicator */}
          {isThinking && (
            <div className="flex w-full justify-start">
              <div className="bg-white/40 px-5 py-3 rounded-2xl rounded-tl-sm border border-white/40 flex items-center gap-2 w-fit">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                <span className="text-sm text-slate-500 font-medium">Thinking...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="absolute bottom-6 left-0 w-full px-6 flex justify-center">
          <div className="w-full max-w-2xl relative">
            <div className="relative rounded-[2rem] p-2 pl-6 flex items-center gap-3 ring-1 ring-white/50 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] bg-white/60 backdrop-blur-2xl">
              <div className="flex-1 min-w-0 py-3.5 text-[15px] font-medium text-slate-800">
                {inputValue || <span className="text-slate-400/80">Ask anything...</span>}
                {/* Cursor */}
                {inputValue && <span className="inline-block w-0.5 h-5 ml-0.5 align-middle bg-emerald-500 animate-pulse"/>}
              </div>

              <div className={`p-2.5 rounded-[1.2rem] shadow-sm shrink-0 mr-1 transition-colors ${
                  inputValue ? 'bg-gradient-to-tr from-emerald-600 to-emerald-500 text-white' : 'bg-slate-200/50 text-slate-400'
              }`}>
                <ArrowUp className="w-5 h-5" strokeWidth={2.5} />
              </div>
            </div>

            <div className="text-center mt-3">
               <p className="text-[11px] text-slate-400/80 font-medium tracking-wide">
                 AI can make mistakes. Please verify important information.
               </p>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
