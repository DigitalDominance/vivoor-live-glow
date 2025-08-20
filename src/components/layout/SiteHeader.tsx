import { Menu, Video, Clapperboard, User, LogOut, ChevronDown, Home, Grid3X3, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import WalletConnectModal from "@/components/modals/WalletConnectModal";
import UsernameModal from "@/components/modals/UsernameModal";
import { useWallet } from "@/context/WalletContext";
import MyProfileModal from "@/components/modals/MyProfileModal";
import MyClipsModal from "@/components/modals/MyClipsModal";

const Wordmark = () => (
  <Link to="/" aria-label="Vivoor home" className="flex items-center gap-1">
    <img 
      src="/lovable-uploads/a04a5600-e88d-4460-a120-6b5636a3dfdb.png" 
      alt="Vivoor logo" 
      className="h-8 w-auto"
    />
    <span className="text-xl font-extrabold font-display tracking-tight text-gradient">ivoor</span>
  </Link>
);

const SiteHeader = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const path = location.pathname;
  const wallet = useWallet();
  const { identity, profile, ensureUsername } = wallet;
  const [walletOpen, setWalletOpen] = useState(false);
  const [usernameOpen, setUsernameOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showClipsModal, setShowClipsModal] = useState(false);

  useEffect(() => {
    if (identity) {
      const r = ensureUsername();
      if (r.needsUsername) setUsernameOpen(true);
    }
  }, [identity, ensureUsername]);

  const cta = path === "/" ? { label: "Start Now", to: "/app" } : path === "/app" ? { label: "Go Live", to: "/go-live" } : { label: "App", to: "/app" };

  const displayName = useMemo(() => {
    if (profile?.username) return `@${profile.username}`;
    if (identity?.id) return `${identity.id.slice(0, 8)}…`;
    return "Login";
  }, [profile?.username, identity?.id]);

  return (
    <header className={`${scrolled ? "bg-background/95 border-b border-border/60" : "backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border/60"} sticky top-0 z-40`}>
      <nav className="container mx-auto flex h-16 items-center justify-between px-4">
        <Wordmark />
        
        <div className="hidden md:flex items-center gap-2">
          <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <Home className="h-4 w-4" />
            Home
          </Link>
          <Link to="/app" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <Grid3X3 className="h-4 w-4" />
            App
          </Link>
          <Link to="/go-live" className="flex items-center gap-1 text-sm font-bold bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink bg-clip-text text-transparent hover:opacity-80">
            <Zap className="h-4 w-4" />
            GO LIVE
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {!identity ? (
            <Button
              variant="gradientOutline"
              className="hidden sm:inline-flex"
              onClick={() => (path === "/app" ? setWalletOpen(true) : navigate(cta.to))}
            >
              {path === "/app" ? "Login" : cta.label}
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="gradientOutline" size="sm" className="hidden md:flex items-center gap-2 font-bold">
                  {profile?.username || "Anon"}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card/95 backdrop-blur-sm border border-border/50">
                <DropdownMenuLabel className="text-foreground">My Account</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border/50" />
                <DropdownMenuItem onClick={() => setShowProfileModal(true)} className="cursor-pointer hover:bg-accent/50">
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/channel/${profile?.username || identity?.id}`)} className="cursor-pointer hover:bg-accent/50">
                  <Video className="h-4 w-4 mr-2" />
                  My Channel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowClipsModal(true)} className="cursor-pointer hover:bg-accent/50">
                  <Clapperboard className="h-4 w-4 mr-2" />
                  My Clips
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/following")} className="cursor-pointer hover:bg-accent/50">
                  My Following
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/50" />
                <DropdownMenuItem onClick={() => navigate("/go-live")} className="cursor-pointer hover:bg-accent/20 font-bold bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink bg-clip-text text-transparent">
                  <Zap className="h-4 w-4 mr-2" />
                  GO LIVE
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/50" />
                <DropdownMenuItem onClick={wallet.disconnect} className="cursor-pointer hover:bg-destructive/10 text-destructive">
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="glass" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="pt-16">
              <div className="grid gap-2">
                <Link to="/" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md">Home</Link>
                <Link to="/app" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md">App</Link>
                <Link to="/go-live" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md">Go Live</Link>
                {!identity ? (
                  <Button variant="gradientOutline" className="mt-2" onClick={() => (path === "/app" ? setWalletOpen(true) : navigate(cta.to))}>
                    {path === "/app" ? "Login" : cta.label}
                  </Button>
                ) : (
                  <div className="mt-2 grid gap-2">
                    <Button variant="hero" onClick={() => navigate("/go-live")} className="font-bold">
                      GO LIVE
                    </Button>
                    <Button variant="secondary" onClick={() => setShowProfileModal(true)}>
                      <User className="h-4 w-4 mr-2" />
                      Profile
                    </Button>
                    <Button variant="ghost" onClick={() => navigate(`/channel/${profile?.username || wallet.identity?.id}`)}>
                      <Video className="h-4 w-4 mr-2" />
                      My Channel
                    </Button>
                    <Button variant="ghost" onClick={() => setShowClipsModal(true)}>
                      <Clapperboard className="h-4 w-4 mr-2" />
                      My Clips
                    </Button>
                    <Button variant="ghost" onClick={() => navigate("/following")}>My Following</Button>
                    <Button variant="ghost" onClick={wallet.disconnect}>Disconnect</Button>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
      <WalletConnectModal open={walletOpen} onOpenChange={setWalletOpen} />
      <UsernameModal open={usernameOpen} onOpenChange={setUsernameOpen} />
      <MyProfileModal open={showProfileModal} onOpenChange={setShowProfileModal} onEditUsername={() => { setShowProfileModal(false); setUsernameOpen(true); }} />
      <MyClipsModal open={showClipsModal} onOpenChange={setShowClipsModal} />
    </header>
  );
};

export default SiteHeader;