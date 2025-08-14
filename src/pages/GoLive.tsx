import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import HlsPlayer from "@/components/players/HlsPlayer";
import { useWallet } from "@/context/WalletContext";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";
import { getCategoryThumbnail } from "@/utils/categoryThumbnails";
import { Upload, Image as ImageIcon } from "lucide-react";

const GoLive = () => {
  const navigate = useNavigate();
  const { identity, profile: walletProfile } = useWallet();
  const kaspaAddress = identity?.id; // The kaspa address from wallet identity
  
  const [title, setTitle] = React.useState('');
  const [category, setCategory] = React.useState('IRL');
  const [thumbnailFile, setThumbnailFile] = React.useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = React.useState<string | null>(null);
  
  const [ingestUrl, setIngestUrl] = React.useState<string | null>(null);
  const [streamKey, setStreamKey] = React.useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = React.useState<string | null>(null);
  
  const [previewReady, setPreviewReady] = React.useState(false);
  const [playerKey, setPlayerKey] = React.useState(0);
  const [debugInfo, setDebugInfo] = React.useState<string>('');

  // Get current user profile for display
  const { data: profile } = useQuery({
    queryKey: ['profile', identity?.id],
    queryFn: async () => {
      if (!identity?.id) return null;
      const { data } = await supabase.rpc('get_public_profile', { _id: identity.id });
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
      
      console.log('Stream details set:', {
        ingestUrl: lp.ingestUrl,
        streamKey: lp.streamKey ? '***' : null,
        playbackUrl: lp.playbackUrl
      });
      
      setDebugInfo(`Stream created. Playback URL: ${lp.playbackUrl || 'None'}`);
      toast.success('RTMP details ready');
      return lp as { ingestUrl?: string | null; streamKey?: string | null; playbackUrl?: string | null };
    } catch (e:any) {
      console.error('Stream generation error:', e);
      setDebugInfo(`Error: ${e?.message || 'Failed to create stream'}`);
      toast.error(e?.message || 'Failed to create stream');
      throw e;
    }
  };

  const handleStart = async () => {
    if (!kaspaAddress) {
      toast.error('Connect wallet first');
      return;
    }
    if (!previewReady) {
      toast.error('Wait for stream preview to be ready');
      return;
    }
    
    try {
      // Ensure profile exists for this Kaspa address using wallet context profile
      if (walletProfile) {
        await supabase
          .from('profiles')
          .upsert({
            id: kaspaAddress,
            display_name: walletProfile.username, // Map username to display_name
            handle: walletProfile.username,       // Use username as handle
            avatar_url: walletProfile.avatarUrl,  // Map avatarUrl to avatar_url
            kaspa_address: kaspaAddress
          }, { onConflict: 'id' });
      }

      // Handle thumbnail upload
      let thumbnailUrl = null;
      if (thumbnailFile) {
        const fileExt = thumbnailFile.name.split('.').pop();
        const fileName = `${kaspaAddress}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('vods')
          .upload(fileName, thumbnailFile);
        
        if (uploadError) {
          console.error('Error uploading thumbnail:', uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('vods')
            .getPublicUrl(fileName);
          thumbnailUrl = publicUrl;
        }
      } else if (category) {
        // Use category-based thumbnail if no custom thumbnail uploaded
        thumbnailUrl = getCategoryThumbnail(category);
      }

      // Save stream to Supabase
      const { data: streamData, error } = await supabase
        .from('streams')
        .insert({
          user_id: kaspaAddress,
          title: title || 'Live Stream',
          category: category,
          playback_url: playbackUrl,
          thumbnail_url: thumbnailUrl,
          is_live: true
        })
        .select()
        .single();

      if (error) throw error;

      const streamId = streamData.id;
      
      // Store stream data in localStorage for persistence
      localStorage.setItem('currentIngestUrl', ingestUrl || '');
      localStorage.setItem('currentStreamKey', streamKey || '');
      localStorage.setItem('currentPlaybackUrl', playbackUrl || '');
      localStorage.setItem('streamStartTime', new Date().toISOString());
      localStorage.setItem('currentStreamId', streamId);
      
      toast.success('Stream started!');
      navigate(`/stream/${streamId}`);
    } catch (error) {
      console.error('Failed to save stream:', error);
      toast.error('Failed to start stream');
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
        <meta name="description" content="Set up RTMP ingest and OBS streaming with live preview on Vivoor." />
        <link rel="canonical" href="/go-live" />
      </Helmet>

      <h1 className="sr-only">Go Live</h1>

      <section className="max-w-3xl mx-auto glass rounded-xl p-5">
        <div className="text-lg font-semibold">Stream setup</div>
        <div className="grid gap-3 mt-4">
          <label className="text-sm">Title</label>
          <input 
            className="rounded-md bg-background px-3 py-2 text-sm border border-border" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
          />
          <label className="text-sm mt-2">Category</label>
          <select 
            className="rounded-md bg-background border border-border px-3 py-2" 
            value={category} 
            onChange={(e) => setCategory(e.target.value)}
          >
            {['IRL', 'Music', 'Gaming', 'Talk', 'Sports', 'Crypto', 'Tech'].map(c => 
              <option key={c} value={c}>{c}</option>
            )}
          </select>
          <div>
            <Label htmlFor="thumbnail">Stream Thumbnail</Label>
            <div className="mt-2">
              <input
                type="file"
                id="thumbnail"
                accept="image/*"
                onChange={handleThumbnailUpload}
                className="hidden"
              />
              <div className="grid grid-cols-2 gap-4">
                <label
                  htmlFor="thumbnail"
                  className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
                >
                  {thumbnailPreview ? (
                    <img
                      src={thumbnailPreview}
                      alt="Thumbnail preview"
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Upload className="size-6" />
                      <span className="text-sm">Upload custom</span>
                    </div>
                  )}
                </label>
                <div className="flex flex-col items-center justify-center h-32 border border-border rounded-lg">
                  {category ? (
                    <img
                      src={getCategoryThumbnail(category)}
                      alt={`${category} category thumbnail`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ImageIcon className="size-6" />
                      <span className="text-sm">Category default</span>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Upload a custom thumbnail or use the default for your category
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 gap-2">
            <Button 
              variant="secondary" 
              onClick={generateStreamDetails} 
              disabled={!title || !kaspaAddress}
            >
              {!kaspaAddress ? 'Connect Wallet First' : 'Regenerate RTMP'}
            </Button>
            <Button 
              variant="hero" 
              onClick={handleStart} 
              disabled={!kaspaAddress || !previewReady}
            >
              {!previewReady ? 'Preview Required' : 'Start Stream'}
            </Button>
          </div>

          {(ingestUrl || streamKey || playbackUrl) && (
            <div className="mt-4 p-3 rounded-xl border border-border bg-card/60 backdrop-blur-md text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-muted-foreground font-medium">Ingest URL:</span>
                <code className="px-2 py-1 rounded bg-muted/40 border border-border max-w-full truncate">
                  {ingestUrl ?? '—'}
                </code>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => ingestUrl && navigator.clipboard.writeText(ingestUrl).then(() => toast.success('Copied ingest URL'))}
                >
                  Copy
                </Button>
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-2">
                <span className="text-muted-foreground font-medium">Stream Key:</span>
                <code className="px-2 py-1 rounded bg-muted/40 border border-border max-w-full truncate">
                  {streamKey ? '••••••••••' : '—'}
                </code>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => streamKey && navigator.clipboard.writeText(streamKey).then(() => toast.success('Copied stream key'))}
                >
                  Copy
                </Button>
              </div>

              {/* Debug info */}
              {debugInfo && (
                <div className="mt-2 p-2 rounded bg-muted/20 border border-border text-xs text-muted-foreground">
                  <strong>Debug:</strong> {debugInfo}
                </div>
              )}

              <div className="text-xs text-muted-foreground mt-2">
                Use these in OBS or Streamlabs. Preview appears once you start streaming in OBS.
              </div>

              <div className="mt-4 grid gap-2">
                <div className="font-medium">OBS setup</div>
                <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                  <li>Settings → Stream → Service: Custom...</li>
                  <li>Server: paste the Ingest URL above</li>
                  <li>Stream Key: paste the Stream Key above</li>
                  <li>Output → Encoder: x264 or NVENC H.264</li>
                  <li>Bitrate: 3500–6000 Kbps (1080p60), 8000–12000 Kbps (1440p60), 15000–25000 Kbps (2160p60)</li>
                  <li>Keyframe Interval: 2 seconds</li>
                  <li>Video → Base/Output: 3840x2160, 2560x1440, 1920x1080, or 1280x720</li>
                  <li>FPS: 30 or 60 (60fps recommended for smooth playback)</li>
                </ul>
              </div>

              {playbackUrl && (
                <div className="mt-4">
                  <div className="font-medium mb-2">Live Preview</div>
                  <HlsPlayer 
                    key={playerKey}
                    src={playbackUrl} 
                    autoPlay 
                  />
                  {!previewReady && (
                    <div className="text-xs text-muted-foreground mt-2">
                      {debugInfo || "Waiting for stream signal... Start streaming in OBS with the exact settings above. Preview appears in 10–60 seconds."}
                    </div>
                  )}
                  {previewReady && (
                    <div className="text-xs text-green-600 mt-2">✓ Stream is live and ready!</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
};

export default GoLive;