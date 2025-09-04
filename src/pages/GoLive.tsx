import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import HlsPlayer from "@/components/players/HlsPlayer";
import BrowserStreaming from "@/components/streaming/BrowserStreaming";
import { useWallet } from "@/context/WalletContext";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";
import { getCategoryThumbnail } from "@/utils/categoryThumbnails";
import { Upload, Image as ImageIcon, Monitor, Camera } from "lucide-react";

const GoLive = () => {
  const navigate = useNavigate();
  const { identity, profile: walletProfile } = useWallet();
  const kaspaAddress = identity?.id; // The kaspa address from wallet identity
  
  const [title, setTitle] = React.useState('');
  const [category, setCategory] = React.useState('IRL');
  const [thumbnailFile, setThumbnailFile] = React.useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = React.useState<string | null>(null);
  
  // Streaming mode: 'rtmp' or 'browser'
  const [streamingMode, setStreamingMode] = React.useState<'rtmp' | 'browser'>('rtmp');
  
  const [ingestUrl, setIngestUrl] = React.useState<string | null>(null);
  const [streamKey, setStreamKey] = React.useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = React.useState<string | null>(null);
  const [livepeerStreamId, setLivepeerStreamId] = React.useState<string | null>(null);
  const [livepeerPlaybackId, setLivepeerPlaybackId] = React.useState<string | null>(null);
  
  const [previewReady, setPreviewReady] = React.useState(false);
  const [playerKey, setPlayerKey] = React.useState(0);
  const [debugInfo, setDebugInfo] = React.useState<string>('');


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
    
    console.log('Generating stream details...');
    try {
      setDebugInfo('Creating Livepeer stream...');
      
      const { data: lp, error: lpErr } = await supabase.functions.invoke('livepeer-create-stream', { body: { name: title } });
      
      console.log('Livepeer response:', lp);
      console.log('Livepeer error:', lpErr);
      
      if (lpErr || !lp) {
        setDebugInfo(`Error: ${lpErr?.message || 'Failed to create stream'}`);
        throw new Error(lpErr?.message || 'Failed to create stream');
      }
      
      setIngestUrl(lp.ingestUrl || null);
      setStreamKey(lp.streamKey || null);
      setPlaybackUrl(lp.playbackUrl || null);
      setLivepeerStreamId(lp.streamId || null);
      setLivepeerPlaybackId(lp.playbackId || null);
      
      console.log('Stream details set:', {
        streamId: lp.streamId,
        ingestUrl: lp.ingestUrl,
        streamKey: lp.streamKey ? '***' : null,
        playbackUrl: lp.playbackUrl
      });
      
      setDebugInfo(`Stream created. Playback URL: ${lp.playbackUrl || 'None'}`);
      toast.success('RTMP details ready');
      return lp as { streamId?: string; ingestUrl?: string | null; streamKey?: string | null; playbackUrl?: string | null };
    } catch (e:any) {
      console.error('Stream generation error:', e);
      setDebugInfo(`Error: ${e?.message || 'Failed to create stream'}`);
      toast.error(e?.message || 'Failed to create stream');
      throw e;
    }
  };

  const sendTreasuryFee = async (): Promise<string | null> => {
    if (!window.kasware?.sendKaspa) {
      throw new Error("Kasware wallet not available");
    }
    
    const treasuryAddress = "kaspa:qzs7mlxwqtuyvv47yhx0xzhmphpazxzw99patpkh3ezfghejhq8wv6jsc7f80";
    const feeAmountSompi = 120000000; // 1.2 KAS in sompi
    
    try {
      const txid = await window.kasware.sendKaspa(treasuryAddress, feeAmountSompi, {
        priorityFee: 10000,
        payload: `VIVOOR_STREAMING_FEE:${kaspaAddress}:${Date.now()}`
      });
      
      return txid;
    } catch (error) {
      console.error('Treasury fee payment failed:', error);
      throw error;
    }
  };

  const handleStart = async () => {
    if (!kaspaAddress) {
      toast.error('Connect wallet first');
      return;
    }
    if (!title.trim()) {
      toast.error('Please enter a stream title');
      return;
    }
    if (streamingMode === 'rtmp' && !previewReady) {
      toast.error('Please wait for stream preview to be ready');
      return;
    }
    
    try {
      console.log('Starting stream creation process...');
      
      // First, end any existing active streams for this user
      try {
        const { data: existingStreams } = await supabase
          .from('streams')
          .select('id')
          .eq('user_id', kaspaAddress)
          .eq('is_live', true);
        
        if (existingStreams && existingStreams.length > 0) {
          console.log(`Ending ${existingStreams.length} existing active streams`);
          await supabase.rpc('end_user_active_streams', { user_id_param: kaspaAddress });
          toast.success('Ended previous active streams');
        }
      } catch (error) {
        console.error('Failed to end existing streams:', error);
      }

      // Generate stream details first if not already done
      let currentIngestUrl = ingestUrl;
      let currentStreamKey = streamKey;
      let currentPlaybackUrl = playbackUrl;
      let currentLivepeerStreamId = livepeerStreamId;
      let currentLivepeerPlaybackId = livepeerPlaybackId;

      if (!currentIngestUrl || !currentStreamKey || !currentPlaybackUrl) {
        console.log('Generating stream details...');
        toast.info('Creating stream...');
        
        const streamDetails = await generateStreamDetails();
        currentIngestUrl = streamDetails.ingestUrl;
        currentStreamKey = streamDetails.streamKey;
        currentPlaybackUrl = streamDetails.playbackUrl;
        currentLivepeerStreamId = streamDetails.streamId; // This is the actual Livepeer stream ID
        // Extract playback ID from response
        if (streamDetails && 'playbackId' in streamDetails) {
          currentLivepeerPlaybackId = (streamDetails as any).playbackId;
        }
        
        if (!currentIngestUrl || !currentStreamKey || !currentPlaybackUrl) {
          throw new Error('Failed to generate valid stream details');
        }
      }
      
      // Send treasury fee
      toast.info('Processing treasury fee (1.2 KAS)...');
      const treasuryTxid = await sendTreasuryFee();
      console.log('Treasury fee paid:', treasuryTxid);
      
      // Wait a moment for transaction to be confirmed
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Ensure profile exists for this Kaspa address using wallet context profile
      console.log('Creating/updating profile...');
      if (walletProfile) {
        try {
          const { data: userId, error: profileError } = await supabase.rpc('authenticate_wallet_user', {
            wallet_address: kaspaAddress,
            user_handle: walletProfile.username,
            user_display_name: walletProfile.username
          });
          
          if (profileError) {
            console.error('Profile creation error:', profileError);
            throw new Error(`Failed to create profile: ${profileError.message}`);
          }
          console.log('Profile created/updated successfully, user ID:', userId);
        } catch (error) {
          console.error('Profile creation failed:', error);
          throw error;
        }
      }

      // Handle thumbnail upload
      let thumbnailUrl = null;
      if (thumbnailFile) {
        console.log('Uploading custom thumbnail...');
        try {
          const fileExt = thumbnailFile.name.split('.').pop();
          const fileName = `${kaspaAddress}-${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('thumbnails')  // Use dedicated thumbnails bucket
            .upload(fileName, thumbnailFile);
          
          if (uploadError) {
            console.error('Error uploading thumbnail:', uploadError);
            throw new Error(`Thumbnail upload failed: ${uploadError.message}`);
          } else {
            const { data: { publicUrl } } = supabase.storage
              .from('thumbnails')
              .getPublicUrl(fileName);
            thumbnailUrl = publicUrl;
            console.log('Thumbnail uploaded successfully:', thumbnailUrl);
          }
        } catch (error) {
          console.error('Thumbnail upload process failed:', error);
          throw error;
        }
      } else if (category) {
        // Use category-based thumbnail if no custom thumbnail uploaded
        thumbnailUrl = getCategoryThumbnail(category);
        console.log('Using category thumbnail:', thumbnailUrl);
      }

      // Save stream to Supabase with treasury transaction info
      console.log('Creating stream in database...');
      try {
        const { data: streamData, error } = await supabase
          .from('streams')
          .insert({
            user_id: kaspaAddress,
            title: title || 'Live Stream',
            category: category,
            playback_url: currentPlaybackUrl,
            thumbnail_url: thumbnailUrl,
            treasury_txid: treasuryTxid,
            treasury_block_time: Date.now(), // Approximate block time
            livepeer_stream_id: currentLivepeerStreamId || null, // Save the Livepeer stream ID from API response
            livepeer_playback_id: currentLivepeerPlaybackId || null, // Save the playback ID
            streaming_mode: streamingMode, // Save the streaming mode
            is_live: streamingMode === 'browser' ? true : false // For browser streams, set live immediately
          })
          .select()
          .single();

        if (error) {
          console.error('Failed to create stream in database:', error);
          throw new Error(`Database error: ${error.message}`);
        }

        const streamId = streamData.id;
        console.log('Stream created successfully with ID:', streamId);
        
        // Store stream data in localStorage for persistence
        localStorage.setItem('currentIngestUrl', currentIngestUrl || '');
        localStorage.setItem('currentStreamKey', currentStreamKey || '');
        localStorage.setItem('currentPlaybackUrl', currentPlaybackUrl || '');
        localStorage.setItem('streamStartTime', new Date().toISOString());
        localStorage.setItem('currentStreamId', streamId);
        localStorage.setItem('currentStreamingMode', streamingMode);
        localStorage.setItem('currentLivepeerPlaybackId', currentLivepeerPlaybackId || '');
        
        if (streamingMode === 'browser') {
          toast.success('Stream created! Start broadcasting with your camera and microphone.');
        } else {
          toast.success('Stream started! Use the RTMP details below in OBS.');
        }
        
        console.log('Stream ready, details:', {
          mode: streamingMode,
          ingestUrl: currentIngestUrl,
          streamKey: currentStreamKey ? '***HIDDEN***' : null,
          playbackUrl: currentPlaybackUrl,
          playbackId: currentLivepeerPlaybackId
        });
        
        // Navigate to stream control page
        navigate(`/stream/${streamId}`);
      } catch (streamError) {
        console.error('Stream creation error:', streamError);
        throw streamError;
      }
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
                  onClick={() => setStreamingMode('browser')}
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

            {/* Browser Streaming Preview Section - BEFORE payment */}
            {streamingMode === 'browser' && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-white mb-4">Preview Your Stream</h3>
                <div className="bg-white/5 border border-white/20 rounded-xl p-6">
                  <BrowserStreaming
                    streamKey={'preview'} // Placeholder for preview
                    ingestUrl={'preview'} // Placeholder for preview
                  />
                </div>
              </div>
            )}
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              {streamingMode === 'rtmp' && (
                <Button 
                  variant="outline" 
                  onClick={generateStreamDetails} 
                  disabled={!title || !kaspaAddress}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-purple-400/50"
                >
                  {!kaspaAddress ? 'Connect Wallet First' : 'Generate RTMP Details'}
                </Button>
              )}
              
              <Button 
                onClick={handleStart} 
                disabled={!kaspaAddress || !title.trim() || (streamingMode === 'rtmp' && !ingestUrl)}
                className="flex-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 hover:from-cyan-600 hover:via-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                {!kaspaAddress ? 'Connect Wallet First' : 
                 !title.trim() ? 'Enter Title First' : 
                 streamingMode === 'rtmp' && !ingestUrl ? 'Generate RTMP Details First' :
                 `Start ${streamingMode === 'browser' ? 'Browser' : 'RTMP'} Stream & Pay Fee (1.2 KAS)`}
              </Button>
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