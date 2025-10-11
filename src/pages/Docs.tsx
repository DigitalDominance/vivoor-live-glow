import React from "react";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Zap, 
  Play, 
  Heart, 
  Users, 
  Scissors, 
  Shield, 
  Coins, 
  Video, 
  MessageCircle, 
  Settings,
  UserCheck,
  Eye,
  Download,
  Star,
  TrendingUp,
  CheckCircle,
  Wallet,
  Upload,
  Camera,
  Edit
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const DocsPage = () => {
  const navigate = useNavigate();

  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 }
  };

  const staggerContainer = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Documentation - Complete Guide to Vivoor | Vivoor</title>
        <meta name="description" content="Complete guide to using Vivoor - from streaming and tipping with Kaspa to creating clips and getting verified. Learn everything about our web3 streaming platform." />
        <meta name="keywords" content="vivoor guide, kaspa streaming guide, crypto streaming documentation, web3 streaming tutorial, livepeer streaming, kas tipping guide" />
        <link rel="canonical" href="https://vivoor.live/docs" />
      </Helmet>

      {/* GitBook-style sidebar navigation */}
      <div className="fixed inset-y-0 left-0 w-64 bg-background border-r border-border z-40 hidden lg:block">
        <div className="p-6">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4">Documentation</h2>
          <nav className="space-y-2">
            <a href="#getting-started" className="block text-sm hover:text-primary transition-colors py-1" onClick={(e) => { e.preventDefault(); const element = document.getElementById('getting-started'); if (element) { const top = element.getBoundingClientRect().top + window.pageYOffset - 80; window.scrollTo({ top, behavior: 'smooth' }); } }}>Getting Started</a>
            <a href="#watching" className="block text-sm hover:text-primary transition-colors py-1" onClick={(e) => { e.preventDefault(); const element = document.getElementById('watching'); if (element) { const top = element.getBoundingClientRect().top + window.pageYOffset - 80; window.scrollTo({ top, behavior: 'smooth' }); } }}>Watching Streams</a>
            <a href="#tipping" className="block text-sm hover:text-primary transition-colors py-1" onClick={(e) => { e.preventDefault(); const element = document.getElementById('tipping'); if (element) { const top = element.getBoundingClientRect().top + window.pageYOffset - 80; window.scrollTo({ top, behavior: 'smooth' }); } }}>Tipping with KAS</a>
            <a href="#streaming" className="block text-sm hover:text-primary transition-colors py-1" onClick={(e) => { e.preventDefault(); const element = document.getElementById('streaming'); if (element) { const top = element.getBoundingClientRect().top + window.pageYOffset - 80; window.scrollTo({ top, behavior: 'smooth' }); } }}>Live Streaming</a>
            <a href="#clips" className="block text-sm hover:text-primary transition-colors py-1" onClick={(e) => { e.preventDefault(); const element = document.getElementById('clips'); if (element) { const top = element.getBoundingClientRect().top + window.pageYOffset - 80; window.scrollTo({ top, behavior: 'smooth' }); } }}>Creating Clips</a>
            <a href="#verification" className="block text-sm hover:text-primary transition-colors py-1" onClick={(e) => { e.preventDefault(); const element = document.getElementById('verification'); if (element) { const top = element.getBoundingClientRect().top + window.pageYOffset - 80; window.scrollTo({ top, behavior: 'smooth' }); } }}>Getting Verified</a>
            <a href="#kns" className="block text-sm hover:text-primary transition-colors py-1" onClick={(e) => { e.preventDefault(); const element = document.getElementById('kns'); if (element) { const top = element.getBoundingClientRect().top + window.pageYOffset - 80; window.scrollTo({ top, behavior: 'smooth' }); } }}>Enabling KNS</a>
            <a href="#profile" className="block text-sm hover:text-primary transition-colors py-1" onClick={(e) => { e.preventDefault(); const element = document.getElementById('profile'); if (element) { const top = element.getBoundingClientRect().top + window.pageYOffset - 80; window.scrollTo({ top, behavior: 'smooth' }); } }}>Profile Management</a>
            <a href="#following" className="block text-sm hover:text-primary transition-colors py-1" onClick={(e) => { e.preventDefault(); const element = document.getElementById('following'); if (element) { const top = element.getBoundingClientRect().top + window.pageYOffset - 80; window.scrollTo({ top, behavior: 'smooth' }); } }}>Following Users</a>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <main className="lg:pl-64">
        {/* Add background aurora for GitBook feel */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute top-20 left-10 w-32 h-32 bg-brand-cyan rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-32 h-32 bg-brand-iris rounded-full blur-3xl animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-brand-pink rounded-full blur-3xl animate-pulse delay-2000" />
        </div>

        <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <motion.div 
          className="text-center mb-16"
          {...fadeInUp}
        >
          <motion.h1 
            className="text-5xl md:text-7xl font-bold mb-6"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            <span className="bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink bg-clip-text text-transparent">
              Vivoor Documentation
            </span>
          </motion.h1>
          <motion.p 
            className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            Your complete guide to streaming, earning, and building community on the world's first Kaspa-powered streaming platform
          </motion.p>
          <motion.div
            className="flex justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <Button variant="hero" size="lg" onClick={() => navigate('/app')}>
              Start Streaming
            </Button>
            <Button variant="gradientOutline" size="lg" onClick={() => navigate('/verification')}>
              Get Verified
            </Button>
          </motion.div>
        </motion.div>

        {/* Introduction Card */}
        <motion.div className="mb-16" {...fadeInUp}>
          <Card className="border-brand-iris/20 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-3">
                <Zap className="w-8 h-8 text-brand-iris" />
                Welcome to the Future of Streaming
              </CardTitle>
            </CardHeader>
            <CardContent className="text-lg space-y-4">
              <p>
                Vivoor revolutionizes live streaming by combining cutting-edge technology with the power of cryptocurrency. 
                Built on <span className="text-brand-cyan font-semibold">Kaspa</span> (the fastest Proof-of-Work blockchain) 
                and powered by <span className="text-brand-iris font-semibold">Livepeer</span> (decentralized video infrastructure), 
                we're pioneering the next generation of creator economy.
              </p>
              <div className="grid md:grid-cols-3 gap-6 mt-8">
                <div className="text-center p-4 rounded-lg bg-brand-cyan/10 border border-brand-cyan/20">
                  <Coins className="w-8 h-8 text-brand-cyan mx-auto mb-2" />
                  <h3 className="font-semibold mb-1">Zero-Fee Tipping</h3>
                  <p className="text-sm text-muted-foreground">Unlike traditional platforms, we don't take any cut from your tips</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-brand-iris/10 border border-brand-iris/20">
                  <Video className="w-8 h-8 text-brand-iris mx-auto mb-2" />
                  <p className="font-semibold mb-1">Instant Streaming</p>
                  <p className="text-sm text-muted-foreground">Go live in seconds with ultra-low latency</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-brand-pink/10 border border-brand-pink/20">
                  <Shield className="w-8 h-8 text-brand-pink mx-auto mb-2" />
                  <h3 className="font-semibold mb-1">Web3 Security</h3>
                  <p className="text-sm text-muted-foreground">Decentralized infrastructure you can trust</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Table of Contents */}
        <motion.div 
          className="grid gap-8 mb-16"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          <motion.h2 
            className="text-3xl font-bold text-center"
            variants={fadeInUp}
          >
            <span className="bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink bg-clip-text text-transparent">
              Complete User Guide
            </span>
          </motion.h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Getting Started */}
            <motion.div variants={fadeInUp}>
              <Card className="h-full border-brand-cyan/20 hover:border-brand-cyan/40 transition-all duration-300 hover:shadow-lg hover:shadow-brand-cyan/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-brand-cyan">
                    <Wallet className="w-5 h-5" />
                    Getting Started
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Connecting Your Kaspa Wallet
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Setting Up Your Profile
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Understanding the Interface
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Streaming */}
            <motion.div variants={fadeInUp}>
              <Card className="h-full border-brand-iris/20 hover:border-brand-iris/40 transition-all duration-300 hover:shadow-lg hover:shadow-brand-iris/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-brand-iris">
                    <Video className="w-5 h-5" />
                    Live Streaming
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Creating Your First Stream
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    OBS Setup & Configuration
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Stream Management
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Earning */}
            <motion.div variants={fadeInUp}>
              <Card className="h-full border-brand-pink/20 hover:border-brand-pink/40 transition-all duration-300 hover:shadow-lg hover:shadow-brand-pink/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-brand-pink">
                    <Coins className="w-5 h-5" />
                    Earning with KAS
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Receiving Tips
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Zero-Fee Advantage
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Tip Notifications
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.div>

        {/* Detailed Sections */}
        <motion.div className="space-y-16">
          
          {/* Getting Started */}
          <motion.section id="getting-started" variants={fadeInUp}>
            <Card className="border-brand-cyan/20">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <Wallet className="w-8 h-8 text-brand-cyan" />
                  Getting Started with Vivoor
                </CardTitle>
                <CardDescription>Everything you need to know to begin your streaming journey</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-brand-cyan text-white text-sm flex items-center justify-center">1</span>
                    Connect Your Kaspa Wallet
                  </h3>
                  <p className="text-muted-foreground mb-3">
                    To use Vivoor, you'll need a Kaspa wallet. We recommend <strong>Kasware</strong> for the best experience.
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                    <li>Download and install Kasware browser extension</li>
                    <li>Create or import your Kaspa wallet</li>
                    <li>Click "Connect Wallet" in the top right of Vivoor</li>
                    <li>Approve the connection to link your wallet</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-brand-iris text-white text-sm flex items-center justify-center">2</span>
                    Set Up Your Profile
                  </h3>
                  <p className="text-muted-foreground mb-3">
                    Your profile is automatically created when you connect your wallet. You can customize it by:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                    <li>Adding a profile picture and display name</li>
                    <li>Writing a bio to tell your story</li>
                    <li>Setting your handle/username</li>
                    <li>Configuring channel settings for streaming</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-brand-pink text-white text-sm flex items-center justify-center">3</span>
                    Explore the Platform
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 border border-border rounded-lg">
                      <h4 className="font-medium mb-2">Directory</h4>
                      <p className="text-sm text-muted-foreground">Browse live streams by category and discover new creators</p>
                    </div>
                    <div className="p-4 border border-border rounded-lg">
                      <h4 className="font-medium mb-2">Clips</h4>
                      <p className="text-sm text-muted-foreground">Watch highlighted moments and trending clips from the community</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* Watching Streams */}
          <motion.section id="watching" variants={fadeInUp}>
            <Card className="border-brand-iris/20">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <Play className="w-8 h-8 text-brand-iris" />
                  Watching Streams
                </CardTitle>
                <CardDescription>How to discover, watch, and interact with live content</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Eye className="w-5 h-5 text-brand-iris" />
                      Finding Streams
                    </h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Browse the main directory for live streams</li>
                      <li>• Filter by category (Gaming, Music, IRL, Talk, etc.)</li>
                      <li>• Follow creators to see when they go live</li>
                      <li>• Check your "Following" page for updates</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <MessageCircle className="w-5 h-5 text-brand-iris" />
                      Chat & Interaction
                    </h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Join the real-time chat discussion</li>
                      <li>• Like streams to show appreciation</li>
                      <li>• Follow streamers you enjoy</li>
                      <li>• Send KAS tips to support creators</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* Tipping with KAS */}
          <motion.section id="tipping" variants={fadeInUp}>
            <Card className="border-brand-pink/20">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <Coins className="w-8 h-8 text-brand-pink" />
                  Tipping with Kaspa (KAS)
                </CardTitle>
                <CardDescription>Support your favorite creators with instant, zero-fee cryptocurrency tips</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 border border-brand-pink/20 rounded-lg bg-brand-pink/5">
                  <h3 className="font-semibold text-brand-pink mb-2">🚀 Revolutionary Zero-Fee Tipping</h3>
                  <p className="text-sm">
                    Unlike traditional platforms that take 30-50% cuts, Vivoor doesn't take ANY fees from tips. 
                    100% of your support goes directly to creators, powered by Kaspa's ultra-fast blockchain.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">How to Send Tips</h3>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-brand-cyan text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                      <div>
                        <p className="font-medium">Connect Your Wallet</p>
                        <p className="text-sm text-muted-foreground">Make sure your Kaspa wallet is connected and has KAS balance</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-brand-iris text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                      <div>
                        <p className="font-medium">Click "Tip in KAS"</p>
                        <p className="text-sm text-muted-foreground">Find the tip button on any stream you're watching</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-brand-pink text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                      <div>
                        <p className="font-medium">Choose Amount & Message</p>
                        <p className="text-sm text-muted-foreground">Select tip amount and add an optional message for the streamer</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-brand-cyan text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                      <div>
                        <p className="font-medium">Confirm Transaction</p>
                        <p className="text-sm text-muted-foreground">Approve the transaction in your wallet - it processes instantly!</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 border border-border rounded-lg">
                    <h4 className="font-semibold text-brand-cyan mb-2">Why Kaspa?</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Fastest Proof-of-Work blockchain</li>
                      <li>• Sub-second transaction confirmation</li>
                      <li>• Extremely low fees (fractions of a penny)</li>
                      <li>• Environmentally efficient mining</li>
                    </ul>
                  </div>
                  <div className="p-4 border border-border rounded-lg">
                    <h4 className="font-semibold text-brand-iris mb-2">Tip Notifications</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Beautiful animated notifications appear on stream</li>
                      <li>• Your message is displayed to everyone</li>
                      <li>• Tips are verified on the blockchain</li>
                      <li>• Real-time updates for streamers</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* Creating Clips */}
          <motion.section id="clips" variants={fadeInUp}>
            <Card className="border-brand-cyan/20">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <Scissors className="w-8 h-8 text-brand-cyan" />
                  Creating & Sharing Clips
                </CardTitle>
                <CardDescription>Capture and share the best moments from streams</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">How to Create Clips</h3>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-brand-cyan text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                      <div>
                        <p className="font-medium">Find the Perfect Moment</p>
                        <p className="text-sm text-muted-foreground">While watching a stream, look for exciting, funny, or memorable moments</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-brand-iris text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                      <div>
                        <p className="font-medium">Click the Clip Button</p>
                        <p className="text-sm text-muted-foreground">Look for the scissors icon in the video player controls</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-brand-pink text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                      <div>
                        <p className="font-medium">Set Your Clip Duration</p>
                        <p className="text-sm text-muted-foreground">Choose start and end times (up to 60 seconds) and add a title</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-brand-cyan text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                      <div>
                        <p className="font-medium">Share & Discover</p>
                        <p className="text-sm text-muted-foreground">Your clip is instantly shareable and appears in the clips directory</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 border border-border rounded-lg">
                    <h4 className="font-semibold text-brand-iris mb-2">Clip Discovery</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Browse trending clips on the Clips page</li>
                      <li>• Sort by most viewed, most liked, or newest</li>
                      <li>• Search for specific content or creators</li>
                      <li>• Like clips to boost their visibility</li>
                    </ul>
                  </div>
                  <div className="p-4 border border-border rounded-lg">
                    <h4 className="font-semibold text-brand-pink mb-2">Clip Features</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• High-quality video processing via Livepeer</li>
                      <li>• Automatic thumbnail generation</li>
                      <li>• Shareable direct links</li>
                      <li>• View counts and engagement metrics</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* Going Live */}
          <motion.section id="streaming" variants={fadeInUp}>
            <Card className="border-brand-iris/20">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <Camera className="w-8 h-8 text-brand-iris" />
                  Going Live - Complete Streaming Guide
                </CardTitle>
                <CardDescription>Everything you need to know about streaming on Vivoor</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 border border-brand-iris/20 rounded-lg bg-brand-iris/5">
                  <h3 className="font-semibold text-brand-iris mb-2">🎥 Powered by Livepeer Network</h3>
                  <p className="text-sm">
                    Vivoor uses Livepeer, the world's decentralized video infrastructure, to provide 
                    high-quality, low-latency streaming that scales globally.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Streaming Options</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Vivoor offers two ways to go live: RTMP streaming with professional software (OBS) or direct In Browser streaming using your camera and microphone.
                  </p>
                </div>

                {/* RTMP Streaming */}
                <div className="border border-brand-iris/20 rounded-lg p-6 bg-brand-iris/5">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Video className="w-5 h-5 text-brand-iris" />
                    RTMP Streaming (OBS & Professional Software)
                  </h3>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-brand-cyan text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                      <div>
                        <p className="font-medium">Go to "Go Live" Page</p>
                        <p className="text-sm text-muted-foreground">Navigate to /go-live and fill out your stream details</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-brand-iris text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                      <div>
                        <p className="font-medium">Set Stream Information</p>
                        <p className="text-sm text-muted-foreground">Choose a title, category, and optional custom thumbnail</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-brand-pink text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                      <div>
                        <p className="font-medium">Pay Treasury Fee</p>
                        <p className="text-sm text-muted-foreground">One-time 1.2 KAS fee per stream (helps maintain platform infrastructure)</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-brand-cyan text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                      <div>
                        <p className="font-medium">Get RTMP Details</p>
                        <p className="text-sm text-muted-foreground">Receive your unique ingest URL and stream key for OBS</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="font-semibold mb-3">OBS Studio Setup</h4>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h5 className="font-medium mb-2">Stream Settings</h5>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• Service: Custom...</li>
                          <li>• Server: Your provided Ingest URL</li>
                          <li>• Stream Key: Your unique stream key</li>
                        </ul>
                      </div>
                      <div>
                        <h5 className="font-medium mb-2">Recommended Output</h5>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• Encoder: x264 or NVENC H.264</li>
                          <li>• Bitrate: 3500-6000 Kbps (1080p)</li>
                          <li>• Keyframe Interval: 2 seconds</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* In Browser Streaming */}
                <div className="border border-brand-cyan/20 rounded-lg p-6 bg-brand-cyan/5">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Camera className="w-5 h-5 text-brand-cyan" />
                    In Browser Streaming (Camera & Audio Only)
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Stream directly from your browser using your webcam and microphone - no additional software required!
                  </p>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-brand-cyan text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                      <div>
                        <p className="font-medium">Go to "Go Live" Page</p>
                        <p className="text-sm text-muted-foreground">Navigate to /go-live to begin setting up your stream</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-brand-iris text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                      <div>
                        <p className="font-medium">Enter Stream Title & Thumbnail</p>
                        <p className="text-sm text-muted-foreground">Choose a compelling title and upload a custom thumbnail for your stream</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-brand-pink text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                      <div>
                        <p className="font-medium">Click "Start Camera Stream"</p>
                        <p className="text-sm text-muted-foreground">Grant camera and microphone permissions when prompted by your browser</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-brand-cyan text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                      <div>
                        <p className="font-medium">Start Camera & Pay Fee</p>
                        <p className="text-sm text-muted-foreground">Click start camera and pay the 1.2 KAS treasury fee to begin your broadcast</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-brand-iris text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">5</span>
                      <div>
                        <p className="font-medium">Enjoy Streaming!</p>
                        <p className="text-sm text-muted-foreground">You're now live! Interact with your viewers and receive tips directly</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Stream Management</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="p-4 border border-border rounded-lg">
                      <h4 className="font-medium mb-2">Live Monitoring</h4>
                      <p className="text-sm text-muted-foreground">Track viewer count, stream health, and tip notifications in real-time</p>
                    </div>
                    <div className="p-4 border border-border rounded-lg">
                      <h4 className="font-medium mb-2">Donations History</h4>
                      <p className="text-sm text-muted-foreground">View all donations during your stream by clicking the $ button on your stream page</p>
                    </div>
                    <div className="p-4 border border-border rounded-lg">
                      <h4 className="font-medium mb-2">Auto-End Protection</h4>
                      <p className="text-sm text-muted-foreground">Streams automatically end after 1 minute of disconnection</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* Following System */}
          <motion.section id="following" variants={fadeInUp}>
            <Card className="border-brand-pink/20">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <Users className="w-8 h-8 text-brand-pink" />
                  Following & Community
                </CardTitle>
                <CardDescription>Build connections and stay updated with your favorite creators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Heart className="w-5 h-5 text-brand-pink" />
                      Following Creators
                    </h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Click "Follow" on any creator's profile</li>
                      <li>• Get notified when they go live</li>
                      <li>• Access your Following page for updates</li>
                      <li>• Support creators by engaging with content</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Star className="w-5 h-5 text-brand-iris" />
                      Creator Profiles
                    </h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• View creator's recent streams and clips</li>
                      <li>• See follower counts and engagement</li>
                      <li>• Browse their content history</li>
                      <li>• Quick access to their live streams</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* Verification */}
          <motion.section id="verification" variants={fadeInUp}>
            <Card className="border-brand-cyan/20">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <UserCheck className="w-8 h-8 text-brand-cyan" />
                  Getting Verified
                </CardTitle>
                <CardDescription>Stand out with official verification and enhanced credibility</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 border border-brand-cyan/20 rounded-lg bg-brand-cyan/5">
                  <h3 className="font-semibold text-brand-cyan mb-2">✨ Why Get Verified?</h3>
                  <p className="text-sm">
                    Verification builds trust with your audience, shows you're a serious creator, 
                    and gives you a distinctive badge across the platform.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Verification Plans</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 border border-brand-iris/20 rounded-lg">
                      <h4 className="font-semibold text-brand-iris mb-2">Monthly Verification</h4>
                      <p className="text-2xl font-bold text-brand-iris mb-2">100 KAS</p>
                      <p className="text-sm text-muted-foreground mb-3">Perfect for trying verification benefits</p>
                      <ul className="text-sm space-y-1">
                        <li>• ✓ Verified badge on profile & streams</li>
                        <li>• ✓ Enhanced credibility</li>
                        <li>• ✓ Priority support</li>
                        <li>• ✓ Valid for 30 days</li>
                      </ul>
                    </div>
                    <div className="p-4 border border-brand-pink/20 rounded-lg bg-brand-pink/5">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-brand-pink">Yearly Verification</h4>
                        <span className="text-xs bg-brand-pink text-white px-2 py-1 rounded">Best Value</span>
                      </div>
                      <p className="text-2xl font-bold text-brand-pink mb-2">1000 KAS</p>
                      <p className="text-sm text-muted-foreground mb-3">Save ~17% vs monthly plan</p>
                      <ul className="text-sm space-y-1">
                        <li>• ✓ All monthly benefits</li>
                        <li>• ✓ Annual savings</li>
                        <li>• ✓ Valid for 365 days</li>
                        <li>• ✓ Priority creator features</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">How to Get Verified</h3>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-brand-cyan text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                      <div>
                        <p className="font-medium">Visit Verification Page</p>
                        <p className="text-sm text-muted-foreground">Go to /verification to see available plans</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-brand-iris text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                      <div>
                        <p className="font-medium">Choose Your Plan</p>
                        <p className="text-sm text-muted-foreground">Select monthly or yearly verification</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-brand-pink text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                      <div>
                        <p className="font-medium">Pay with KAS</p>
                        <p className="text-sm text-muted-foreground">Complete payment through your connected wallet</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-brand-cyan text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                      <div>
                        <p className="font-medium">Instant Verification</p>
                        <p className="text-sm text-muted-foreground">Your verified badge appears immediately after confirmation</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* Enabling KNS */}
          <motion.section id="kns" variants={fadeInUp}>
            <Card className="border-brand-pink/20">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <Shield className="w-8 h-8 text-brand-pink" />
                  Enabling KNS
                </CardTitle>
                <CardDescription>Display your Kaspa Name Service domain and create a memorable donation address</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 border border-brand-pink/20 rounded-lg bg-brand-pink/5">
                  <h3 className="font-semibold text-brand-pink mb-2">✨ What is KNS?</h3>
                  <p className="text-sm">
                    KNS (Kaspa Name Service) allows you to replace your long wallet address with a memorable domain name like "yourname.kas". 
                    Once enabled, your KNS badge will appear on your clips, streams, and channel while also providing supporters with an easy-to-remember donation address.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">How to Enable KNS Badge</h3>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-brand-cyan text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                      <div>
                        <a 
                          href="https://app.knsdomains.org/" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="font-medium hover:text-brand-pink transition-colors cursor-pointer"
                        >
                          Obtain a KNS Domain
                        </a>
                        <p className="text-sm text-muted-foreground">Mint or receive a KNS domain for your connected Kaspa wallet address</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-brand-iris text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                      <div>
                        <p className="font-medium">Go to Edit Profile</p>
                        <p className="text-sm text-muted-foreground">Click on your profile and select "Edit Profile"</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-brand-pink text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                      <div>
                        <p className="font-medium">Enable Show KNS Badge</p>
                        <p className="text-sm text-muted-foreground">Toggle the "Show KNS Badge" option to automatically fetch and display your KNS domain</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-brand-cyan text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                      <div>
                        <p className="font-medium">Enjoy Your KNS!</p>
                        <p className="text-sm text-muted-foreground">Your KNS badge will now appear across your profile, clips, and streams. Show off your awesome KNS domain and supporters can hover over it to see your wallet address and easily send you KAS!</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 border border-border rounded-lg">
                    <h4 className="font-medium mb-2">Memorable Address</h4>
                    <p className="text-sm text-muted-foreground">Instead of users not being able to memorize your wallet address, they can now see or remember your KNS domain and send tips through KasWare wallet or other wallets that support sending via KNS address</p>
                  </div>
                  <div className="p-4 border border-border rounded-lg">
                    <h4 className="font-medium mb-2">Professional Branding</h4>
                    <p className="text-sm text-muted-foreground">Your KNS badge appears on all your content, enhancing your brand identity across the platform</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* Profile Management */}
          <motion.section id="profile" variants={fadeInUp}>
            <Card className="border-brand-iris/20">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <Edit className="w-8 h-8 text-brand-iris" />
                  Profile & Channel Management
                </CardTitle>
                <CardDescription>Customize your presence and manage your content</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Settings className="w-5 h-5 text-brand-iris" />
                      Profile Settings
                    </h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Edit display name and handle</li>
                      <li>• Upload profile picture and banner</li>
                      <li>• Write compelling bio</li>
                      <li>• Set social media links</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Video className="w-5 h-5 text-brand-pink" />
                      Channel Settings
                    </h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Configure stream categories</li>
                      <li>• Set default stream titles</li>
                      <li>• Manage stream thumbnails</li>
                      <li>• View stream analytics</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Editing Your Information</h3>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-brand-cyan text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                      <div>
                        <p className="font-medium">Username & Display Name</p>
                        <p className="text-sm text-muted-foreground">Access profile modal to edit your handle and display name</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-brand-iris text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                      <div>
                        <p className="font-medium">Profile Picture</p>
                        <p className="text-sm text-muted-foreground">Upload and crop custom profile pictures for your identity</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <span className="w-6 h-6 rounded-full bg-brand-pink text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                      <div>
                        <p className="font-medium">Channel Customization</p>
                        <p className="text-sm text-muted-foreground">Visit /channel/settings to configure your streaming presence</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* Technical Details */}
          <motion.section id="technical" variants={fadeInUp}>
            <Card className="border-brand-pink/20">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <Zap className="w-8 h-8 text-brand-pink" />
                  Technical Architecture
                </CardTitle>
                <CardDescription>Understanding the cutting-edge technology powering Vivoor</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="p-4 border border-brand-iris/20 rounded-lg bg-brand-iris/5">
                    <h3 className="font-semibold text-brand-iris mb-3 flex items-center gap-2">
                      <Video className="w-5 h-5" />
                      Livepeer Network
                    </h3>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Decentralized video infrastructure</li>
                      <li>• 50x cost reduction vs traditional CDNs</li>
                      <li>• Global transcoding network</li>
                      <li>• Ultra-low latency streaming</li>
                      <li>• Automatic quality adaptation</li>
                    </ul>
                  </div>
                  <div className="p-4 border border-brand-cyan/20 rounded-lg bg-brand-cyan/5">
                    <h3 className="font-semibold text-brand-cyan mb-3 flex items-center gap-2">
                      <Coins className="w-5 h-5" />
                      Kaspa Blockchain
                    </h3>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Fastest Proof-of-Work consensus</li>
                      <li>• 1-second block times</li>
                      <li>• Parallel block processing (BlockDAG)</li>
                      <li>• Ultra-low transaction fees</li>
                      <li>• Energy-efficient mining</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Why This Matters for Users</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="text-center p-4 rounded-lg border border-border">
                      <TrendingUp className="w-8 h-8 text-brand-iris mx-auto mb-2" />
                      <h4 className="font-medium mb-1">Scalability</h4>
                      <p className="text-sm text-muted-foreground">Platform grows without compromising performance</p>
                    </div>
                    <div className="text-center p-4 rounded-lg border border-border">
                      <Shield className="w-8 h-8 text-brand-cyan mx-auto mb-2" />
                      <h4 className="font-medium mb-1">Security</h4>
                      <p className="text-sm text-muted-foreground">Blockchain-verified transactions and decentralized infrastructure</p>
                    </div>
                    <div className="text-center p-4 rounded-lg border border-border">
                      <Zap className="w-8 h-8 text-brand-pink mx-auto mb-2" />
                      <h4 className="font-medium mb-1">Speed</h4>
                      <p className="text-sm text-muted-foreground">Instant tips, fast streaming, real-time interactions</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* Getting Help */}
          <motion.section id="support" variants={fadeInUp}>
            <Card className="border-brand-iris/20">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <MessageCircle className="w-8 h-8 text-brand-iris" />
                  Getting Help & Support
                </CardTitle>
                <CardDescription>Resources and assistance when you need it</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center p-6 border border-brand-iris/20 rounded-lg bg-brand-iris/5">
                  <h3 className="text-lg font-semibold text-brand-iris mb-2">Need Additional Help?</h3>
                  <p className="text-muted-foreground mb-4">
                    Our community and support team are here to help you succeed on Vivoor
                  </p>
                  <div className="flex justify-center gap-4">
                    <Button variant="hero" onClick={() => navigate('/app')}>
                      Explore Platform
                    </Button>
                    <Button variant="gradientOutline" onClick={() => navigate('/verification')}>
                      Get Verified
                    </Button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 border border-border rounded-lg">
                    <h4 className="font-semibold mb-2">Common Issues</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Wallet connection problems</li>
                      <li>• OBS streaming setup</li>
                      <li>• Payment verification delays</li>
                      <li>• Profile customization help</li>
                    </ul>
                  </div>
                  <div className="p-4 border border-border rounded-lg">
                    <h4 className="font-semibold mb-2">Best Practices</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Test stream setup before going live</li>
                      <li>• Engage with your community regularly</li>
                      <li>• Use descriptive titles and thumbnails</li>
                      <li>• Thank viewers for tips and follows</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.section>
        </motion.div>

        {/* Call to Action */}
        <motion.div 
          className="text-center py-16"
          variants={fadeInUp}
        >
          <div className="relative">
            <motion.h2 
              className="text-4xl md:text-5xl font-bold mb-6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
            >
              <span className="bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink bg-clip-text text-transparent">
                Ready to Start Streaming?
              </span>
            </motion.h2>
            <motion.p 
              className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              Join the revolution of decentralized streaming and start earning with zero-fee KAS tips today
            </motion.p>
            <motion.div
              className="flex justify-center gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <Button variant="hero" size="lg" onClick={() => navigate('/go-live')}>
                <Camera className="w-5 h-5 mr-2" />
                Start Streaming Now
              </Button>
              <Button variant="gradientOutline" size="lg" onClick={() => navigate('/app')}>
                <Play className="w-5 h-5 mr-2" />
                Explore Streams
              </Button>
            </motion.div>
          </div>
        </motion.div>
        </div>
      </main>
    </div>
  );
};

export default DocsPage;