import React from 'react';
import { Header } from '@/components/Header';
import { ChatContainer } from '@/components/ChatContainer';
import { ChatInput } from '@/components/ChatInput';
import { ChatProvider } from '@/context/ChatContext';
import { ChatHistoryProvider } from '@/context/ChatHistoryContext';
import { useAuth } from '@/hooks/useAuth';
import { MessageCircle, Sparkles, Shield, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';

function WelcomeScreen() {
  return (
    <main className="flex-grow container mx-auto px-4 py-6 flex items-center justify-center">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="p-3 bg-primary/10 rounded-full">
              <MessageCircle className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white">Welcome to Infonex</h1>
          <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
            Your intelligent AI assistant powered by advanced language models. 
            Get instant answers, generate content, and explore ideas with our cutting-edge AI technology.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <Card className="p-6 bg-neutral-800/50 border-neutral-700 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-2 bg-blue-500/10 rounded-full">
                <Sparkles className="h-8 w-8 text-blue-400" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Smart Conversations</h3>
            <p className="text-neutral-400 text-sm">
              Engage in natural conversations with our advanced AI that understands context and provides thoughtful responses.
            </p>
          </Card>

          <Card className="p-6 bg-neutral-800/50 border-neutral-700 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-2 bg-green-500/10 rounded-full">
                <Zap className="h-8 w-8 text-green-400" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Lightning Fast</h3>
            <p className="text-neutral-400 text-sm">
              Get instant responses powered by state-of-the-art language models and optimized infrastructure.
            </p>
          </Card>

          <Card className="p-6 bg-neutral-800/50 border-neutral-700 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-2 bg-purple-500/10 rounded-full">
                <Shield className="h-8 w-8 text-purple-400" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Secure & Private</h3>
            <p className="text-neutral-400 text-sm">
              Your conversations are protected with enterprise-grade security and privacy measures.
            </p>
          </Card>
        </div>

        <div className="mt-12 p-6 bg-primary/5 border border-primary/20 rounded-lg">
          <h3 className="text-xl font-semibold text-white mb-2">Ready to get started?</h3>
          <p className="text-neutral-300 mb-4">
            Sign in with your Replit account to begin chatting with Infonex AI
          </p>
          <p className="text-sm text-neutral-400">
            Click the "Sign In" button in the header above to access all features
          </p>
        </div>
      </div>
    </main>
  );
}

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <ChatHistoryProvider>
        <ChatProvider>
          <div className="flex flex-col min-h-screen bg-neutral-900 text-white">
            <Header />
            <main className="flex-grow container mx-auto px-4 py-6 flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-neutral-700 animate-pulse mx-auto"></div>
                <div className="h-6 w-32 rounded bg-neutral-700 animate-pulse mx-auto"></div>
              </div>
            </main>
          </div>
        </ChatProvider>
      </ChatHistoryProvider>
    );
  }

  return (
    <ChatHistoryProvider>
      <ChatProvider>
        <div className="flex flex-col min-h-screen bg-neutral-900 text-white">
          <Header />
          {isAuthenticated ? (
            <>
              <ChatContainer />
              <ChatInput />
            </>
          ) : (
            <WelcomeScreen />
          )}
        </div>
      </ChatProvider>
    </ChatHistoryProvider>
  );
}
