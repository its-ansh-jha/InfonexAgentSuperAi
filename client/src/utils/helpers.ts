import { Message } from '@/types';

export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function autoResizeTextarea(element: HTMLTextAreaElement): void {
  element.style.height = 'auto';
  element.style.height = `${element.scrollHeight}px`;
}

export const getSystemMessage = (): Message => ({
  role: 'system',
  content: 'You are InfonexAgent, a highly intelligent and helpful AI assistant created by Infonex. You provide thoughtful, accurate, and helpful responses using advanced AI models. You are knowledgeable across a wide range of topics including programming, science, history, arts, and general knowledge. You can assist with code writing, information queries, creative tasks, and problem-solving. You have the capabilities of image input and user can ask you realtime data questions also by clicking the search button where you are used and then ask the question and for image there is image button. Always be respectful, helpful, and honest about your limitations. If user asks about owner of Infonex then only answer them that the owner of Infonex is Ansh Kumar Jha.\n\nIMPORTANT FORMATTING INSTRUCTIONS:\n- When providing code examples, ALWAYS wrap them in triple backticks with the language specified: ```language\\ncode here\\n```\n- For mathematical expressions, use LaTeX notation: \\[formula\\] for block math or \\(formula\\) for inline math\n- Examples: ```javascript\\nconsole.log("Hello");\\n``` or ```python\\nprint("Hello")\\n``` or ```html\\n<div>Content</div>\\n```\n- For math: \\[E = mc^2\\] or inline \\(x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}\\)\n- Always specify the programming language in code blocks for proper syntax highlighting',
  model: 'gpt-5',
  timestamp: new Date().toISOString(),
});

export const getWelcomeMessage = (model: string): Message => ({
  role: 'assistant',
  content: `Hello! I'm InfonexAgent, your advanced AI assistant developed by Infonex a company for tech solutions. I'm here to help with questions, creative tasks, coding problems, or just friendly conversation. I can also analyze images - just upload any image (JPG, PNG, etc.) and I'll help you understand what's in it! My privacy policy and terms of use are available through the menu next to the New Chat button.`,
  model: 'gpt-5',
  timestamp: new Date().toISOString(),
});

export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function extractCodeBlocks(content: string): { text: string, isCode: boolean, isMath?: boolean, isInlineMath?: boolean, language?: string }[] {
  // More robust regex patterns
  const codeBlockRegex = /```(?:(\w+)(?:\n|$))?([\s\S]*?)```/g;
  const blockMathRegex = /\\\[([\s\S]*?)\\\]/g;
  const inlineMathRegex = /\\\(([\s\S]*?)\\\)/g;
  const parts: { text: string, isCode: boolean, isMath?: boolean, isInlineMath?: boolean, language?: string }[] = [];
  
  // First, split by code blocks
  let lastIndex = 0;
  let match;
  
  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before the code block
    if (match.index > lastIndex) {
      parts.push({
        text: content.substring(lastIndex, match.index),
        isCode: false
      });
    }
    
    // Add the code block
    const language = match[1] || '';
    parts.push({
      text: match[2],
      isCode: true,
      language
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text after the last code block
  if (lastIndex < content.length) {
    parts.push({
      text: content.substring(lastIndex),
      isCode: false
    });
  }

  // Now process math blocks in non-code parts
  const result: typeof parts = [];
  
  for (const part of parts) {
    if (part.isCode) {
      result.push(part);
      continue;
    }
    
    // First process block math \[...\]
    const text = part.text;
    let blockMathLastIndex = 0;
    let blockMathParts: typeof parts = [];
    let blockMathMatch;
    
    while ((blockMathMatch = blockMathRegex.exec(text)) !== null) {
      // Add text before the math block
      if (blockMathMatch.index > blockMathLastIndex) {
        blockMathParts.push({
          text: text.substring(blockMathLastIndex, blockMathMatch.index),
          isCode: false,
          isMath: false
        });
      }
      
      // Add the math block
      blockMathParts.push({
        text: blockMathMatch[1],
        isCode: false,
        isMath: true
      });
      
      blockMathLastIndex = blockMathMatch.index + blockMathMatch[0].length;
    }
    
    // Add remaining text after the last block math
    if (blockMathLastIndex < text.length) {
      blockMathParts.push({
        text: text.substring(blockMathLastIndex),
        isCode: false,
        isMath: false
      });
    } else if (blockMathLastIndex === 0) {
      // If no block math was found, keep the original text
      blockMathParts = [part];
    }
    
    // Then process inline math \(...\) in each non-math part from the previous step
    for (const blockMathPart of blockMathParts) {
      if (blockMathPart.isMath) {
        result.push(blockMathPart);
        continue;
      }
      
      const inlineText = blockMathPart.text;
      let inlineMathLastIndex = 0;
      let inlineMathMatch;
      
      while ((inlineMathMatch = inlineMathRegex.exec(inlineText)) !== null) {
        // Add text before the inline math
        if (inlineMathMatch.index > inlineMathLastIndex) {
          result.push({
            text: inlineText.substring(inlineMathLastIndex, inlineMathMatch.index),
            isCode: false,
            isMath: false
          });
        }
        
        // Add the inline math
        result.push({
          text: inlineMathMatch[1],
          isCode: false,
          isInlineMath: true
        });
        
        inlineMathLastIndex = inlineMathMatch.index + inlineMathMatch[0].length;
      }
      
      // Add remaining text after the last inline math
      if (inlineMathLastIndex < inlineText.length) {
        result.push({
          text: inlineText.substring(inlineMathLastIndex),
          isCode: false,
          isMath: false
        });
      } else if (inlineMathLastIndex === 0) {
        // If no inline math was found, add the original part
        result.push(blockMathPart);
      }
    }
  }
  
  return result;
}
