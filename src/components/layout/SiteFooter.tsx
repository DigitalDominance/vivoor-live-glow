const SiteFooter = () => {
  return (
    <footer className="mt-16 border-t border-border/60">
      <div className="container mx-auto px-4 py-10 grid gap-6 md:flex md:items-center md:justify-between">
        <a href="#top" className="font-display text-lg font-bold text-gradient">Vivoor</a>
        <nav className="flex gap-4 text-sm text-muted-foreground">
          <a className="story-link" href="#features">Features</a>
          <a className="story-link" href="#creators">Creators</a>
          <a className="story-link" href="#pricing">Pricing</a>
          <a className="story-link" href="#faq">FAQ</a>
        </nav>
        <div className="text-xs text-muted-foreground">© {new Date().getFullYear()} Vivoor. All rights reserved.</div>
      </div>
    </footer>
  );
};

export default SiteFooter;
