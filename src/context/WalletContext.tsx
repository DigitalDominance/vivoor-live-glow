import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from '@/integrations/supabase/client';


// Simple local storage helpers
const LS_KEYS = {
  PROFILE_BY_ID: "vivoor.profile.byId", // map of id -> { username, avatarUrl, lastUsernameChange }
  LAST_PROVIDER: "vivoor.wallet.provider", // 'kasware' | 'kastle'
} as const;

type WalletProviderName = "kasware";

export type WalletIdentity = {
  provider: WalletProviderName;
  id: string; // kasware address (kaspa:...) OR kastle publicKey base64
  address: string; // The actual wallet address
};

export type ProfileRecord = {
  username: string;
  avatarUrl?: string;
  lastUsernameChange?: string; // ISO date
  lastAvatarChange?: string; // ISO date for pfp edits cooldown
};


function readProfiles(): Record<string, ProfileRecord> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEYS.PROFILE_BY_ID) || "{}");
  } catch {
    return {};
  }
}

function writeProfiles(map: Record<string, ProfileRecord>) {
  localStorage.setItem(LS_KEYS.PROFILE_BY_ID, JSON.stringify(map));
}

export type WalletState = {
  identity: WalletIdentity | null;
  profile: ProfileRecord | null;
  connecting: boolean;
  // Actions
  connectKasware: () => Promise<void>;
  disconnect: () => Promise<void>;
  ensureUsername: () => { needsUsername: boolean; lastChange?: string };
  saveUsername: (username: string) => Promise<void>;
  saveAvatarUrl: (url: string) => Promise<void>;
};

const WalletContext = createContext<WalletState | null>(null);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [identity, setIdentity] = useState<WalletIdentity | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Restore last session (best-effort)
  useEffect(() => {
    const last = localStorage.getItem(LS_KEYS.LAST_PROVIDER) as WalletProviderName | null;
    if (!last) return;
    // Only re-check passive session without prompting
    if (last === "kasware" && typeof window !== "undefined" && (window as any).kasware) {
      (window as any).kasware
        .getAccounts()
        .then((acc: string[]) => {
          if (Array.isArray(acc) && acc[0]) {
            const addr = acc[0];
            setIdentity({ provider: "kasware", id: addr, address: addr });
            const map = readProfiles();
            setProfile(map[addr] || null);
          }
        })
        .catch(() => {});
    }
  }, []);

  const connectKasware = useCallback(async () => {
    const w = (window as any).kasware;
    if (!w) throw new Error("Kasware wallet not detected");
    setConnecting(true);
    try {
      const accounts: string[] = await w.requestAccounts();
      const addr = accounts?.[0];
      if (!addr) throw new Error("No Kasware account returned");
      
      // Create/update profile in Supabase and get user ID
      const { data: userId, error } = await supabase.rpc('authenticate_wallet_user', {
        wallet_address: addr,
        user_handle: null,
        user_display_name: null
      });

      if (error) {
        console.error('Failed to authenticate wallet user:', error);
        throw error;
      }

      // The function now returns the wallet address as the user ID
      const ident: WalletIdentity = { provider: "kasware", id: userId, address: addr };
      setIdentity(ident);
      localStorage.setItem(LS_KEYS.LAST_PROVIDER, "kasware");
      
      // Load profile from database to sync with local storage
      const { data: dbProfile } = await supabase
        .from('profiles')
        .select('handle, display_name, avatar_url, last_avatar_change')
        .eq('id', userId)
        .maybeSingle();
      
      if (dbProfile) {
        const profileRecord: ProfileRecord = {
          username: dbProfile.handle || '',
          avatarUrl: dbProfile.avatar_url || undefined,
          lastAvatarChange: dbProfile.last_avatar_change || undefined,
        };
        setProfile(profileRecord);
        
        // Update local storage to match database
        const map = readProfiles();
        map[ident.id] = profileRecord;
        writeProfiles(map);
      } else {
        const map = readProfiles();
        setProfile(map[ident.id] || null);
      }
    } finally {
      setConnecting(false);
    }
  }, []);


  const disconnect = useCallback(async () => {
    try {
      // Try to disconnect from Kasware if available
      if (window.kasware && window.kasware.disconnect) {
        await window.kasware.disconnect(window.location.origin);
      }
    } catch (error) {
      console.log('Kasware disconnect not supported or failed:', error);
    }
    
    setIdentity(null);
    setProfile(null);
    localStorage.removeItem(LS_KEYS.LAST_PROVIDER);
  }, []);

  const ensureUsername = useCallback(() => {
    if (!identity) return { needsUsername: false as const };
    const map = readProfiles();
    const rec = map[identity.id];
    if (!rec?.username) return { needsUsername: true as const };
    return { needsUsername: false as const, lastChange: rec.lastUsernameChange };
  }, [identity]);

  const saveUsername = useCallback(
    async (username: string) => {
      if (!identity) return;
      
      // Update Supabase database
      const { error } = await supabase
        .from('profiles')
        .update({ 
          handle: username,
          display_name: username,
          updated_at: new Date().toISOString()
        })
        .eq('id', identity.id);
      
      if (error) {
        console.error('Failed to update username in database:', error);
        throw error;
      }
      
      // Update local storage
      const map = readProfiles();
      const nowIso = new Date().toISOString();
      const rec: ProfileRecord = {
        username,
        avatarUrl: map[identity.id]?.avatarUrl,
        lastUsernameChange: nowIso,
      };
      map[identity.id] = rec;
      writeProfiles(map);
      setProfile(rec);
    },
    [identity]
  );

const saveAvatarUrl = useCallback(
    async (url: string) => {
      if (!identity) return;
      
      // Update Supabase database
      const { error } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: url,
          last_avatar_change: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', identity.id);
      
      if (error) {
        console.error('Failed to update avatar in database:', error);
        throw error;
      }
      
      // Update local storage
      const map = readProfiles();
      const nowIso = new Date().toISOString();
      const rec: ProfileRecord = {
        username: map[identity.id]?.username || profile?.username || "",
        avatarUrl: url,
        lastUsernameChange: map[identity.id]?.lastUsernameChange,
        lastAvatarChange: nowIso,
      };
      map[identity.id] = rec;
      writeProfiles(map);
      setProfile(rec);
    },
    [identity, profile?.username]
  );

  const value = useMemo<WalletState>(
    () => ({ identity, profile, connecting, connectKasware, disconnect, ensureUsername, saveUsername, saveAvatarUrl }),
    [identity, profile, connecting, connectKasware, disconnect, ensureUsername, saveUsername, saveAvatarUrl]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
};
