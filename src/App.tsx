import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Index from "./pages/Index";
import Stream from "./pages/Stream";
import NotFound from "./pages/NotFound";
import BackgroundV2 from "@/components/background/BackgroundV2";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { ThemeProvider } from "@/theme/ThemeProvider";
import AppDirectory from "@/pages/AppDirectory";
import Watch from "@/pages/Watch";
import GoLive from "@/pages/GoLive";
// Recordings removed to save storage costs
import Vod from "@/pages/Vod";
import Clip from "@/pages/Clip";
import Following from "@/pages/Following";
import Profile from "@/pages/Profile";
import Channel from "@/pages/Channel";
import ChannelSettings from "@/pages/ChannelSettings";
import ClipsPage from "@/pages/Clips";
import Verification from "@/pages/Verification";
import DocsPage from "@/pages/Docs";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import Admin from "@/pages/Admin";
import "@/styles/global-extras.css";
import { WalletProvider } from "@/context/WalletContext";
import { BrowserStreamingProvider } from "@/context/BrowserStreamingContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <WalletProvider>
        <BrowserStreamingProvider>
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
                <Route path="/watch/:streamId" element={<Watch />} />
                <Route path="/go-live" element={<GoLive />} />
                <Route path="/verification" element={<Verification />} />
                <Route path="/clips" element={<ClipsPage />} />
                <Route path="/stream/:streamId" element={<Stream />} />
                {/* Recordings removed to save storage costs */}
                <Route path="/vod/:id" element={<Vod />} />
                <Route path="/clip/:id" element={<Clip />} />
                <Route path="/following" element={<Following />} />
                <Route path="/profile/:id" element={<Profile />} />
                <Route path="/channel/:username" element={<Channel />} />
                <Route path="/channel/settings" element={<ChannelSettings />} />
                <Route path="/docs" element={<DocsPage />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/admin" element={<Admin />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              <SiteFooter />
            </BrowserRouter>
          </TooltipProvider>
        </HelmetProvider>
      </BrowserStreamingProvider>
    </WalletProvider>
  </ThemeProvider>
</QueryClientProvider>
);

export default App;