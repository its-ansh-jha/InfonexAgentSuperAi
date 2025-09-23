// User menu for authenticated users (hamburger menu replacement)
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { logOut } from '@/lib/firebase';
import { useLocation } from 'wouter';
import { LogOut, User, Settings, FileText, ShieldCheck } from 'lucide-react';

export function UserMenu() {
  const { firebaseUser, user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const handleLogout = async () => {
    try {
      await logOut();
      toast({
        title: "Logged Out",
        description: "You've been successfully logged out.",
        duration: 3000,
      });
    } catch (error: any) {
      toast({
        title: "Logout Failed",
        description: error.message || "Failed to log out.",
        variant: "destructive",
      });
    }
  };

  if (!firebaseUser) return null;

  const displayName = firebaseUser.displayName || user?.displayName || 'User';
  const email = firebaseUser.email || user?.email || '';
  const photoURL = firebaseUser.photoURL || user?.photoURL;

  // Get initials for fallback avatar
  const getInitials = (name: string, fallbackEmail: string) => {
    if (name && name !== 'User') {
      return name
        .split(' ')
        .map(word => word.charAt(0))
        .join('')
        .toUpperCase()
        .substring(0, 2);
    }
    return fallbackEmail.charAt(0).toUpperCase();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="p-2 rounded-full bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-white transition-colors"
          data-testid="button-user-menu"
        >
          <Avatar className="h-6 w-6">
            <AvatarImage 
              src={photoURL || undefined} 
              alt={displayName}
              className="object-cover"
            />
            <AvatarFallback className="bg-neutral-600 text-white text-xs">
              {getInitials(displayName, email)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="bg-neutral-800 border-neutral-700 text-white min-w-[200px]"
        data-testid="menu-user-dropdown"
      >
        {/* User Info */}
        <div className="px-3 py-2">
          <div className="flex items-center space-x-2">
            <Avatar className="h-8 w-8">
              <AvatarImage 
                src={photoURL || undefined} 
                alt={displayName}
                className="object-cover"
              />
              <AvatarFallback className="bg-neutral-600 text-white text-sm">
                {getInitials(displayName, email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium" data-testid="text-user-name">
                {displayName}
              </span>
              <span className="text-xs text-neutral-400 truncate" data-testid="text-user-email">
                {email}
              </span>
            </div>
          </div>
        </div>
        
        <DropdownMenuSeparator className="bg-neutral-700" />
        
        {/* Menu Items */}
        <DropdownMenuItem 
          className="hover:bg-neutral-700 cursor-pointer" 
          onClick={() => navigate("/privacy-policy")}
          data-testid="menu-privacy-policy"
        >
          <ShieldCheck className="h-4 w-4 mr-2" />
          Privacy Policy
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          className="hover:bg-neutral-700 cursor-pointer" 
          onClick={() => navigate("/terms-conditions")}
          data-testid="menu-terms-conditions"
        >
          <FileText className="h-4 w-4 mr-2" />
          Terms & Conditions
        </DropdownMenuItem>
        
        <DropdownMenuSeparator className="bg-neutral-700" />
        
        <DropdownMenuItem 
          className="hover:bg-neutral-700 cursor-pointer text-red-400 hover:text-red-300" 
          onClick={handleLogout}
          data-testid="menu-logout"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Log Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}