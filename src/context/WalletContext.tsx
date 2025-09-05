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
  saveProfile: (updates: { handle?: string; display_name?: string; bio?: string; banner_url?: string }) => Promise<void>;
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
        .then(async (acc: string[]) => {
          if (Array.isArray(acc) && acc[0]) {
            const addr = acc[0];
            
            // Get the correct user ID from database
            const { data: userId, error } = await supabase.rpc('authenticate_wallet_user', {
              wallet_address: addr,
              user_handle: null,
              user_display_name: null
            });

            if (error) {
              console.error('Failed to restore wallet session:', error);
              localStorage.removeItem(LS_KEYS.LAST_PROVIDER);
              return;
            }

            setIdentity({ provider: "kasware", id: userId, address: addr });
            
            // Load profile from database to ensure consistency
            const { data: dbProfile } = await supabase
              .from('profiles')
              .select('handle, display_name, avatar_url, last_avatar_change, last_username_change')
              .eq('id', userId)
              .maybeSingle();
            
            if (dbProfile) {
              const profileRecord: ProfileRecord = {
                username: dbProfile.handle || '',
                avatarUrl: dbProfile.avatar_url || undefined,
                lastAvatarChange: dbProfile.last_avatar_change || undefined,
                lastUsernameChange: dbProfile.last_username_change || undefined,
              };
              setProfile(profileRecord);
              
              // Update local storage to match database
              const map = readProfiles();
              map[userId] = profileRecord;
              writeProfiles(map);
            } else {
              const map = readProfiles();
              setProfile(map[userId] || null);
            }
          }
        })
        .catch(() => {
          // Clear invalid session
          localStorage.removeItem(LS_KEYS.LAST_PROVIDER);
        });
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
        .select('handle, display_name, avatar_url, last_avatar_change, last_username_change')
        .eq('id', userId)
        .maybeSingle();
      
      if (dbProfile) {
        const profileRecord: ProfileRecord = {
          username: dbProfile.handle || '',
          avatarUrl: dbProfile.avatar_url || undefined,
          lastAvatarChange: dbProfile.last_avatar_change || undefined,
          lastUsernameChange: dbProfile.last_username_change || undefined,
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
    
    // Check if profile has a username (either from current state or localStorage)
    const hasUsername = profile?.username || readProfiles()[identity.id]?.username;
    
    // Check if the username is auto-generated (starts with "user_")
    const isAutoGenerated = hasUsername && hasUsername.startsWith('user_');
    
    if (!hasUsername || isAutoGenerated) return { needsUsername: true as const };
    return { needsUsername: false as const, lastChange: profile?.lastUsernameChange };
  }, [identity, profile]);

  const saveUsername = useCallback(
    async (username: string) => {
      if (!identity) return;
      
      try {
        // Use the database function that enforces cooldown
        const { error } = await supabase.rpc('update_username', {
          user_id_param: identity.id,
          new_username: username
        });
        
        if (error) {
          console.error('Failed to update username:', error);
          throw new Error(error.message);
        }
        
        // Update local storage
        const map = readProfiles();
        const nowIso = new Date().toISOString();
        const rec: ProfileRecord = {
          username,
          avatarUrl: map[identity.id]?.avatarUrl,
          lastUsernameChange: nowIso,
          lastAvatarChange: map[identity.id]?.lastAvatarChange, // Preserve existing avatar cooldown
        };
        map[identity.id] = rec;
        writeProfiles(map);
        setProfile(rec);
      } catch (error) {
        console.error('Failed to update username:', error);
        throw error;
      }
    },
    [identity]
  );

const saveAvatarUrl = useCallback(
    async (url: string) => {
      if (!identity) return;
      
      try {
        // Use the database function that enforces cooldown
        const { error } = await supabase.rpc('update_avatar', {
          user_id_param: identity.id,
          new_avatar_url: url
        });
        
        if (error) {
          console.error('Failed to update avatar:', error);
          throw new Error(error.message);
        }
        
        // Update local storage - preserve existing username change timestamp
        const map = readProfiles();
        const nowIso = new Date().toISOString();
        const rec: ProfileRecord = {
          username: map[identity.id]?.username || profile?.username || "",
          avatarUrl: url,
          lastUsernameChange: map[identity.id]?.lastUsernameChange, // Preserve existing username cooldown
          lastAvatarChange: nowIso,
        };
        map[identity.id] = rec;
        writeProfiles(map);
        setProfile(rec);
      } catch (error) {
        console.error('Failed to update avatar:', error);
        throw error;
      }
    },
    [identity, profile?.username]
  );

  const saveProfile = useCallback(
    async (updates: { handle?: string; display_name?: string; bio?: string; banner_url?: string }) => {
      if (!identity) return;
      
      // Check if handle is already taken (if updating handle)
      if (updates.handle) {
        try {
          // Use the database function that enforces cooldown for username changes
          const { error } = await supabase.rpc('update_username', {
            user_id_param: identity.id,
            new_username: updates.handle
          });
          
          if (error) {
            console.error('Failed to update username:', error);
            throw new Error(error.message);
          }
        } catch (error) {
          console.error('Failed to update profile:', error);
          throw error;
        }
      } else {
        // Update Supabase database for non-username changes
        const { error } = await supabase
          .from('profiles')
          .update({ 
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('id', identity.id);
        
        if (error) {
          console.error('Failed to update profile in database:', error);
          throw error;
        }
      }
      
      // Update local storage if username changed
      if (updates.handle) {
        const map = readProfiles();
        const nowIso = new Date().toISOString();
        const rec: ProfileRecord = {
          username: updates.handle,
          avatarUrl: map[identity.id]?.avatarUrl,
          lastUsernameChange: nowIso,
          lastAvatarChange: map[identity.id]?.lastAvatarChange, // Preserve existing avatar cooldown
        };
        map[identity.id] = rec;
        writeProfiles(map);
        setProfile(rec);
      }
    },
    [identity]
  );

  const value = useMemo<WalletState>(
    () => ({ identity, profile, connecting, connectKasware, disconnect, ensureUsername, saveUsername, saveAvatarUrl, saveProfile }),
    [identity, profile, connecting, connectKasware, disconnect, ensureUsername, saveUsername, saveAvatarUrl, saveProfile]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
};
