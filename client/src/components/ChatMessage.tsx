import React, { useState } from 'react';
import { Message } from '@/types';
import { 
  User, 
  ThumbsUp, 
  ThumbsDown, 
  Copy, 
  RefreshCw, 
  Check,
  Download,
  FileText,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoImage from '../assets/logo.webp';
import { CodeBlock } from '@/components/CodeBlock';
import { MathDisplay } from '@/components/MathDisplay';
import { TextToSpeech } from '@/components/TextToSpeech';
import { extractCodeBlocks } from '@/utils/helpers';
import { useToast } from '@/hooks/use-toast';
import { useChat } from '@/context/ChatContext';
import { TypingAnimation } from '@/components/TypingAnimation';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';

interface ChatMessageProps {
  message: Message;
  useTypingAnimation?: boolean;
}

export function ChatMessage({ message, useTypingAnimation = false }: ChatMessageProps) {
  const { role, content } = message;
  const isUser = role === 'user';
  const { toast } = useToast();
  const { isTyping, stopTyping } = useChat();
  const [copied, setCopied] = useState(false);

  // Skip rendering system messages completely
  if (role === 'system') {
    return null;
  }

  // Handle both string and array formats of content
  let contentString: string;
  let images: string[] = [];
  let pdfLinks: Array<{url: string, title: string}> = [];

  if (typeof content === 'string') {
    contentString = content;
  } else if (Array.isArray(content)) {
    // Extract image data, PDF links, and text content separately
    const textParts = [];
    for (const item of content) {
      if (item.type === 'text' && item.text) {
        textParts.push(item.text);
      } else if (item.type === 'image_url' && (item as any).image_url?.url) {
        // Handle image_url format from OpenAI API
        const url = (item as any).image_url.url;
        if (url.startsWith('data:image') || url.startsWith('https://') || url.startsWith('/api/images/')) {
          images.push(url);
        }
      } else if (item.type === 'image' && item.image_data) {
        // Handle legacy image_data format
        images.push(`data:image/jpeg;base64,${item.image_data}`);
      } else if (item.type === 'pdf_link' && (item as any).pdf_url) {
        // Handle PDF link format
        pdfLinks.push({
          url: (item as any).pdf_url,
          title: (item as any).title || 'Generated PDF'
        });
      }
    }
    contentString = textParts.join('\n');
  } else {
    contentString = 'Content could not be displayed';
  }

  // Split content into text, code blocks, and math blocks
  const contentParts = extractCodeBlocks(contentString);
  
  // Debug: Log content parts to console to see what's being extracted
  if (contentParts.some(part => part.isCode)) {
    console.log('Code blocks detected:', contentParts.filter(part => part.isCode));
  }

  const copyToClipboard = () => {
    // Only copy text portions, not code blocks
    const textContent = contentParts
      .filter(part => !part.isCode)
      .map(part => part.text)
      .join('\n');

    navigator.clipboard.writeText(textContent);
    setCopied(true);

    toast({
      title: "Copied to clipboard",
      description: "Message content has been copied",
      duration: 2000,
    });

    setTimeout(() => setCopied(false), 2000);
  };

  // We'll use our improved TextToSpeech component instead of this function
  const getCleanTextForSpeech = () => {
    // Extract only the text content for speech
    const textContent = contentParts
      .filter(part => !part.isCode && !part.isMath && !part.isInlineMath)
      .map(part => part.text)
      .join(' ');

    // Clean up text for better speech synthesis
    return textContent
      // Replace common emoji patterns with spaces to prevent reading emoji codes
      .replace(/:[a-z_]+:/g, ' ')
      // Remove special characters and brackets that might be read literally
      .replace(/[*_~`#|<>{}[\]()]/g, ' ')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Get all we need from context at component level
  const { messages, regenerateResponseAtIndex } = useChat();

  // Check if this assistant message was generated from a user message with an image
  const isImageBasedResponse = () => {
    if (role !== 'assistant') return false;

    // Find this message's index in the context messages
    const currentIndex = messages.findIndex(m => 
      m.timestamp === message.timestamp && 
      m.role === message.role &&
      (typeof m.content === 'string' && typeof content === 'string' ? 
        m.content === content : JSON.stringify(m.content) === JSON.stringify(content))
    );

    if (currentIndex <= 0) return false;

    // Look for the most recent user message before this assistant message
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        const userMessage = messages[i];
        
        // Check if user message has image content
        if (Array.isArray(userMessage.content)) {
          const hasImage = userMessage.content.some(item => item.type === 'image');
          if (hasImage) return true;
        }
        
        // Check if user message content indicates an image was attached
        if (typeof userMessage.content === 'string' && userMessage.content.includes('[Image attached]')) {
          return true;
        }
        
        break;
      }
    }

    return false;
  };

  // Handle regenerate response click
  const regenerateResponse = () => {
    // Only allow regenerating if this is an assistant message
    if (role !== 'assistant') return;

    // Don't allow regenerating responses from image-based questions
    if (isImageBasedResponse()) {
      toast({
        title: "Regenerate not available",
        description: "Regenerate response is not available for image-based questions",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    // Find this message's index in the context messages
    const currentIndex = messages.findIndex(m => 
      m.timestamp === message.timestamp && 
      m.role === message.role &&
      (typeof m.content === 'string' && typeof content === 'string' ? 
        m.content === content : JSON.stringify(m.content) === JSON.stringify(content))
    );

    if (currentIndex <= 0) {
      toast({
        title: "Error",
        description: "Cannot find this message in the conversation",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    // Look for the most recent user message before this assistant message
    let userMessageIndex = -1;
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMessageIndex = i;
        break;
      }
    }

    if (userMessageIndex === -1) {
      toast({
        title: "Error",
        description: "Cannot find the user message that prompted this response",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    // Call the regenerate function with the found index
    regenerateResponseAtIndex(userMessageIndex);

    toast({
      title: "Regenerating response",
      description: "Please wait while we get a new response",
      duration: 2000,
    });
  };

  const handleFeedback = (type: 'like' | 'dislike') => {
    // This would be hooked up to your feedback system
    toast({
      title: `Feedback recorded: ${type === 'like' ? 'Helpful' : 'Not helpful'}`,
      description: "Thank you for your feedback",
      duration: 2000,
    });
  };

  const downloadImage = async (imageUrl: string, filename: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Download started",
        description: "Image download has been initiated",
        duration: 2000,
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: "Download failed",
        description: "Could not download the image. Please try right-clicking and saving.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  return (
    <div className={`flex items-start ${isUser ? 'justify-end space-x-3' : 'space-x-3'} mb-6`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mt-1 soft-glow">
          <img src={logoImage} alt="Infonex Logo" className="w-full h-full object-cover" />
        </div>
      )}

      <div className={`flex flex-col ${isUser 
        ? 'bg-muted rounded-2xl accent-border p-4 max-w-[85%] shadow-md' 
        : 'bg-neutral-950 dark:bg-neutral-950 rounded-2xl p-4 max-w-[85%] shadow-md border border-neutral-800'}`}
      >
        {/* Display images if present */}
        {images.length > 0 && (
          <div className="mb-3">
            <div className={`grid gap-2 ${images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3'}`}>
              {images.map((imageUrl, index) => (
                <div key={index} className="relative group">
                  <img 
                    src={imageUrl}
                    alt={`${isUser ? 'Uploaded' : 'Generated'} image ${index + 1}`}
                    className="max-w-full h-32 sm:h-40 rounded-lg border border-neutral-600 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    data-testid={`message-image-${index}`}
                    onClick={() => window.open(imageUrl, '_blank')}
                  />
                  {images.length > 1 && (
                    <div className="absolute top-1 right-1 bg-black/70 text-white text-xs px-1 py-0.5 rounded">
                      {index + 1}/{images.length}
                    </div>
                  )}
                  {/* Download button - only show on hover */}
                  <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 bg-black/70 hover:bg-black/90 text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadImage(imageUrl, `${isUser ? 'uploaded' : 'generated'}-image-${index + 1}.png`);
                            }}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p>Download image</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Display PDF links if present */}
        {pdfLinks.length > 0 && (
          <div className="mb-3">
            {pdfLinks.map((pdfLink, index) => (
              <div key={index} className="p-3 border border-neutral-600 rounded-lg bg-neutral-900">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-blue-400" />
                    <span className="text-sm font-medium">{pdfLink.title}</span>
                  </div>
                  <div className="flex space-x-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(pdfLink.url, '_blank')}
                            className="h-8 text-xs"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p>Open PDF in new tab</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadImage(pdfLink.url, pdfLink.title + '.pdf')}
                            className="h-8 text-xs"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p>Download PDF</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-foreground">
          {contentParts.map((part, index) => {
            if (part.isCode) {
              return <CodeBlock key={index} code={part.text} language={part.language} />;
            } else if (part.isMath) {
              return (
                <div key={index} className="my-4 overflow-x-auto">
                  <MathDisplay math={part.text} isBlock={true} />
                </div>
              );
            } else if (part.isInlineMath) {
              return (
                <span key={index} className="inline-block mx-1">
                  <MathDisplay math={part.text} isBlock={false} />
                </span>
              );
            } else {
              // Use typing animation for assistant messages and text content
              if (!isUser && useTypingAnimation && index === 0) {
                return (
                  <p key={index} className="whitespace-pre-line">
                    <TypingAnimation 
                      text={part.text} 
                      speed={15}
                      isTyping={isTyping}
                      onComplete={() => {
                        // Typing animation completed, stop the global typing state silently
                        stopTyping();
                      }}
                      onStop={() => {
                        // Typing was stopped manually, no notification needed
                      }}
                    />
                  </p>
                );
              } else {
                return <p key={index} className="whitespace-pre-line">{part.text}</p>;
              }
            }
          })}
        </div>

        {!isUser && (
          <div className="flex mt-3 pt-2 border-t border-neutral-800">
            <div className="flex space-x-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleFeedback('like')}
                      className="h-8 w-8 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800"
                    >
                      <ThumbsUp className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Helpful</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleFeedback('dislike')}
                      className="h-8 w-8 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800"
                    >
                      <ThumbsDown className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Not helpful</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={copyToClipboard}
                      className="h-8 w-8 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Copy to clipboard</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Text to Speech component */}
              <TextToSpeech text={getCleanTextForSpeech()} />

              {!isImageBasedResponse() && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={regenerateResponse}
                        className="h-8 w-8 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>Regenerate response</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        )}
      </div>

      {isUser && (
        <div className="bg-muted rounded-full w-8 h-8 flex items-center justify-center text-muted-foreground flex-shrink-0 mt-1">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}