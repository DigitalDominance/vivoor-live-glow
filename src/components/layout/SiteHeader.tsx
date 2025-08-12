import { Menu } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
    {children}
  </a>
);

const Wordmark = () => (
  <a href="#top" aria-label="Vivoor home" className="flex items-center gap-2">
    <span className="text-xl font-extrabold font-display tracking-tight text-gradient">Viv</span>
    <span className="relative text-xl font-extrabold font-display tracking-tight text-gradient">
      oo
      <span className="absolute left-0 right-0 -bottom-1 h-0.5 rounded-full bg-grad-primary opacity-70" />
    </span>
    <span className="text-xl font-extrabold font-display tracking-tight text-gradient">r</span>
  </a>
);

const SiteHeader = () => {
  return (
    <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border/60">
      <nav className="container mx-auto flex h-16 items-center justify-between px-4">
        <Wordmark />
        <div className="hidden md:flex items-center gap-1">
          <NavLink href="#features">Features</NavLink>
          <NavLink href="#creators">Creators</NavLink>
          <NavLink href="#pricing">Pricing</NavLink>
          <NavLink href="#faq">FAQ</NavLink>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="gradientOutline" className="hidden sm:inline-flex">Get the App</Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="glass" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="pt-16">
              <div className="grid gap-2">
                <NavLink href="#features">Features</NavLink>
                <NavLink href="#creators">Creators</NavLink>
                <NavLink href="#pricing">Pricing</NavLink>
                <NavLink href="#faq">FAQ</NavLink>
                <Button variant="gradientOutline" className="mt-2">Get the App</Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
};

export default SiteHeader;
