import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <section className="text-center p-8">
        <h1 className="text-5xl font-display font-extrabold text-gradient mb-3">404</h1>
        <p className="text-lg text-muted-foreground mb-6">Oops! Page not found</p>
        <a href="/" className="inline-flex items-center justify-center px-5 h-11 rounded-md gradient-border bg-background hover:shadow-[0_0_0_4px_hsl(var(--brand-cyan)/0.15)]">
          Return to Home
        </a>
      </section>
    </main>
  );
};

export default NotFound;
