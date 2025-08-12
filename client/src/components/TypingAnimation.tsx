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
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isTyping && currentIndex < text.length) {
      timeoutRef.current = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, speed);

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    } else if (currentIndex >= text.length && onComplete) {
      onComplete();
    }
  }, [currentIndex, text, speed, onComplete, isTyping]);

  // Stop typing when isTyping becomes false
  useEffect(() => {
    if (!isTyping && timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      if (onStop) {
        onStop();
      }
    }
  }, [isTyping, onStop]);

  // Reset when text changes
  useEffect(() => {
    setDisplayedText('');
    setCurrentIndex(0);
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