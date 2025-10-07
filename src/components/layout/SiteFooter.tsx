const SiteFooter = () => {
  return (
    <footer className="mt-16 border-t border-border/60">
      <div className="container mx-auto px-4 py-10">
        <div className="grid gap-6 md:flex md:items-center md:justify-between mb-4">
          <a href="#top" className="flex items-center gap-1 font-display text-lg font-bold text-gradient">
            <img 
              src="/lovable-uploads/a04a5600-e88d-4460-a120-6b5636a3dfdb.png" 
              alt="Vivoor logo" 
              className="h-6 w-auto"
            />
            ivoor
          </a>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <a className="story-link" href="/docs">Documentation</a>
            <a className="story-link" href="/app">Browse Streams</a>
            <a className="story-link" href="/clips">Clips</a>
            <a className="story-link" href="/verification">Get Verified</a>
          </nav>
        </div>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <a className="story-link" href="/terms">Terms of Service</a>
            <a className="story-link" href="/privacy">Privacy Policy</a>
          </nav>
          <div className="flex items-center gap-4">
            <img 
              src="/lovable-uploads/b08dce0d-1833-4324-9760-6fc5aef6248d.png" 
              alt="Powered by Kaspa" 
              className="h-8 w-auto opacity-80 hover:opacity-100 transition-opacity"
            />
            <div className="text-xs text-muted-foreground">© {new Date().getFullYear()} Vivoor. All rights reserved.</div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
