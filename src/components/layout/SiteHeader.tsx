import { Menu, Video, Clapperboard, User, LogOut, ChevronDown, Home, Grid3X3, Zap, X, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
          <Link to="/clips" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <Clapperboard className="h-4 w-4" />
            Clips
          </Link>
          <Link to="/go-live" className="flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground">
            <Zap className="h-4 w-4 text-brand-cyan" />
            <span className="font-bold">GO LIVE</span>
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
                  Edit Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/channel/${profile?.username || identity?.id}`)} className="cursor-pointer hover:bg-accent/50">
                  <Video className="h-4 w-4 mr-2" />
                  My Channel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/following")} className="cursor-pointer hover:bg-accent/50">
                  <Users className="h-4 w-4 mr-2" />
                  My Following
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/50" />
                <DropdownMenuItem onClick={() => navigate("/go-live")} className="cursor-pointer hover:bg-accent/20">
                  <Zap className="h-4 w-4 mr-2 text-brand-cyan" />
                  <span className="font-bold">GO LIVE</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/verification")} className="cursor-pointer hover:bg-accent/20">
                  <User className="h-4 w-4 mr-2 text-brand-iris" />
                  <span className="font-bold">Verification</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/50" />
                <DropdownMenuItem onClick={wallet.disconnect} className="cursor-pointer hover:bg-destructive/10 text-destructive">
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          <div className="md:hidden relative">
            <Button 
              variant="glass" 
              size="icon" 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
              className="relative z-50"
            >
              <AnimatePresence mode="wait">
                {mobileMenuOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <X className="h-4 w-4" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Menu className="h-4 w-4" />
                  </motion.div>
                )}
              </AnimatePresence>
            </Button>

            <AnimatePresence>
              {mobileMenuOpen && (
                <>
                  {/* Backdrop */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[9998]"
                    onClick={() => setMobileMenuOpen(false)}
                  />
                  
                  {/* Menu Content */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -20 }}
                    transition={{ 
                      type: "spring",
                      stiffness: 300,
                      damping: 30,
                      duration: 0.3
                    }}
                    className="absolute top-full right-0 mt-2 w-72 p-4 bg-gradient-to-br from-background/95 via-background/90 to-background/95 backdrop-blur-lg border border-border/50 rounded-xl shadow-2xl z-[9999]"
                    style={{
                      background: 'linear-gradient(135deg, hsl(var(--background)/0.95) 0%, hsl(var(--card)/0.9) 50%, hsl(var(--background)/0.95) 100%)'
                    }}
                  >
                    {/* Navigation Links */}
                    <div className="space-y-2 mb-4">
                      {[
                        { icon: Home, label: "Home", path: "/" },
                        { icon: Grid3X3, label: "App", path: "/app" },
                        { icon: Clapperboard, label: "Clips", path: "/clips" },
                        { icon: Zap, label: "GO LIVE", path: "/go-live", highlight: true }
                      ].map((item, index) => (
                        <motion.div
                          key={item.path}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 + 0.1, duration: 0.3 }}
                        >
                          <Link
                            to={item.path}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group ${
                              item.highlight 
                                ? 'bg-gradient-to-r from-brand-cyan/20 via-brand-iris/20 to-brand-pink/20 border border-brand-iris/30 hover:from-brand-cyan/30 hover:via-brand-iris/30 hover:to-brand-pink/30' 
                                : 'hover:bg-accent/50 hover:scale-[1.02]'
                            }`}
                          >
                            <item.icon className={`h-5 w-5 transition-colors ${
                              item.highlight ? 'text-brand-cyan' : 'text-muted-foreground group-hover:text-foreground'
                            }`} />
                            <span className={`font-medium transition-colors ${
                              item.highlight ? 'text-foreground font-bold' : 'text-muted-foreground group-hover:text-foreground'
                            }`}>
                              {item.label}
                            </span>
                          </Link>
                        </motion.div>
                      ))}
                    </div>

                    {/* Auth Section */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5, duration: 0.3 }}
                      className="pt-3 border-t border-border/30"
                    >
                      {!identity ? (
                        <Button 
                          variant="gradientOutline" 
                          className="w-full"
                          onClick={() => {
                            setMobileMenuOpen(false);
                            path === "/app" ? setWalletOpen(true) : navigate(cta.to);
                          }}
                        >
                          {path === "/app" ? "Login" : cta.label}
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <div className="text-xs text-muted-foreground px-2 mb-3">
                            Logged in as <span className="font-medium text-foreground">{profile?.username || "Anonymous"}</span>
                          </div>
                          
                          {[
                            { icon: User, label: "Edit Profile", action: () => setShowProfileModal(true) },
                            { icon: Video, label: "My Channel", action: () => navigate(`/channel/${profile?.username || wallet.identity?.id}`) }
                          ].map((item, index) => (
                            <motion.div
                              key={item.label}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.6 + index * 0.05, duration: 0.2 }}
                            >
                              <Button
                                variant="ghost"
                                className="w-full justify-start h-9 text-sm hover:bg-accent/50"
                                onClick={() => {
                                  setMobileMenuOpen(false);
                                  item.action();
                                }}
                              >
                                <item.icon className="h-4 w-4 mr-3" />
                                {item.label}
                              </Button>
                            </motion.div>
                          ))}
                          
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.8, duration: 0.2 }}
                            className="pt-2 mt-2 border-t border-border/20"
                          >
                            <Button
                              variant="ghost"
                              className="w-full justify-start h-9 text-sm text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setMobileMenuOpen(false);
                                wallet.disconnect();
                              }}
                            >
                              <LogOut className="h-4 w-4 mr-3" />
                              Disconnect
                            </Button>
                          </motion.div>
                        </div>
                      )}
                    </motion.div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </nav>
      <WalletConnectModal open={walletOpen} onOpenChange={setWalletOpen} />
      <UsernameModal open={usernameOpen} onOpenChange={setUsernameOpen} />
      <MyProfileModal open={showProfileModal} onOpenChange={setShowProfileModal} onEditUsername={() => { setShowProfileModal(false); setUsernameOpen(true); }} />
      
    </header>
  );
};

export default SiteHeader;