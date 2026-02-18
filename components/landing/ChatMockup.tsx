"use client";

import { useRef, useState, useEffect } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-config";
import { Bot, User, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const conversations = [
  {
    user: "Which rep needs coaching this week?",
    assistant: "Based on recent calls, Mike T. has a 52 avg score. His talk ratio is too high (68%) and he's missing discovery questions.",
  },
  {
    user: "What's our team's average score?",
    assistant: "Your team averaged 78 this week, up 5 points from last week. Sarah leads with 91, while 3 reps are below 65.",
  },
  {
    user: "Show me Sarah's best techniques",
    assistant: "Sarah excels at open-ended questions (92% usage) and handles objections smoothly. She lets prospects talk 60% of the time.",
  },
  {
    user: "Any deals at risk?",
    assistant: "2 deals flagged: Acme Corp (competitor mentioned 3x) and TechStart (pricing objection unresolved). Recommend follow-up.",
  },
];

interface ChatMockupProps {
  animate?: boolean;
  loop?: boolean;
  className?: string;
}

export function ChatMockup({ animate = true, loop = false, className }: ChatMockupProps) {
  const chatRef = useRef<HTMLDivElement>(null);
  const [conversationIndex, setConversationIndex] = useState(0);
  const [showTyping, setShowTyping] = useState(false);
  const [showResponse, setShowResponse] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const currentConversation = conversations[conversationIndex];

  useGSAP(
    () => {
      if (!chatRef.current) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !isVisible) {
              setIsVisible(true);
            }
          });
        },
        { threshold: 0.3 }
      );

      observer.observe(chatRef.current);

      return () => observer.disconnect();
    },
    { scope: chatRef }
  );

  // Animation sequence
  useEffect(() => {
    if (!animate || !isVisible) return;

    const runAnimation = () => {
      // Reset state
      setShowTyping(false);
      setShowResponse(false);

      // Animate user message
      const userMsg = chatRef.current?.querySelector(".chat-user");
      if (userMsg) {
        gsap.fromTo(
          userMsg,
          { opacity: 0, y: 15, scale: 0.95 },
          { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "back.out(1.5)" }
        );
      }

      // Show typing after delay
      const typingTimeout = setTimeout(() => {
        setShowTyping(true);
      }, 800);

      // Show response after typing
      const responseTimeout = setTimeout(() => {
        setShowTyping(false);
        setShowResponse(true);

        // Animate response
        setTimeout(() => {
          const assistantMsg = chatRef.current?.querySelector(".chat-assistant");
          if (assistantMsg) {
            gsap.fromTo(
              assistantMsg,
              { opacity: 0, y: 15, scale: 0.95 },
              { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "back.out(1.5)" }
            );
          }
        }, 50);
      }, 2000);

      return () => {
        clearTimeout(typingTimeout);
        clearTimeout(responseTimeout);
      };
    };

    runAnimation();
  }, [animate, isVisible, conversationIndex]);

  // Loop through conversations
  useEffect(() => {
    if (!loop || !isVisible) return;

    const interval = setInterval(() => {
      // Fade out current conversation
      const messages = chatRef.current?.querySelectorAll(".chat-user, .chat-assistant");
      if (messages) {
        gsap.to(messages, {
          opacity: 0,
          y: -10,
          duration: 0.3,
          ease: "power2.in",
          onComplete: () => {
            setConversationIndex((prev) => (prev + 1) % conversations.length);
          },
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [loop, isVisible]);

  return (
    <div ref={chatRef} className={cn("space-y-3 min-h-[120px]", className)}>
      {/* User Message */}
      <div className="chat-user flex items-start gap-2 justify-end">
        <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-br-md bg-primary text-primary-foreground text-xs shadow-sm">
          {currentConversation.user}
        </div>
        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 ring-2 ring-background">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      </div>

      {/* Typing Indicator */}
      {showTyping && (
        <div className="flex items-start gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 ring-2 ring-background">
            <Sparkles className="w-3 h-3 text-primary animate-pulse" />
          </div>
          <div className="px-4 py-2.5 rounded-2xl rounded-bl-md bg-muted/80 backdrop-blur-sm">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        </div>
      )}

      {/* Assistant Response */}
      {showResponse && (
        <div className="chat-assistant flex items-start gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 ring-2 ring-background">
            <Bot className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-bl-md bg-muted/80 backdrop-blur-sm text-foreground text-xs leading-relaxed shadow-sm">
            {currentConversation.assistant}
          </div>
        </div>
      )}

      {/* Loop indicator */}
      {loop && (
        <div className="flex justify-center pt-2">
          <div className="flex gap-1">
            {conversations.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all duration-300",
                  idx === conversationIndex ? "bg-primary w-3" : "bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
