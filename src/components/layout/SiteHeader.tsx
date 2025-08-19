import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import WalletConnectModal from "@/components/modals/WalletConnectModal";
import UsernameModal from "@/components/modals/UsernameModal";
import { useWallet } from "@/context/WalletContext";
import MyProfileModal from "@/components/modals/MyProfileModal";

const NavLink = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <Link to={to} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
    {children}
  </Link>
);

const Wordmark = () => (
  <Link to="/" aria-label="Vivoor home" className="flex items-center gap-2">
    <span className="text-xl font-extrabold font-display tracking-tight text-gradient">Viv</span>
    <span className="relative text-xl font-extrabold font-display tracking-tight text-gradient">
      oo
      <span className="absolute left-0 right-0 -bottom-1 h-0.5 rounded-full bg-grad-primary opacity-70" />
    </span>
    <span className="text-xl font-extrabold font-display tracking-tight text-gradient">r</span>
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
  const { identity, profile, ensureUsername } = useWallet();
  const [walletOpen, setWalletOpen] = useState(false);
  const [usernameOpen, setUsernameOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

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
        <div className="hidden md:flex items-center gap-1">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/app">App</NavLink>
          <NavLink to="/go-live">Go Live</NavLink>
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
                <Button variant="gradientOutline" className="hidden sm:inline-flex z-[60]" aria-label="Account menu">
                  {displayName}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[70]">
                <DropdownMenuItem onSelect={() => navigate("/go-live")} className="uppercase">GO LIVE</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setProfileOpen(true)}>Profile</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate("/recordings")}>My Recordings</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate("/following")}>My Following</DropdownMenuItem>
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
                    <Button variant="gradientOutline" onClick={() => navigate("/go-live")}>GO LIVE</Button>
                    <Button variant="secondary" onClick={() => setProfileOpen(true)}>Profile</Button>
                    <Button variant="ghost" onClick={() => navigate("/recordings")}>My Recordings</Button>
                    <Button variant="ghost" onClick={() => navigate("/following")}>My Following</Button>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
      <WalletConnectModal open={walletOpen} onOpenChange={setWalletOpen} />
      <UsernameModal open={usernameOpen} onOpenChange={setUsernameOpen} />
      <MyProfileModal open={profileOpen} onOpenChange={setProfileOpen} onEditUsername={() => { setProfileOpen(false); setUsernameOpen(true); }} />
    </header>
  );
};

export default SiteHeader;
