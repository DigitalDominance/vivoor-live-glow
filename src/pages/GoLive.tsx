import React from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PlayerPlaceholder from "@/components/streams/PlayerPlaceholder";
import HlsPlayer from "@/components/players/HlsPlayer";
import ProfileModal from "@/components/modals/ProfileModal";
import TipModal from "@/components/modals/TipModal";
import { useWallet } from "@/context/WalletContext";
import { getStartDaa, setStartDaa, clearStartDaa } from "@/lib/streamLocal";
import { fetchAddressFullTxs } from "@/lib/kaspaApi";
import { useKaspaTipScanner } from "@/hooks/useKaspaTipScanner";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const GoLive: React.FC = () => {
  const { identity } = useWallet();
  const kaspaAddress = React.useMemo(() => (identity?.id?.startsWith('kaspa:') ? identity.id : null), [identity?.id]);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [profile, setProfile] = React.useState<any | null>(null);
  const [tipOpen, setTipOpen] = React.useState(false);
  const [ingestUrl, setIngestUrl] = React.useState<string | null>(null);
  const [streamKey, setStreamKey] = React.useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = React.useState<string | null>(null);
  const navigate = useNavigate();

  const [live, setLive] = React.useState(false);
  const [title, setTitle] = React.useState('My awesome stream');
  const [category, setCategory] = React.useState('IRL');
  const [elapsed, setElapsed] = React.useState(0);
  const [startDaa, setStartDaaState] = React.useState<number | null>(null);
  const [dbStreamId, setDbStreamId] = React.useState<string | null>(null);
  const [previewReady, setPreviewReady] = React.useState(false);
  const [debugInfo, setDebugInfo] = React.useState<string>('');

  // Load current user's profile for display
  React.useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        const { data: p } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', auth.user.id)
          .maybeSingle();
        setProfile(p || null);
      } else {
        setProfile(null);
      }
    })();
  }, []);

  React.useEffect(() => {
    if (live && kaspaAddress) {
      const v = getStartDaa(kaspaAddress);
      setStartDaaState(v);
    } else {
      setStartDaaState(null);
    }
  }, [live, kaspaAddress]);

  React.useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [live]);

  const generateStreamDetails = React.useCallback(async () => {
    try {
      console.log('Generating stream details...');
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
  }, [title]);

  // Auto-generate RTMP details on first load
  const autoInitRef = React.useRef(false);
  React.useEffect(() => {
    if (autoInitRef.current) return;
    autoInitRef.current = true;
    if (!ingestUrl || !streamKey || !playbackUrl) {
      generateStreamDetails().catch(() => {});
    }
  }, [ingestUrl, streamKey, playbackUrl, generateStreamDetails]);

  // Enhanced HLS readiness probe with better debugging
  React.useEffect(() => {
    if (!playbackUrl) { 
      setPreviewReady(false); 
      setDebugInfo('No playback URL available');
      return; 
    }
    
    let cancelled = false;
    const controller = new AbortController();
    let checkCount = 0;
    let intervalId: NodeJS.Timeout | null = null;
    
    const check = async () => {
      if (cancelled) return;
      checkCount++;
      
      try {
        console.log(`HLS check #${checkCount} for ${playbackUrl}`);
        setDebugInfo(`Checking HLS stream... (attempt ${checkCount})`);
        
        const res = await fetch(playbackUrl, { 
          cache: 'no-store', 
          signal: controller.signal,
          headers: {
            'Accept': 'application/vnd.apple.mpegurl, application/x-mpegurl, */*'
          }
        });
        
        console.log(`HLS response status: ${res.status}`);
        
        if (!cancelled && res.ok) {
          const text = await res.text();
          console.log('HLS playlist content:', text.substring(0, 500));
          
          // Check if this is a master playlist (has EXT-X-STREAM-INF)
          if (text.includes('#EXT-X-STREAM-INF')) {
            console.log('Master playlist detected, checking first rendition for segments...');
            // Extract first rendition URL
            const lines = text.split('\n');
            let renditionUrl = null;
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes('#EXT-X-STREAM-INF') && lines[i + 1]) {
                renditionUrl = lines[i + 1].trim();
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
            setDebugInfo('Stream ready! HLS segments found.');
            return;
          } else {
            setDebugInfo(`Stream starting... (playlist exists but no segments yet, attempt ${checkCount})`);
            
            // If we've been waiting too long, show troubleshooting info
            if (checkCount > 15) {
              setDebugInfo(`⚠️ Stream not connecting after ${checkCount} attempts. Verify OBS is streaming to the exact ingest URL and stream key above. Check OBS status bar for "LIVE" indicator.`);
            }
          }
        } else {
          setDebugInfo(`Stream not ready (HTTP ${res.status}, attempt ${checkCount}). ${res.status === 404 ? 'Stream may not exist yet.' : ''}`);
        }
      } catch (error: any) {
        if (!cancelled && error.name !== 'AbortError') {
          console.warn('HLS check error:', error);
          setDebugInfo(`Checking stream... (${error.message}, attempt ${checkCount})`);
        }
      }
    };
    
    setPreviewReady(false);
    setDebugInfo('Starting stream checks...');
    intervalId = setInterval(check, 3000); // Check every 3 seconds
    check(); // Initial check
    
    return () => { 
      cancelled = true; 
      if (intervalId) clearInterval(intervalId); 
      controller.abort(); 
    };
  }, [playbackUrl]);

  const handleStart = React.useCallback(async () => {
    if (!kaspaAddress) {
      toast.error("Connect a Kaspa wallet to go live");
      return;
    }
    try {
      const txs = await fetchAddressFullTxs(kaspaAddress, 50);
      const maxDaa = txs.reduce((m, tx) => Math.max(m, tx.accepting_block_blue_score || 0), 0);
      setStartDaa(kaspaAddress, maxDaa);
      setStartDaaState(maxDaa);
      setLive(true);

      // Persist profile wallet
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        await supabase.from('profiles').upsert({ id: auth.user.id, kaspa_address: kaspaAddress }).select('id');
      }

      // Ensure Livepeer RTMP details exist
      let lpRes: { playbackUrl?: string | null } | null = null;
      if (!ingestUrl || !streamKey || !playbackUrl) {
        lpRes = await generateStreamDetails();
      }
      const pbUrl = playbackUrl || lpRes?.playbackUrl || null;

      if (auth.user) {
        const ins = await supabase.from('streams')
          .insert({ user_id: auth.user.id, title, category, is_live: true, playback_url: pbUrl })
          .select('id')
          .maybeSingle();
        if (!ins.error && ins.data) setDbStreamId(ins.data.id);
      }

      toast.success("Stream started. Kaspa tips scanning enabled.");
    } catch (e:any) {
      toast.error(e?.message || "Failed to start stream");
      setLive(false);
    }
  }, [kaspaAddress, title, category, ingestUrl, streamKey, playbackUrl, generateStreamDetails]);

  const handleEnd = React.useCallback(async () => {
    setLive(false);
    if (kaspaAddress) clearStartDaa(kaspaAddress);
    setStartDaaState(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user && dbStreamId) {
        await supabase.from('streams').update({ is_live: false }).eq('id', dbStreamId).eq('user_id', auth.user.id);
      }
    } catch {}
  }, [kaspaAddress, dbStreamId]);

  useKaspaTipScanner({
    address: kaspaAddress,
    startDaa: startDaa ?? undefined,
    enabled: live && !!kaspaAddress && typeof startDaa === 'number',
    onTip: (tip) => {
      const amountKas = tip.amountSompi / 1e8;
      toast("New KAS tip", { description: `${amountKas.toFixed(8)} KAS • DAA ${tip.daa}${tip.message ? ' — ' + tip.message : ''}` });
      console.log("Tip event", tip);
    },
  });

  return (
    <main className="container mx-auto px-4 py-6">
      <Helmet>
        <title>Go Live — Vivoor</title>
        <meta name="description" content="Set up RTMP ingest and OBS streaming with live preview on Vivoor." />
        <link rel="canonical" href="/go-live" />
      </Helmet>

      <h1 className="sr-only">Go Live</h1>

      {!live ? (
        <section className="max-w-3xl mx-auto glass rounded-xl p-5">
          <div className="text-lg font-semibold">Stream setup</div>
          <div className="grid gap-3 mt-4">
            <label className="text-sm">Title</label>
            <input className="rounded-md bg-background px-3 py-2 text-sm border border-border" value={title} onChange={(e)=>setTitle(e.target.value)} />
            <label className="text-sm mt-2">Category</label>
            <select className="rounded-md bg-background border border-border px-3 py-2" value={category} onChange={(e)=>setCategory(e.target.value)}>
              {['IRL','Music','Gaming','Talk','Sports','Crypto','Tech'].map(c=> <option key={c} value={c}>{c}</option>)}
            </select>
            <label className="text-sm mt-2">Thumbnail (mock)</label>
            <div className="h-24 rounded-md border border-dashed border-border/70 bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">Upload placeholder</div>
            <div className="flex items-center justify-between mt-4 gap-2">
              <Button variant="secondary" onClick={generateStreamDetails} disabled={!title}>Regenerate RTMP</Button>
              <Button variant="hero" onClick={handleStart} disabled={!kaspaAddress || !previewReady}>
                {!previewReady ? 'Preview Required' : 'Start Stream'}
              </Button>
            </div>

            {(ingestUrl || streamKey || playbackUrl) && (
              <div className="mt-4 p-3 rounded-xl border border-border bg-card/60 backdrop-blur-md text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-muted-foreground font-medium">Ingest URL:</span>
                  <code className="px-2 py-1 rounded bg-muted/40 border border-border max-w-full truncate">{ingestUrl ?? '—'}</code>
                  <Button variant="ghost" size="sm" onClick={() => ingestUrl && navigator.clipboard.writeText(ingestUrl).then(()=>toast.success('Copied ingest URL'))}>Copy</Button>
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  <span className="text-muted-foreground font-medium">Stream Key:</span>
                  <code className="px-2 py-1 rounded bg-muted/40 border border-border max-w-full truncate">{streamKey ? '••••••••••' : '—'}</code>
                  <Button variant="ghost" size="sm" onClick={() => streamKey && navigator.clipboard.writeText(streamKey).then(()=>toast.success('Copied stream key'))}>Copy</Button>
                </div>

                {/* Debug info */}
                {debugInfo && (
                  <div className="mt-2 p-2 rounded bg-muted/20 border border-border text-xs text-muted-foreground">
                    <strong>Debug:</strong> {debugInfo}
                  </div>
                )}

                <div className="text-xs text-muted-foreground mt-2">Use these in OBS or Streamlabs. Preview appears once you start streaming in OBS.</div>

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
                    <HlsPlayer src={playbackUrl} autoPlay />
                    {!previewReady && (
                      <div className="text-xs text-muted-foreground mt-2">
                        {debugInfo || "Waiting for stream signal... Start streaming in OBS with the exact settings above. Preview appears in 10–60 seconds."}
                      </div>
                    )}
                    {previewReady && (
                      <div className="space-y-3">
                        <div className="text-xs text-green-600">✓ Stream is live and ready!</div>
                        <div className="flex gap-2">
                          <Button 
                            onClick={handleStart} 
                            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                          >
                            🔴 Start Stream
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setPreviewReady(false);
                              setDebugInfo('Reconnecting...');
                            }}
                          >
                            Reconnect
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="grid lg:grid-cols-3 gap-4 items-start">
          <div className="lg:col-span-2">
            {playbackUrl ? (<HlsPlayer src={playbackUrl} autoPlay />) : (<PlayerPlaceholder />)}
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="px-2 py-0.5 rounded-full bg-grad-primary text-[hsl(var(--on-gradient))]">LIVE</span>
              <span>Elapsed: {new Date(elapsed*1000).toISOString().substring(11,19)}</span>
              <span className="ml-auto">Viewers: 0 (mock)</span>
              <Button variant="destructive" size="sm" onClick={handleEnd}>End Stream</Button>
            </div>
            <div className="mt-4 p-3 rounded-xl border border-border bg-card/60 backdrop-blur-md text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-muted-foreground font-medium">Ingest URL:</span>
                <code className="px-2 py-1 rounded bg-muted/40 border border-border max-w-full truncate">{ingestUrl ?? '—'}</code>
                <Button variant="ghost" size="sm" onClick={() => ingestUrl && navigator.clipboard.writeText(ingestUrl).then(()=>toast.success('Copied ingest URL'))}>Copy</Button>
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-2">
                <span className="text-muted-foreground font-medium">Stream Key:</span>
                <code className="px-2 py-1 rounded bg-muted/40 border border-border max-w-full truncate">{streamKey ? '••••••••••' : '—'}</code>
                <Button variant="ghost" size="sm" onClick={() => streamKey && navigator.clipboard.writeText(streamKey).then(()=>toast.success('Copied stream key'))}>Copy</Button>
              </div>
              <div className="text-xs text-muted-foreground mt-2">Use these in OBS or Streamlabs. Playback is linked automatically.</div>

              <div className="mt-4 grid gap-2">
                <div className="font-medium">OBS setup</div>
                <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                  <li>Settings → Stream → Service: Custom...</li>
                  <li>Server: paste the Ingest URL</li>
                  <li>Stream Key: paste the Stream Key</li>
                  <li>Output → Encoder: x264 or NVENC H.264, Bitrate: 3500–6000 Kbps (1080p60), 8000–12000 Kbps (1440p60), 15000–25000 Kbps (2160p60), Keyframe Interval: 2s</li>
                  <li>Video → Base/Output: 3840x2160, 2560x1440, 1920x1080, or 1280x720, FPS: 30 or 60</li>
                </ul>
              </div>

              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <span className="text-muted-foreground font-medium">Preview URL:</span>
                <code className="px-2 py-1 rounded bg-muted/40 border border-border max-w-full truncate">{playbackUrl ?? '—'}</code>
                {playbackUrl ? (
                  <a className="text-xs underline" href={playbackUrl} target="_blank" rel="noreferrer">Open</a>
                ) : null}
              </div>
            </div>
          </div>
          <div className="lg:col-span-1 space-y-4">
            <div className="rounded-xl border border-border p-3 bg-card/60 backdrop-blur-md">
              <div className="font-medium">Profile</div>
              <div className="flex items-center gap-3 mt-2">
                <Avatar className="size-10">
                  <AvatarImage src={profile?.avatar_url || undefined} alt="Profile avatar" />
                  <AvatarFallback>{(profile?.display_name || profile?.handle || 'U').slice(0,1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <div>{profile?.display_name || profile?.handle || 'Creator'}</div>
                  <button className="text-xs text-muted-foreground hover:text-foreground story-link" onClick={()=>setProfileOpen(true)}>
                    @{profile?.handle || (profile?.display_name ? profile.display_name.toLowerCase().replace(/\s+/g, '_') : 'you')}
                  </button>
                </div>
              </div>
              
              <div className="mt-3"><Button variant="secondary" onClick={()=>setTipOpen(true)} disabled={!kaspaAddress}>Tip in KAS</Button></div>
            </div>
            <div className="rounded-xl border border-border p-3 bg-card/60 backdrop-blur-md">
              <div className="font-medium">Stream Health</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded-full bg-background border border-border">Excellent</span>
                <span className="px-2 py-1 rounded-full bg-background border border-border">Low latency</span>
                <span className="px-2 py-1 rounded-full bg-background border border-border">Stable</span>
              </div>
            </div>
          </div>
        </section>
      )}

      <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} profile={profile ? { id: profile.id, displayName: profile.display_name || profile.handle || 'Creator', handle: profile.handle || (profile.display_name || 'you').toLowerCase().replace(/\s+/g,'_'), bio: profile.bio || '', followers: 0, following: 0, tags: [] } : undefined} isLoggedIn={!!identity} onRequireLogin={()=>{}} onGoToChannel={()=>{ if (dbStreamId) navigate(`/watch/${dbStreamId}`); }} />
      <TipModal open={tipOpen} onOpenChange={setTipOpen} isLoggedIn={!!identity} onRequireLogin={()=>{}} toAddress={kaspaAddress} />
    </main>
  );
};

export default GoLive;
