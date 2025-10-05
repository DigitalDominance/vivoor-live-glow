import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import HlsPlayer from "@/components/players/HlsPlayer";
import BrowserStreaming from "@/components/streaming/BrowserStreaming";

import { useWallet } from "@/context/WalletContext";
import { useBrowserStreaming } from "@/context/BrowserStreamingContext";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";
import { getCategoryThumbnail } from "@/utils/categoryThumbnails";
import { Upload, Image as ImageIcon, Monitor, Camera } from "lucide-react";

const GoLive = () => {
  const navigate = useNavigate();
  const { identity, profile: walletProfile, sessionToken } = useWallet();
  const { preserveStream, isPreviewing } = useBrowserStreaming();
  const kaspaAddress = identity?.address; // The kaspa wallet address from wallet identity
  
  const [title, setTitle] = React.useState('');
  const [category, setCategory] = React.useState('IRL');
  const [thumbnailFile, setThumbnailFile] = React.useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = React.useState<string | null>(null);
  
  // Streaming mode: 'rtmp' or 'browser'
  const [streamingMode, setStreamingMode] = React.useState<'rtmp' | 'browser'>('rtmp');
  const [browserSource] = React.useState<'camera' | 'screen'>('camera');
  
  const [ingestUrl, setIngestUrl] = React.useState<string | null>(null);
  const [streamKey, setStreamKey] = React.useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = React.useState<string | null>(null);
  const [livepeerStreamId, setLivepeerStreamId] = React.useState<string | null>(null);
  const [livepeerPlaybackId, setLivepeerPlaybackId] = React.useState<string | null>(null);
  
  const [previewReady, setPreviewReady] = React.useState(false);
  const [playerKey, setPlayerKey] = React.useState(0);
  const [debugInfo, setDebugInfo] = React.useState<string>('');
  const [createdStreamId, setCreatedStreamId] = React.useState<string | null>(null);
  const [cameraReady, setCameraReady] = React.useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = React.useState(false);
  const [streamReady, setStreamReady] = React.useState(false);


  // Get current user profile for display using secure function
  const { data: profile } = useQuery({
    queryKey: ['profile', identity?.id],
    queryFn: async () => {
      if (!identity?.id) return null;
      const { data } = await supabase.rpc('get_public_profile_display', { user_id: identity.id });
      return data?.[0] || null;
    },
    enabled: !!identity?.id
  });

  // Check if stream is ready periodically (when playback URL exists)
  React.useEffect(() => {
    if (!playbackUrl) return;
    
    let cancelled = false;
    let intervalId: NodeJS.Timeout | null = null;
    let checkCount = 0;
    
    const checkStream = async () => {
      if (cancelled) return;
      checkCount++;
      
      try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch(playbackUrl, { signal: controller.signal });
        
        if (!response.ok) {
          setDebugInfo(`Stream not ready (HTTP ${response.status}, attempt ${checkCount})`);
          return;
        }
        
        const text = await response.text();
        
        if (text.includes('#EXT-X-STREAM-INF')) {
          // Master playlist with multiple renditions
          const lines = text.split('\n');
          let renditionUrl = '';
          
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('#EXT-X-STREAM-INF')) {
              renditionUrl = lines[i + 1]?.trim() || '';
              break;
            }
          }
          
          if (renditionUrl && !renditionUrl.startsWith('http')) {
            // Construct full URL for rendition
            const baseUrl = playbackUrl.substring(0, playbackUrl.lastIndexOf('/') + 1);
            renditionUrl = baseUrl + renditionUrl;
            
            try {
              const renditionRes = await fetch(renditionUrl, { signal: controller.signal });
              if (renditionRes.ok) {
                const renditionText = await renditionRes.text();
                console.log('Rendition playlist:', renditionText.substring(0, 300));
                
                if (renditionText.includes('.ts') || renditionText.includes('#EXTINF')) {
                  console.log('🎉 Stream segments found! Stopping polling and showing preview.');
                  cancelled = true; // Stop any further checks
                  if (intervalId) clearInterval(intervalId);
                  setPreviewReady(true);
                  setPlayerKey(prev => prev + 1); // Refresh player once when ready
                  setDebugInfo('Stream ready! HLS segments found in rendition.');
                  return;
                } else {
                  setDebugInfo(`Stream starting... (rendition playlist exists but no segments yet, attempt ${checkCount})`);
                }
              } else {
                setDebugInfo(`Stream starting... (rendition not ready, attempt ${checkCount})`);
              }
            } catch (renditionError) {
              setDebugInfo(`Stream starting... (checking rendition, attempt ${checkCount})`);
            }
          }
        } else if (text.includes('.ts') || text.includes('#EXTINF')) {
          // Direct playlist with segments
          console.log('🎉 Stream segments found! Stopping polling and showing preview.');
          cancelled = true; // Stop any further checks
          if (intervalId) clearInterval(intervalId);
          setPreviewReady(true);
          setPlayerKey(prev => prev + 1); // Refresh player once when ready
          setDebugInfo('Stream ready! HLS segments found.');
          return;
        } else {
          setDebugInfo(`Stream starting... (playlist exists but no segments yet, attempt ${checkCount})`);
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          setDebugInfo(`Stream not ready (timeout, attempt ${checkCount})`);
        } else {
          setDebugInfo(`Stream not ready (${error.message}, attempt ${checkCount})`);
        }
      }
    };

    // Initial check
    checkStream();
    
    // Then check every 3 seconds if not ready
    intervalId = setInterval(checkStream, 3000);
    
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [playbackUrl]);

  const generateStreamDetails = async () => {
    if (!kaspaAddress) {
      toast.error('Please connect wallet first');
      return;
    }
    
    console.log('[GoLive] Generating stream details...');
    setStreamReady(false);
    
    try {
      setDebugInfo('Creating Livepeer stream...');
      
      const { data: lp, error: lpErr } = await supabase.functions.invoke('livepeer-create-stream', { body: { name: title } });
      
      console.log('[GoLive] Livepeer response:', lp);
      console.log('[GoLive] Livepeer error:', lpErr);
      
      if (lpErr || !lp) {
        setDebugInfo(`Error: ${lpErr?.message || 'Failed to create stream'}`);
        throw new Error(lpErr?.message || 'Failed to create stream');
      }
      
      setIngestUrl(lp.ingestUrl || null);
      setStreamKey(lp.streamKey || null);
      setPlaybackUrl(lp.playbackUrl || null);
      setLivepeerStreamId(lp.streamId || null);
      setLivepeerPlaybackId(lp.playbackId || null);
      
      console.log('[GoLive] Stream details set:', {
        streamId: lp.streamId,
        ingestUrl: lp.ingestUrl,
        streamKey: lp.streamKey ? '***' : null,
        playbackUrl: lp.playbackUrl
      });
      
      // Wait 2 seconds for Livepeer to provision the stream endpoint
      console.log('[GoLive] Waiting for Livepeer stream to be ready...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setStreamReady(true);
      setDebugInfo(`Stream created. Playback URL: ${lp.playbackUrl || 'None'}`);
      toast.success('Stream ready! You can now connect your camera.');
      return lp as { streamId?: string; ingestUrl?: string | null; streamKey?: string | null; playbackUrl?: string | null };
    } catch (e:any) {
      console.error('[GoLive] Stream generation error:', e);
      setDebugInfo(`Error: ${e?.message || 'Failed to create stream'}`);
      toast.error(e?.message || 'Failed to create stream');
      throw e;
    }
  };

  const handleGoLive = async () => {
    if (!kaspaAddress || !sessionToken || !identity?.address) {
      toast.error('Please connect wallet first');
      return;
    }
    if (!cameraReady) {
      toast.error('Please wait for camera to connect');
      return;
    }
    if (!streamKey || !playbackUrl) {
      toast.error('Stream details not ready');
      return;
    }

    setIsProcessingPayment(true);
    
    try {
      // Send treasury fee
      toast.info('Processing payment (1.2 KAS)...');
      const treasuryAddress = "kaspa:qzs7mlxwqtuyvv47yhx0xzhmphpazxzw99patpkh3ezfghejhq8wv6jsc7f80";
      const feeAmountSompi = 120000000; // 1.2 KAS
      
      const treasuryTxid = await window.kasware.sendKaspa(treasuryAddress, feeAmountSompi, {
        priorityFee: 10000,
        payload: `VIVOOR_STREAMING_FEE:${kaspaAddress}:${Date.now()}`
      });
      
      console.log('Treasury fee paid:', treasuryTxid);
      toast.success('Payment confirmed!');
      
      // Wait a moment for transaction
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // End any existing active streams
      try {
        const { data: existingStreams } = await supabase
          .from('streams')
          .select('id')
          .eq('user_id', identity.id)
          .eq('is_live', true);
        
        if (existingStreams && existingStreams.length > 0) {
          await supabase.rpc('end_user_active_streams', { user_id_param: identity.id });
        }
      } catch (error) {
        console.error('Failed to end existing streams:', error);
      }

      // Handle thumbnail upload
      let thumbnailUrl = null;
      if (thumbnailFile) {
        try {
          const fileExt = thumbnailFile.name.split('.').pop();
          const fileName = `${kaspaAddress}-${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('thumbnails')
            .upload(fileName, thumbnailFile);
          
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from('thumbnails')
              .getPublicUrl(fileName);
            thumbnailUrl = publicUrl;
          }
        } catch (error) {
          console.error('Thumbnail upload failed:', error);
        }
      } else if (category) {
        thumbnailUrl = getCategoryThumbnail(category);
      }

      // Create stream in database
      const { data: streamId, error } = await supabase.rpc('create_stream_secure', {
        session_token_param: sessionToken,
        wallet_address_param: identity.address,
        title_param: title || 'Live Stream',
        category_param: category,
        livepeer_stream_id_param: livepeerStreamId || null,
        livepeer_playback_id_param: livepeerPlaybackId || null,
        streaming_mode_param: 'browser',
        is_live_param: true,
        playback_url_param: playbackUrl,
        treasury_txid_param: treasuryTxid,
        treasury_block_time_param: Date.now(),
        stream_type_param: 'browser',
        thumbnail_url_param: thumbnailUrl
      });

      if (error || !streamId) {
        throw new Error(`Database error: ${error?.message || 'Failed to create stream'}`);
      }

      console.log('Stream created successfully with ID:', streamId);
      
      // Store stream data
      localStorage.setItem('currentIngestUrl', ingestUrl || '');
      localStorage.setItem('currentStreamKey', streamKey || '');
      localStorage.setItem('currentPlaybackUrl', playbackUrl || '');
      localStorage.setItem('streamStartTime', new Date().toISOString());
      localStorage.setItem('currentStreamingMode', 'browser');
      localStorage.setItem('currentLivepeerPlaybackId', livepeerPlaybackId || '');
      
      toast.success('Going live!');
      
      // Preserve stream and navigate
      preserveStream();
      navigate(`/stream/${streamId}`);
      
    } catch (error) {
      console.error('Failed to go live:', error);
      toast.error(`Failed to go live: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleStartRTMP = async () => {
    if (!kaspaAddress || !sessionToken || !identity?.address) {
      toast.error('Connect wallet first');
      return;
    }
    if (!title.trim()) {
      toast.error('Please enter a stream title');
      return;
    }
    if (!previewReady) {
      toast.error('Please wait for stream preview to be ready');
      return;
    }
    
    try {
      // End any existing active streams
      try {
        const { data: existingStreams } = await supabase
          .from('streams')
          .select('id')
          .eq('user_id', identity.id)
          .eq('is_live', true);
        
        if (existingStreams && existingStreams.length > 0) {
          await supabase.rpc('end_user_active_streams', { user_id_param: identity.id });
        }
      } catch (error) {
        console.error('Failed to end existing streams:', error);
      }

      // Send treasury fee
      toast.info('Processing treasury fee (1.2 KAS)...');
      const treasuryAddress = "kaspa:qzs7mlxwqtuyvv47yhx0xzhmphpazxzw99patpkh3ezfghejhq8wv6jsc7f80";
      const feeAmountSompi = 120000000;
      
      const treasuryTxid = await window.kasware.sendKaspa(treasuryAddress, feeAmountSompi, {
        priorityFee: 10000,
        payload: `VIVOOR_STREAMING_FEE:${kaspaAddress}:${Date.now()}`
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Handle thumbnail upload
      let thumbnailUrl = null;
      if (thumbnailFile) {
        try {
          const fileExt = thumbnailFile.name.split('.').pop();
          const fileName = `${kaspaAddress}-${Date.now()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from('thumbnails').upload(fileName, thumbnailFile);
          
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from('thumbnails').getPublicUrl(fileName);
            thumbnailUrl = publicUrl;
          }
        } catch (error) {
          console.error('Thumbnail upload failed:', error);
        }
      } else if (category) {
        thumbnailUrl = getCategoryThumbnail(category);
      }

      // Create stream in database
      const { data: streamId, error } = await supabase.rpc('create_stream_secure', {
        session_token_param: sessionToken,
        wallet_address_param: identity.address,
        title_param: title || 'Live Stream',
        category_param: category,
        livepeer_stream_id_param: livepeerStreamId || null,
        livepeer_playback_id_param: livepeerPlaybackId || null,
        streaming_mode_param: 'rtmp',
        is_live_param: false,
        playback_url_param: playbackUrl,
        treasury_txid_param: treasuryTxid,
        treasury_block_time_param: Date.now(),
        stream_type_param: 'livepeer',
        thumbnail_url_param: thumbnailUrl
      });

      if (error || !streamId) {
        throw new Error(`Database error: ${error?.message || 'Failed to create stream'}`);
      }

      localStorage.setItem('currentIngestUrl', ingestUrl || '');
      localStorage.setItem('currentStreamKey', streamKey || '');
      localStorage.setItem('currentPlaybackUrl', playbackUrl || '');
      localStorage.setItem('streamStartTime', new Date().toISOString());
      localStorage.setItem('currentStreamingMode', 'rtmp');
      localStorage.setItem('currentLivepeerPlaybackId', livepeerPlaybackId || '');
      
      toast.success('Stream started! Use the RTMP details below in OBS.');
      navigate(`/stream/${streamId}`);
    } catch (error) {
      console.error('Failed to start stream:', error);
      toast.error(`Failed to start stream: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleThumbnailUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setThumbnailPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <main className="container mx-auto px-4 py-6">
      <Helmet>
        <title>Go Live — Vivoor</title>
        <meta name="description" content="Set up RTMP ingest and browser streaming with live preview on Vivoor." />
        <link rel="canonical" href="/go-live" />
      </Helmet>

      <h1 className="sr-only">Go Live</h1>
      

      <section className="max-w-4xl mx-auto">
        {/* Hero Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 border border-cyan-500/20 mb-4">
            <div className="w-2 h-2 bg-gradient-to-r from-cyan-400 to-purple-400 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Go Live on Vivoor
            </span>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            Start Your Stream
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Choose your streaming method, customize your stream, and go live to the Kaspa community
          </p>
        </div>

        {/* Main Card with Black Glass Effect */}
        <div className="relative">
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-purple-500/20 to-pink-500/20 rounded-2xl blur-xl"></div>
          
          {/* Black Glass Card */}
          <div className="relative bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
            
            {/* Streaming Mode Selection */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">Choose Your Streaming Method</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <button
                  onClick={() => setStreamingMode('rtmp')}
                  className={`relative p-6 rounded-xl border-2 transition-all duration-300 ${
                    streamingMode === 'rtmp' 
                      ? 'border-purple-400 bg-purple-500/20' 
                      : 'border-white/20 bg-white/5 hover:border-purple-400/50 hover:bg-purple-500/10'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Monitor className="size-6 text-purple-400" />
                    <span className="font-semibold text-white">RTMP Streaming</span>
                  </div>
                  <p className="text-sm text-gray-300 text-left">
                    Professional streaming with OBS, Streamlabs, or other broadcasting software
                  </p>
                  {streamingMode === 'rtmp' && (
                    <div className="absolute top-3 right-3">
                      <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse"></div>
                    </div>
                  )}
                </button>
                
                <button
                  onClick={async () => {
                    if (!kaspaAddress) {
                      toast.error('Please connect wallet first');
                      return;
                    }
                    
                    if (!title.trim()) {
                      toast.error('Please enter a stream title first');
                      return;
                    }
                    
                    // Clear existing stream data when switching modes
                    setIngestUrl(null);
                    setStreamKey(null);
                    setPlaybackUrl(null);
                    setLivepeerStreamId(null);
                    setLivepeerPlaybackId(null);
                    setPreviewReady(false);
                    setCameraReady(false);
                    
                    // Set browser streaming mode
                    setStreamingMode('browser');
                    
                    // Generate stream details for browser streaming
                    toast.info('Setting up browser streaming...');
                    try {
                      const details = await generateStreamDetails();
                      console.log('[GoLive] Stream details generated:', details);
                      toast.success('Ready! Connect your camera below to continue.');
                    } catch (error) {
                      console.error('[GoLive] Failed to generate stream details:', error);
                      toast.error('Failed to setup streaming. Please try again.');
                    }
                  }}
                  className={`relative p-6 rounded-xl border-2 transition-all duration-300 ${
                    streamingMode === 'browser' 
                      ? 'border-cyan-400 bg-cyan-500/20' 
                      : 'border-white/20 bg-white/5 hover:border-cyan-400/50 hover:bg-cyan-500/10'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Camera className="size-6 text-cyan-400" />
                    <span className="font-semibold text-white">Browser Streaming</span>
                  </div>
                  <p className="text-sm text-gray-300 text-left">
                    Stream directly from your browser using your camera, microphone, or screen
                  </p>
                  {streamingMode === 'browser' && (
                    <div className="absolute top-3 right-3">
                      <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse"></div>
                    </div>
                  )}
                </button>
              </div>
            </div>
        
            {/* Stream Details Form */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Stream Title</label>
                  <input 
                    className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-gray-400 focus:border-purple-400 focus:outline-none transition-colors" 
                    placeholder="Enter your stream title..."
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)} 
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Category</label>
                  <select 
                    className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-3 text-white focus:border-purple-400 focus:outline-none transition-colors"
                    value={category} 
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {['IRL', 'Music', 'Gaming', 'Talk', 'Sports', 'Crypto', 'Tech'].map(c => 
                      <option key={c} value={c} className="bg-gray-900 text-white">{c}</option>
                    )}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white mb-2">Stream Thumbnail</label>
                <input
                  type="file"
                  id="thumbnail"
                  accept="image/*"
                  onChange={handleThumbnailUpload}
                  className="hidden"
                />
                <div className="grid grid-cols-2 gap-3">
                  <label
                    htmlFor="thumbnail"
                    className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-white/30 rounded-lg cursor-pointer hover:border-purple-400/50 transition-colors bg-white/5"
                  >
                    {thumbnailPreview ? (
                      <img
                        src={thumbnailPreview}
                        alt="Thumbnail preview"
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-gray-400">
                        <Upload className="size-5" />
                        <span className="text-xs">Upload custom</span>
                      </div>
                    )}
                  </label>
                  <div className="flex flex-col items-center justify-center h-24 border border-white/20 rounded-lg bg-white/5">
                    {category ? (
                      <img
                        src={getCategoryThumbnail(category)}
                        alt={`${category} category thumbnail`}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-gray-400">
                        <ImageIcon className="size-5" />
                        <span className="text-xs">Category default</span>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Upload a custom thumbnail or use the default for your category
                </p>
              </div>
            </div>

            {/* Browser Streaming Setup Section - Show immediately when browser mode is selected */}
            {streamingMode === 'browser' && streamKey && streamReady && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                  {cameraReady ? 'Camera Ready - Ready to Go Live!' : 'Connect Your Camera'}
                </h3>
                <div className="border border-white/20 rounded-xl overflow-hidden">
                  <BrowserStreaming
                    key={browserSource}
                    streamKey={streamKey}
                    streamId={undefined}
                    playbackId={livepeerPlaybackId || undefined}
                    isPreviewMode={true}
                    onStreamStart={() => {
                      console.log('[GoLive] Camera connected successfully');
                      setCameraReady(true);
                      toast.success('✅ Camera ready! Click "Go Live & Pay 1.2 KAS" below to start broadcasting.');
                    }}
                    onStreamEnd={() => {
                      console.log('[GoLive] Camera disconnected');
                      setCameraReady(false);
                      toast.info('Camera disconnected');
                    }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  {cameraReady 
                    ? 'Camera is ready! Click the "Go Live & Pay 1.2 KAS" button below to start broadcasting.'
                    : 'Click "Start Camera" above to connect your camera and microphone.'}
                </div>
              </div>
            )}
            
            {/* Loading state while stream is being prepared */}
            {streamingMode === 'browser' && streamKey && !streamReady && (
              <div className="mb-8">
                <div className="bg-white/5 border border-white/20 rounded-xl p-6 flex items-center justify-center gap-3">
                  <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-white">Preparing stream endpoint...</span>
                </div>
              </div>
            )}
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* For RTMP only - show generate button if stream not created */}
              {streamingMode === 'rtmp' && !streamKey && (
                <Button 
                  variant="outline" 
                  onClick={generateStreamDetails} 
                  disabled={!title || !kaspaAddress}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-purple-400/50"
                >
                  {!kaspaAddress ? 'Connect Wallet First' : 'Generate RTMP Stream'}
                </Button>
              )}
              
              {/* For browser streaming, show Go Live button only when camera is ready */}
              {streamingMode === 'browser' && streamKey && cameraReady && (
                <Button 
                  onClick={handleGoLive} 
                  disabled={!kaspaAddress || !title.trim() || isProcessingPayment}
                  className="flex-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 hover:from-cyan-600 hover:via-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                  {isProcessingPayment ? 'Processing Payment...' : 'Go Live & Pay 1.2 KAS 🚀'}
                </Button>
              )}
              
              {/* For RTMP streaming, show Setup button after stream is generated */}
              {streamingMode === 'rtmp' && streamKey && (
                <Button 
                  onClick={handleStartRTMP} 
                  disabled={!kaspaAddress || !title.trim() || !previewReady}
                  className="flex-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 hover:from-cyan-600 hover:via-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                  {!kaspaAddress ? 'Connect Wallet First' : 
                   !title.trim() ? 'Enter Title First' :
                   !previewReady ? 'Waiting for Stream...' :
                   'Setup RTMP Stream & Pay Fee (1.2 KAS)'}
                </Button>
              )}
              
              {/* Browser mode status when camera is not ready yet */}
              {streamingMode === 'browser' && streamKey && !cameraReady && (
                <div className="flex-1 px-6 py-3 rounded-lg bg-white/5 border border-white/20 text-center">
                  <p className="text-sm text-white/80">
                    ⬆️ Connect your camera above to continue
                  </p>
                </div>
              )}
            </div>

            
            {/* RTMP Details Section */}
            {streamingMode === 'rtmp' && (ingestUrl || streamKey || playbackUrl) && (
              <div className="mt-8 p-6 rounded-xl bg-white/5 border border-white/20">
                <h3 className="text-lg font-semibold text-white mb-4">RTMP Stream Details</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-300 w-24">Ingest URL:</span>
                    <code className="flex-1 px-3 py-2 rounded bg-black/30 border border-white/10 text-cyan-400 text-sm">
                      {ingestUrl ?? '—'}
                    </code>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => ingestUrl && navigator.clipboard.writeText(ingestUrl).then(() => toast.success('Copied ingest URL'))}
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                    >
                      Copy
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-300 w-24">Stream Key:</span>
                    <code className="flex-1 px-3 py-2 rounded bg-black/30 border border-white/10 text-pink-400 text-sm">
                      {streamKey ? '••••••••••••••••••••' : '—'}
                    </code>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => streamKey && navigator.clipboard.writeText(streamKey).then(() => toast.success('Copied stream key'))}
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                    >
                      Copy
                    </Button>
                  </div>
                </div>

                
                {/* Debug info */}
                {debugInfo && (
                  <div className="mt-4 p-3 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-xs">
                    <strong>Debug:</strong> {debugInfo}
                  </div>
                )}

                <div className="text-xs text-gray-400 mt-4">
                  Use these details in OBS or Streamlabs. Preview appears once you start streaming.
                </div>

                <div className="mt-6 space-y-3">
                  <div className="font-medium text-white">OBS Setup Guide</div>
                  <div className="grid md:grid-cols-2 gap-4 text-xs text-gray-300">
                    <div className="space-y-1">
                      <div className="font-medium text-cyan-400">Stream Settings:</div>
                      <div>• Settings → Stream → Service: Custom</div>
                      <div>• Server: Paste the Ingest URL above</div>
                      <div>• Stream Key: Paste the Stream Key above</div>
                    </div>
                    <div className="space-y-1">
                      <div className="font-medium text-purple-400">Output Settings:</div>
                      <div>• Encoder: x264 or NVENC H.264</div>
                      <div>• Bitrate: 3500-6000 Kbps (1080p60)</div>
                      <div>• Keyframe Interval: 2 seconds</div>
                    </div>
                  </div>
                </div>

                {playbackUrl && (
                  <div className="mt-6">
                    <div className="font-medium text-white mb-3">Live Preview</div>
                    <div className="rounded-lg overflow-hidden bg-black/50 border border-white/20">
                      <HlsPlayer 
                        key={playerKey}
                        src={playbackUrl} 
                        autoPlay 
                      />
                    </div>
                    {!previewReady && (
                      <div className="text-xs text-gray-400 mt-2">
                        {debugInfo || "Waiting for stream signal... Start streaming in OBS with the settings above. Preview appears in 10-60 seconds."}
                      </div>
                    )}
                    {previewReady && (
                      <div className="text-xs text-green-400 mt-2 flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        Stream is live and ready!
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};

export default GoLive;