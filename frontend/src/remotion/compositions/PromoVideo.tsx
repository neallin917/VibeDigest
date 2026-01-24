import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { MockChat, Message } from '../components/MockChat';
import { Sparkles } from 'lucide-react';

export const PromoVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // --- Timing Configuration ---
  const INTRO_DURATION = 60;
  const SETUP_DURATION = 30;
  const TYPING_START = 90;
  const TYPING_DURATION = 60;
  const SEND_DELAY = 10;
  const THINKING_DURATION = 30;
  const RESPONSE_START = TYPING_START + TYPING_DURATION + SEND_DELAY + THINKING_DURATION; // ~190
  const OUTRO_START = 700;

  // --- Animations ---

  // 1. Intro: Logo Scale & Fade
  const logoScale = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: 60,
  });

  const logoOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  // Transition Intro -> Chat
  const introExitProgress = interpolate(frame, [50, 80], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const chatEnterProgress = spring({
    frame: frame - 60,
    fps,
    config: { damping: 20 },
  });

  // 2. Typing Logic
  const textToType = "Summarize this week's top AI trends";
  const typingProgress = interpolate(
    frame,
    [TYPING_START, TYPING_START + TYPING_DURATION],
    [0, 1],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );
  const currentTypedText = textToType.slice(0, Math.floor(typingProgress * textToType.length));

  const isMessageSent = frame > TYPING_START + TYPING_DURATION + SEND_DELAY;

  // 3. Thinking Logic
  const isThinking = frame > TYPING_START + TYPING_DURATION + SEND_DELAY && frame < RESPONSE_START;

  // 4. Response Streaming Logic
  const fullResponse = `Here are the top AI trends from this week:

1. **Multimodal Models**: Gemini 1.5 and GPT-4o are dominating discussions with improved vision and audio capabilities.
2. **Open Source**: Llama 3 releases are setting new benchmarks for local LLMs.
3. **Video Generation**: Sora competitors are emerging, focusing on consistency and length.

Would you like a deep dive into any of these?`;

  const streamingProgress = interpolate(
    frame,
    [RESPONSE_START, RESPONSE_START + 300], // Stream over 300 frames (~10s)
    [0, 1],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );
  const currentResponseText = fullResponse.slice(0, Math.floor(streamingProgress * fullResponse.length));

  // Construct Messages
  const messages: Message[] = [];

  if (isMessageSent) {
    messages.push({ role: 'user', content: textToType });
  }

  if (frame > RESPONSE_START) {
    messages.push({ role: 'assistant', content: currentResponseText });
  }

  // 5. Outro
  const outroOpacity = interpolate(frame, [OUTRO_START, OUTRO_START + 30], [0, 1], { extrapolateLeft: 'clamp' });
  const mainContentScale = interpolate(frame, [OUTRO_START, OUTRO_START + 60], [1, 0.8], { extrapolateLeft: 'clamp' });
  const mainContentOpacity = interpolate(frame, [OUTRO_START + 30, OUTRO_START + 60], [1, 0], { extrapolateLeft: 'clamp' });

  return (
    <AbsoluteFill className="bg-white dark:bg-zinc-950">

      {/* SCENE 1: INTRO LOGO */}
      <AbsoluteFill
        style={{
            opacity: 1 - introExitProgress,
            display: introExitProgress === 1 ? 'none' : 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 20
        }}
        className="bg-white dark:bg-black"
      >
         <div style={{ transform: `scale(${logoScale})`, opacity: logoOpacity }} className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-3xl bg-emerald-500 flex items-center justify-center text-white shadow-2xl shadow-emerald-500/30">
                <Sparkles size={48} />
            </div>
            <h1 className="text-4xl font-bold text-slate-800 dark:text-white tracking-tight">VibeDigest</h1>
         </div>
      </AbsoluteFill>

      {/* SCENE 2-4: MAIN CHAT INTERFACE */}
      <AbsoluteFill style={{ opacity: introExitProgress }}>
         <MockChat
            messages={messages}
            inputValue={isMessageSent ? '' : currentTypedText}
            isThinking={isThinking}
            opacity={mainContentOpacity}
            scale={mainContentScale}
            translateY={(1 - chatEnterProgress) * 100}
         />
      </AbsoluteFill>

      {/* SCENE 5: OUTRO */}
      <AbsoluteFill
        style={{ opacity: outroOpacity }}
        className="bg-black/90 backdrop-blur-3xl items-center justify-center z-30 flex flex-col gap-6"
      >
        <div className="text-center space-y-2">
            <h2 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">
                Experience VibeDigest
            </h2>
            <p className="text-slate-400 text-xl">Your personal AI video curator.</p>
        </div>
        <div className="px-8 py-3 bg-white text-black font-bold rounded-full text-lg mt-8">
            Try it now
        </div>
      </AbsoluteFill>

    </AbsoluteFill>
  );
};
