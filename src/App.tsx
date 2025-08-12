import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import BackgroundV2 from "@/components/background/BackgroundV2";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { ThemeProvider } from "@/theme/ThemeProvider";
import AppDirectory from "@/pages/AppDirectory";
import Watch from "@/pages/Watch";
import GoLive from "@/pages/GoLive";
import "@/styles/global-extras.css";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <HelmetProvider>
        <TooltipProvider>
          <BackgroundV2 />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <SiteHeader />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/app" element={<AppDirectory />} />
              <Route path="/watch/:id" element={<Watch />} />
              <Route path="/go-live" element={<GoLive />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <SiteFooter />
          </BrowserRouter>
        </TooltipProvider>
      </HelmetProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;