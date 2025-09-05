import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from '@/integrations/supabase/client';
import { getEncryptedUserId } from '@/lib/walletEncryption';
import { useAuth } from './AuthContext';
import { toast } from '@/hooks/use-toast';

type WalletProviderName = "kasware";

export type WalletIdentity = {
  provider: WalletProviderName;
  id: string; // Encrypted user ID
  address: string; // The actual wallet address
};

export type ProfileRecord = {
  username: string;
  avatarUrl?: string;
  lastUsernameChange?: string;
  lastAvatarChange?: string;
  bio?: string;
  bannerUrl?: string;
};

export type SecureWalletState = {
  identity: WalletIdentity | null;
  profile: ProfileRecord | null;
  connecting: boolean;
  authenticated: boolean;
  // Actions
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  updateBio: (bio: string) => Promise<void>;
  updateBanner: (bannerUrl: string) => Promise<void>;
  updateAvatar: (avatarUrl: string) => Promise<void>;
  updateUsername: (username: string) => Promise<void>;
};

const SecureWalletContext = createContext<SecureWalletState | null>(null);

export const SecureWalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, session } = useAuth();
  const [identity, setIdentity] = useState<WalletIdentity | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Load wallet connection when user is authenticated
  useEffect(() => {
    if (user && session) {
      loadWalletConnection();
    } else {
      setIdentity(null);
      setProfile(null);
    }
  }, [user, session]);

  const loadWalletConnection = async () => {
    if (!user) return;

    try {
      // Get the user's primary wallet connection
      const { data: connection, error } = await supabase
        .from('wallet_connections')
        .select('wallet_address, encrypted_user_id, is_primary')
        .eq('user_id', user.id)
        .eq('is_primary', true)
        .maybeSingle();

      if (error) {
        console.error('Error loading wallet connection:', error);
        return;
      }

      if (connection) {
        // Load the profile data
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('handle, display_name, avatar_url, bio, banner_url, last_username_change, last_avatar_change')
          .eq('id', connection.encrypted_user_id)
          .maybeSingle();

        if (!profileError && profileData) {
          setIdentity({
            provider: "kasware",
            id: connection.encrypted_user_id,
            address: connection.wallet_address
          });

          setProfile({
            username: profileData.handle || '',
            avatarUrl: profileData.avatar_url || undefined,
            bio: profileData.bio || undefined,
            bannerUrl: profileData.banner_url || undefined,
            lastUsernameChange: profileData.last_username_change || undefined,
            lastAvatarChange: profileData.last_avatar_change || undefined,
          });
        }
      }
    } catch (error) {
      console.error('Error loading wallet connection:', error);
    }
  };

  const connectWallet = useCallback(async () => {
    if (!user || !session) {
      toast({
        title: "Authentication required",
        description: "Please sign in first before connecting your wallet.",
        variant: "destructive"
      });
      return;
    }

    const w = (window as any).kasware;
    if (!w) {
      toast({
        title: "Wallet not detected",
        description: "Please install Kasware wallet extension.",
        variant: "destructive"
      });
      return;
    }

    setConnecting(true);
    try {
      const accounts: string[] = await w.requestAccounts();
      const addr = accounts?.[0];
      if (!addr) throw new Error("No Kasware account returned");

      // Connect wallet to authenticated user using the secure function
      const { data: encryptedUserId, error } = await supabase.rpc('connect_wallet_to_user', {
        wallet_address: addr
      });

      if (error) {
        console.error('Failed to connect wallet:', error);
        throw new Error(error.message);
      }

      // Set identity and reload profile
      setIdentity({
        provider: "kasware",
        id: encryptedUserId,
        address: addr
      });

      await loadWalletConnection();

      toast({
        title: "Wallet connected!",
        description: "Your wallet has been securely connected to your account."
      });

    } catch (error) {
      console.error('Failed to connect wallet:', error);
      toast({
        title: "Failed to connect wallet",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive"
      });
    } finally {
      setConnecting(false);
    }
  }, [user, session]);

  const disconnectWallet = useCallback(async () => {
    setIdentity(null);
    setProfile(null);
    
    try {
      // Try to disconnect from Kasware if available
      if (window.kasware && window.kasware.disconnect) {
        await window.kasware.disconnect(window.location.origin);
      }
    } catch (error) {
      console.log('Kasware disconnect not supported or failed:', error);
    }

    toast({
      title: "Wallet disconnected",
      description: "Your wallet has been disconnected."
    });
  }, []);

  const updateBio = useCallback(async (bio: string) => {
    if (!identity || !user) {
      throw new Error('Authentication required');
    }

    try {
      const { error } = await supabase.rpc('update_bio_secure', {
        encrypted_user_id: identity.id,
        new_bio: bio
      });

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, bio } : null);
      
      toast({
        title: "Bio updated",
        description: "Your profile bio has been updated successfully."
      });
    } catch (error) {
      console.error('Failed to update bio:', error);
      throw error;
    }
  }, [identity, user]);

  const updateBanner = useCallback(async (bannerUrl: string) => {
    if (!identity || !user) {
      throw new Error('Authentication required');
    }

    try {
      const { error } = await supabase.rpc('update_banner_secure', {
        encrypted_user_id: identity.id,
        new_banner_url: bannerUrl
      });

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, bannerUrl } : null);
      
      toast({
        title: "Banner updated",
        description: "Your profile banner has been updated successfully."
      });
    } catch (error) {
      console.error('Failed to update banner:', error);
      throw error;
    }
  }, [identity, user]);

  const updateAvatar = useCallback(async (avatarUrl: string) => {
    if (!identity || !user) {
      throw new Error('Authentication required');
    }

    try {
      const { error } = await supabase.rpc('update_avatar', {
        user_id_param: identity.id,
        new_avatar_url: avatarUrl
      });

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, avatarUrl, lastAvatarChange: new Date().toISOString() } : null);
      
      toast({
        title: "Avatar updated",
        description: "Your profile avatar has been updated successfully."
      });
    } catch (error) {
      console.error('Failed to update avatar:', error);
      throw error;
    }
  }, [identity, user]);

  const updateUsername = useCallback(async (username: string) => {
    if (!identity || !user) {
      throw new Error('Authentication required');
    }

    try {
      const { error } = await supabase.rpc('update_username', {
        user_id_param: identity.id,
        new_username: username
      });

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, username, lastUsernameChange: new Date().toISOString() } : null);
      
      toast({
        title: "Username updated",
        description: "Your username has been updated successfully."
      });
    } catch (error) {
      console.error('Failed to update username:', error);
      throw error;
    }
  }, [identity, user]);

  const value = useMemo<SecureWalletState>(
    () => ({
      identity,
      profile,
      connecting,
      authenticated: !!user && !!session,
      connectWallet,
      disconnectWallet,
      updateBio,
      updateBanner,
      updateAvatar,
      updateUsername
    }),
    [identity, profile, connecting, user, session, connectWallet, disconnectWallet, updateBio, updateBanner, updateAvatar, updateUsername]
  );

  return (
    <SecureWalletContext.Provider value={value}>
      {children}
    </SecureWalletContext.Provider>
  );
};

export const useSecureWallet = () => {
  const context = useContext(SecureWalletContext);
  if (!context) {
    throw new Error('useSecureWallet must be used within SecureWalletProvider');
  }
  return context;
};