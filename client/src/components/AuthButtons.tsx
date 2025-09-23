// Authentication buttons for non-authenticated users
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from '@/lib/firebase';
import { LogIn, UserPlus, Mail } from 'lucide-react';

export function AuthButtons() {
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const { toast } = useToast();

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
      toast({
        title: "Success!",
        description: "You've been signed in with Google.",
        duration: 3000,
      });
      setIsSignInOpen(false);
    } catch (error: any) {
      toast({
        title: "Sign In Failed",
        description: error.message || "Failed to sign in with Google.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signInWithEmail(signInEmail, signInPassword);
      toast({
        title: "Welcome back!",
        description: "You've been signed in successfully.",
        duration: 3000,
      });
      setIsSignInOpen(false);
      setSignInEmail('');
      setSignInPassword('');
    } catch (error: any) {
      toast({
        title: "Sign In Failed",
        description: error.message || "Invalid email or password.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signUpWithEmail(signUpEmail, signUpPassword);
      toast({
        title: "Account Created!",
        description: "Your account has been created successfully.",
        duration: 3000,
      });
      setIsSignUpOpen(false);
      setSignUpEmail('');
      setSignUpPassword('');
    } catch (error: any) {
      toast({
        title: "Sign Up Failed",
        description: error.message || "Failed to create account.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      {/* Sign In Dialog */}
      <Dialog open={isSignInOpen} onOpenChange={setIsSignInOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1 text-sm px-3 py-1 rounded-full bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-white transition-colors"
            data-testid="button-signin"
          >
            <LogIn className="h-4 w-4" />
            Sign In
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md bg-neutral-800 border-neutral-700 text-white">
          <DialogHeader>
            <DialogTitle>Sign In</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Sign in to your account to access unlimited features.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-google-signin"
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign In with Google
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full bg-neutral-600" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-neutral-800 px-2 text-neutral-400">Or</span>
              </div>
            </div>

            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div>
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  type="email"
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  className="bg-neutral-700 border-neutral-600 text-white"
                  placeholder="Enter your email"
                  required
                  data-testid="input-signin-email"
                />
              </div>
              <div>
                <Label htmlFor="signin-password">Password</Label>
                <Input
                  id="signin-password"
                  type="password"
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  className="bg-neutral-700 border-neutral-600 text-white"
                  placeholder="Enter your password"
                  required
                  data-testid="input-signin-password"
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-neutral-700 hover:bg-neutral-600 text-white"
                data-testid="button-signin-submit"
              >
                <Mail className="w-4 h-4 mr-2" />
                Sign In with Email
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sign Up Dialog */}
      <Dialog open={isSignUpOpen} onOpenChange={setIsSignUpOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1 text-sm px-3 py-1 rounded-full bg-blue-600 hover:bg-blue-700 border-blue-600 text-white transition-colors"
            data-testid="button-signup"
          >
            <UserPlus className="h-4 w-4" />
            Sign Up
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md bg-neutral-800 border-neutral-700 text-white">
          <DialogHeader>
            <DialogTitle>Sign Up</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Create an account to unlock unlimited AI features.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-google-signup"
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign Up with Google
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full bg-neutral-600" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-neutral-800 px-2 text-neutral-400">Or</span>
              </div>
            </div>

            <form onSubmit={handleEmailSignUp} className="space-y-4">
              <div>
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  className="bg-neutral-700 border-neutral-600 text-white"
                  placeholder="Enter your email"
                  required
                  data-testid="input-signup-email"
                />
              </div>
              <div>
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  className="bg-neutral-700 border-neutral-600 text-white"
                  placeholder="Create a password (min 6 characters)"
                  minLength={6}
                  required
                  data-testid="input-signup-password"
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-neutral-700 hover:bg-neutral-600 text-white"
                data-testid="button-signup-submit"
              >
                <Mail className="w-4 h-4 mr-2" />
                Sign Up with Email
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}