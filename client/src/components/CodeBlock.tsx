import React, { useState, useEffect } from 'react';
import { Copy, Check, Download, Code, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import Prism from 'prismjs';

// Import core Prism languages
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup';

// Import Prism theme
import 'prismjs/themes/prism-dark.css';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = '' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const [highlightedCode, setHighlightedCode] = useState('');

  // Language mapping for Prism
  const getPrismLanguage = (lang: string): string => {
    const langMap: { [key: string]: string } = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'rb': 'ruby',
      'cs': 'csharp',
      'c++': 'cpp',
      'sh': 'bash',
      'shell': 'bash',
      'ps1': 'powershell',
      'yml': 'yaml',
      'html': 'markup',
      'htm': 'markup',
      'xml': 'markup'
    };
    return langMap[lang.toLowerCase()] || lang.toLowerCase();
  };

  useEffect(() => {
    if (language && code) {
      const prismLang = getPrismLanguage(language);
      if (Prism.languages[prismLang]) {
        const highlighted = Prism.highlight(code, Prism.languages[prismLang], prismLang);
        setHighlightedCode(highlighted);
      } else {
        setHighlightedCode(code);
      }
    } else {
      setHighlightedCode(code);
    }
  }, [code, language]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast({
      title: "Code copied",
      description: "Code snippet has been copied to clipboard",
      duration: 2000,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCode = () => {
    // Create a blob with the code content
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    // Create a temporary link element and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `code-snippet${language ? `.${language}` : '.txt'}`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Download started",
      description: "Code snippet is being downloaded",
      duration: 2000,
    });
  };

  const openInNewTab = () => {
    // Create a blob with the code content
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    // Open in new tab
    window.open(url, '_blank');
    
    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  return (
    <div className="bg-neutral-900 dark:bg-neutral-950 rounded-md my-3 relative">
      {language && (
        <div className="flex justify-between items-center px-4 py-2 text-xs border-b border-neutral-800">
          <span className="text-neutral-400">{language}</span>
        </div>
      )}
      
      <pre className="p-4 overflow-x-auto">
        <code 
          className={`font-mono text-sm ${language ? `language-${getPrismLanguage(language)}` : ''}`}
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />
      </pre>
      
      <div className="border-t border-neutral-800 py-1 px-2 flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={copyToClipboard}
                className="h-8 w-8 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Copy code</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={downloadCode}
                className="h-8 w-8 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Download as file</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={openInNewTab}
                className="h-8 w-8 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Open in new tab</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
