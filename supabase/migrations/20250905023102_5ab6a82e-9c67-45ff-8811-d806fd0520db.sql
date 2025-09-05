-- Add last_username_change column to profiles table for cooldown tracking
ALTER TABLE public.profiles 
ADD COLUMN last_username_change timestamp with time zone;

-- Function to check if user can change username (14 day cooldown)
CREATE OR REPLACE FUNCTION public.can_change_username(user_id_param text)
RETURNS TABLE(can_change boolean, cooldown_ends_at timestamp with time zone)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN p.last_username_change IS NULL THEN true
      WHEN p.last_username_change < now() - interval '14 days' THEN true
      ELSE false
    END as can_change,
    CASE 
      WHEN p.last_username_change IS NULL THEN null
      ELSE p.last_username_change + interval '14 days'
    END as cooldown_ends_at
  FROM public.profiles p
  WHERE p.id = user_id_param;
END;
$$;

-- Function to check if user can change avatar (24 hour cooldown)
CREATE OR REPLACE FUNCTION public.can_change_avatar(user_id_param text)
RETURNS TABLE(can_change boolean, cooldown_ends_at timestamp with time zone)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN p.last_avatar_change IS NULL THEN true
      WHEN p.last_avatar_change < now() - interval '24 hours' THEN true
      ELSE false
    END as can_change,
    CASE 
      WHEN p.last_avatar_change IS NULL THEN null
      ELSE p.last_avatar_change + interval '24 hours'
    END as cooldown_ends_at
  FROM public.profiles p
  WHERE p.id = user_id_param;
END;
$$;

-- Function to safely update username with cooldown check
CREATE OR REPLACE FUNCTION public.update_username(user_id_param text, new_username text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  can_change boolean;
  cooldown_ends timestamp with time zone;
BEGIN
  -- Check if user can change username
  SELECT cc.can_change, cc.cooldown_ends_at INTO can_change, cooldown_ends
  FROM public.can_change_username(user_id_param) cc;
  
  IF NOT can_change THEN
    RAISE EXCEPTION 'Username can only be changed once every 14 days. Next change available at: %', cooldown_ends;
  END IF;
  
  -- Check if username is already taken
  IF EXISTS (SELECT 1 FROM public.profiles WHERE handle = new_username AND id != user_id_param) THEN
    RAISE EXCEPTION 'Username is already taken';
  END IF;
  
  -- Update username
  UPDATE public.profiles
  SET 
    handle = new_username,
    display_name = new_username,
    last_username_change = now(),
    updated_at = now()
  WHERE id = user_id_param;
END;
$$;

-- Function to safely update avatar with cooldown check
CREATE OR REPLACE FUNCTION public.update_avatar(user_id_param text, new_avatar_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  can_change boolean;
  cooldown_ends timestamp with time zone;
BEGIN
  -- Check if user can change avatar
  SELECT cc.can_change, cc.cooldown_ends_at INTO can_change, cooldown_ends
  FROM public.can_change_avatar(user_id_param) cc;
  
  IF NOT can_change THEN
    RAISE EXCEPTION 'Avatar can only be changed once every 24 hours. Next change available at: %', cooldown_ends;
  END IF;
  
  -- Update avatar
  UPDATE public.profiles
  SET 
    avatar_url = new_avatar_url,
    last_avatar_change = now(),
    updated_at = now()
  WHERE id = user_id_param;
END;
$$;