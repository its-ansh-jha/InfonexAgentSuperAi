import React, { useState, useEffect, useRef } from 'react';

interface TypingAnimationProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  isTyping?: boolean;
  onStop?: () => void;
}

export function TypingAnimation({ text, speed = 15, onComplete, isTyping = true, onStop }: TypingAnimationProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isTyping && currentIndex < text.length && !hasCompleted) {
      timeoutRef.current = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, speed);

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    } else if (currentIndex >= text.length && onComplete && !hasCompleted) {
      setHasCompleted(true);
      onComplete();
    }
  }, [currentIndex, text, speed, onComplete, isTyping, hasCompleted]);

  // Stop typing when isTyping becomes false
  useEffect(() => {
    if (!isTyping && timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      if (onStop) {
        onStop();
      }
    }
  }, [isTyping, onStop]);

  // Reset when text changes
  useEffect(() => {
    setDisplayedText('');
    setCurrentIndex(0);
    setHasCompleted(false);
  }, [text]);

  return (
    <span>
      {displayedText}
      {isTyping && currentIndex < text.length && (
        <span className="animate-pulse text-primary">|</span>
      )}
    </span>
  );
}