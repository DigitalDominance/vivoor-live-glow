import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from '@/integrations/supabase/client';
import { getEncryptedUserId } from '@/lib/walletEncryption';


// Simple local storage helpers
const LS_KEYS = {
  PROFILE_BY_ID: "vivoor.profile.byId", // map of id -> { username, avatarUrl, lastUsernameChange }
  LAST_PROVIDER: "vivoor.wallet.provider", // 'kasware' | 'kastle'
  SESSION_TOKEN: "vivoor.wallet.sessionToken", // JWT session token
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
  sessionToken: string | null;
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
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  // Restore last session (best-effort)
  useEffect(() => {
    const last = localStorage.getItem(LS_KEYS.LAST_PROVIDER) as WalletProviderName | null;
    const storedToken = localStorage.getItem(LS_KEYS.SESSION_TOKEN);
    
    if (!last || !storedToken) return;
    
    // Only re-check passive session without prompting
    if (last === "kasware" && typeof window !== "undefined" && (window as any).kasware) {
      (window as any).kasware
        .getAccounts()
        .then(async (acc: string[]) => {
          if (Array.isArray(acc) && acc[0]) {
            const addr = acc[0];
            
            // Verify the stored JWT token is still valid
            const { data: authResult, error: authError } = await supabase.rpc('verify_wallet_jwt', {
              session_token_param: storedToken,
              wallet_address_param: addr
            });
            
            if (authError || !authResult?.[0]?.is_valid) {
              console.error('Invalid session token, clearing session');
              localStorage.removeItem(LS_KEYS.LAST_PROVIDER);
              localStorage.removeItem(LS_KEYS.SESSION_TOKEN);
              return;
            }
            
            const encryptedUserId = authResult[0].encrypted_user_id;
            
            // Verify the user exists in the database with this encrypted ID
            const { data: dbProfile, error } = await supabase
              .from('profiles')
              .select('id, handle, display_name, avatar_url, last_avatar_change, last_username_change, kaspa_address')
              .eq('id', encryptedUserId)
              .eq('kaspa_address', addr)
              .maybeSingle();

            if (error || !dbProfile) {
              console.error('Failed to restore wallet session:', error);
              localStorage.removeItem(LS_KEYS.LAST_PROVIDER);
              localStorage.removeItem(LS_KEYS.SESSION_TOKEN);
              return;
            }

            setIdentity({ provider: "kasware", id: encryptedUserId, address: addr });
            setSessionToken(storedToken);
            
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
              map[encryptedUserId] = profileRecord;
              writeProfiles(map);
            } else {
              const map = readProfiles();
              setProfile(map[encryptedUserId] || null);
            }
          }
        })
        .catch(() => {
          // Clear invalid session
          localStorage.removeItem(LS_KEYS.LAST_PROVIDER);
          localStorage.removeItem(LS_KEYS.SESSION_TOKEN);
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
      
      // Generate a cryptographically secure message for signature verification
      const timestamp = Date.now();
      // Generate a 32-character hex nonce for replay attack prevention
      const nonceArray = new Uint8Array(16);
      crypto.getRandomValues(nonceArray);
      const nonce = Array.from(nonceArray, byte => byte.toString(16).padStart(2, '0')).join('');
      const message = `VIVOOR_AUTH_${timestamp}_${nonce}`;
      
      // Get the public key from Kasware for signature verification
      let publicKey: string | undefined;
      try {
        publicKey = await w.getPublicKey();
        console.log('Retrieved public key from Kasware:', publicKey);
      } catch (pubKeyError) {
        console.warn('Failed to get public key from Kasware:', pubKeyError);
        // Continue without public key - the backend will handle validation
      }
      
      // Request signature to prove wallet ownership
      let signature: string;
      try {
        signature = await w.signMessage(message, "ecdsa");
      } catch (signError) {
        console.error('Failed to sign authentication message:', signError);
        throw new Error('Message signing is required to verify wallet ownership');
      }
      
      if (!signature || signature.length < 50) {
        throw new Error('Invalid signature - unable to verify wallet ownership');
      }
      
      console.log('Authenticating with secure edge function...');
      
      // Use the secure edge function for authentication
      const { data: authResult, error: authError } = await supabase.functions.invoke(
        'authenticate-wallet',
        {
          body: {
            walletAddress: addr,
            message,
            signature,
            publicKey
          }
        }
      );

      if (authError || !authResult?.success) {
        console.error('Authentication failed:', authError, authResult);
        throw new Error(authResult?.error || authError?.message || 'Authentication failed');
      }

      const { sessionToken, encryptedUserId } = authResult;

      // Set identity with the encrypted user ID and store session token
      const ident: WalletIdentity = { provider: "kasware", id: encryptedUserId, address: addr };
      setIdentity(ident);
      setSessionToken(sessionToken);
      localStorage.setItem(LS_KEYS.LAST_PROVIDER, "kasware");
      localStorage.setItem(LS_KEYS.SESSION_TOKEN, sessionToken);
      
      // Load profile from database to sync with local storage
      const { data: dbProfile } = await supabase
        .from('profiles')
        .select('handle, display_name, avatar_url, last_avatar_change, last_username_change')
        .eq('id', encryptedUserId)
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
        map[encryptedUserId] = profileRecord;
        writeProfiles(map);
      } else {
        const map = readProfiles();
        setProfile(map[encryptedUserId] || null);
      }
    } finally {
      setConnecting(false);
    }
  }, []);


  const disconnect = useCallback(async () => {
    try {
      // Invalidate the JWT session if we have one
      if (sessionToken) {
        await supabase.rpc('invalidate_wallet_session', {
          session_token_param: sessionToken
        });
      }
      
      // Try to disconnect from Kasware if available
      if (window.kasware && window.kasware.disconnect) {
        await window.kasware.disconnect(window.location.origin);
      }
    } catch (error) {
      console.log('Kasware disconnect not supported or failed:', error);
    }
    
    setIdentity(null);
    setProfile(null);
    setSessionToken(null);
    localStorage.removeItem(LS_KEYS.LAST_PROVIDER);
    localStorage.removeItem(LS_KEYS.SESSION_TOKEN);
  }, [sessionToken]);

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
      if (!identity || !sessionToken) {
        throw new Error('Authentication required');
      }
      
      try {
        // Use the secure database function that enforces JWT verification
        const { error } = await supabase.rpc('update_username_secure', {
          session_token_param: sessionToken,
          wallet_address_param: identity.address,
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
    [identity, sessionToken]
  );

const saveAvatarUrl = useCallback(
    async (url: string) => {
      if (!identity || !sessionToken) {
        throw new Error('Authentication required');
      }
      
      try {
        // Use the secure database function that enforces JWT verification
        const { error } = await supabase.rpc('update_avatar_secure', {
          session_token_param: sessionToken,
          wallet_address_param: identity.address,
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
    [identity, sessionToken, profile?.username]
  );

  const saveProfile = useCallback(
    async (updates: { handle?: string; display_name?: string; bio?: string; banner_url?: string }) => {
      if (!identity || !sessionToken) {
        throw new Error('Authentication required');
      }
      
      // Check if handle is already taken (if updating handle)
      if (updates.handle) {
        try {
          // Use the secure database function that enforces cooldown for username changes
          const { error } = await supabase.rpc('update_username_secure', {
            session_token_param: sessionToken,
            wallet_address_param: identity.address,
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
      }
      
      // Handle bio updates
      if (updates.bio !== undefined) {
        try {
          const { error } = await supabase.rpc('update_bio_secure', {
            session_token_param: sessionToken,
            wallet_address_param: identity.address,
            new_bio: updates.bio
          });
          
          if (error) {
            console.error('Failed to update bio:', error);
            throw new Error(error.message);
          }
        } catch (error) {
          console.error('Failed to update bio:', error);
          throw error;
        }
      }
      
      // Handle banner updates
      if (updates.banner_url !== undefined) {
        try {
          const { error } = await supabase.rpc('update_banner_secure', {
            session_token_param: sessionToken,
            wallet_address_param: identity.address,
            new_banner_url: updates.banner_url
          });
          
          if (error) {
            console.error('Failed to update banner:', error);
            throw new Error(error.message);
          }
        } catch (error) {
          console.error('Failed to update banner:', error);
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
    [identity, sessionToken]
  );

  const value = useMemo<WalletState>(
    () => ({ identity, profile, connecting, sessionToken, connectKasware, disconnect, ensureUsername, saveUsername, saveAvatarUrl, saveProfile }),
    [identity, profile, connecting, sessionToken, connectKasware, disconnect, ensureUsername, saveUsername, saveAvatarUrl, saveProfile]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
};
