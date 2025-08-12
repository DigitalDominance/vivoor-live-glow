import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

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
  const cta = path === "/" ? { label: "Start Now", to: "/app" } : path === "/app" ? { label: "Go Live", to: "/go-live" } : { label: "App", to: "/app" };

  return (
    <header className={`${scrolled ? "bg-background/95 border-b border-border/60" : "backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border/60"} sticky top-0 z-40`}>
      <nav className="container mx-auto flex h-16 items-center justify-between px-4">
        <Wordmark />
        <div className="hidden md:flex items-center gap-1">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/app">App</NavLink>
          <a href="/#pricing" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover-scale rounded-md">Pricing</a>
          <a href="/#faq" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover-scale rounded-md">FAQ</a>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="gradientOutline" className="hidden sm:inline-flex" onClick={() => navigate(cta.to)}>
            {cta.label}
          </Button>
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
                <a href="/#pricing" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md">Pricing</a>
                <a href="/#faq" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md">FAQ</a>
                <Button variant="gradientOutline" className="mt-2" onClick={() => navigate(cta.to)}>{cta.label}</Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
};

export default SiteHeader;
