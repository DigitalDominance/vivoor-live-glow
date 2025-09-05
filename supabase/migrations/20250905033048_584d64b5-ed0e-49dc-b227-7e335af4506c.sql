-- Create secure functions for likes, follows, and streams that use JWT authentication

-- Function to handle stream likes with JWT verification
CREATE OR REPLACE FUNCTION public.toggle_stream_like_secure(
  session_token_param TEXT,
  wallet_address_param TEXT,
  stream_id_param UUID
) RETURNS TABLE(action TEXT, new_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  auth_result RECORD;
  existing_like RECORD;
  like_count INTEGER;
BEGIN
  -- Verify the JWT session
  SELECT * INTO auth_result 
  FROM public.verify_wallet_jwt(session_token_param, wallet_address_param);
  
  IF NOT auth_result.is_valid THEN
    RAISE EXCEPTION 'Invalid or expired session token';
  END IF;
  
  -- Check if user already liked this stream
  SELECT * INTO existing_like
  FROM public.likes
  WHERE user_id = auth_result.encrypted_user_id AND stream_id = stream_id_param;
  
  IF existing_like.id IS NOT NULL THEN
    -- Unlike
    DELETE FROM public.likes
    WHERE user_id = auth_result.encrypted_user_id AND stream_id = stream_id_param;
    
    SELECT COUNT(*)::INTEGER INTO like_count
    FROM public.likes WHERE stream_id = stream_id_param;
    
    RETURN QUERY SELECT 'unliked'::TEXT, like_count;
  ELSE
    -- Like
    INSERT INTO public.likes (user_id, stream_id)
    VALUES (auth_result.encrypted_user_id, stream_id_param);
    
    SELECT COUNT(*)::INTEGER INTO like_count
    FROM public.likes WHERE stream_id = stream_id_param;
    
    RETURN QUERY SELECT 'liked'::TEXT, like_count;
  END IF;
  
  -- Refresh the session
  PERFORM public.refresh_wallet_session(session_token_param);
END;
$$;

-- Function to handle clip likes with JWT verification
CREATE OR REPLACE FUNCTION public.toggle_clip_like_secure(
  session_token_param TEXT,
  wallet_address_param TEXT,
  clip_id_param UUID
) RETURNS TABLE(action TEXT, new_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  auth_result RECORD;
  existing_like RECORD;
  like_count INTEGER;
BEGIN
  -- Verify the JWT session
  SELECT * INTO auth_result 
  FROM public.verify_wallet_jwt(session_token_param, wallet_address_param);
  
  IF NOT auth_result.is_valid THEN
    RAISE EXCEPTION 'Invalid or expired session token';
  END IF;
  
  -- Check if user already liked this clip
  SELECT * INTO existing_like
  FROM public.clip_likes
  WHERE user_id = auth_result.encrypted_user_id AND clip_id = clip_id_param;
  
  IF existing_like.id IS NOT NULL THEN
    -- Unlike
    DELETE FROM public.clip_likes
    WHERE user_id = auth_result.encrypted_user_id AND clip_id = clip_id_param;
    
    SELECT COUNT(*)::INTEGER INTO like_count
    FROM public.clip_likes WHERE clip_id = clip_id_param;
    
    RETURN QUERY SELECT 'unliked'::TEXT, like_count;
  ELSE
    -- Like
    INSERT INTO public.clip_likes (user_id, clip_id)
    VALUES (auth_result.encrypted_user_id, clip_id_param);
    
    SELECT COUNT(*)::INTEGER INTO like_count
    FROM public.clip_likes WHERE clip_id = clip_id_param;
    
    RETURN QUERY SELECT 'liked'::TEXT, like_count;
  END IF;
  
  -- Refresh the session
  PERFORM public.refresh_wallet_session(session_token_param);
END;
$$;

-- Function to handle follows with JWT verification
CREATE OR REPLACE FUNCTION public.toggle_follow_secure(
  session_token_param TEXT,
  wallet_address_param TEXT,
  following_id_param TEXT
) RETURNS TABLE(action TEXT, new_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  auth_result RECORD;
  existing_follow RECORD;
  follower_count INTEGER;
BEGIN
  -- Verify the JWT session
  SELECT * INTO auth_result 
  FROM public.verify_wallet_jwt(session_token_param, wallet_address_param);
  
  IF NOT auth_result.is_valid THEN
    RAISE EXCEPTION 'Invalid or expired session token';
  END IF;
  
  -- Check if user already follows this user
  SELECT * INTO existing_follow
  FROM public.follows
  WHERE follower_id = auth_result.encrypted_user_id AND following_id = following_id_param;
  
  IF existing_follow.id IS NOT NULL THEN
    -- Unfollow
    DELETE FROM public.follows
    WHERE follower_id = auth_result.encrypted_user_id AND following_id = following_id_param;
    
    SELECT COUNT(*)::INTEGER INTO follower_count
    FROM public.follows WHERE following_id = following_id_param;
    
    RETURN QUERY SELECT 'unfollowed'::TEXT, follower_count;
  ELSE
    -- Follow
    INSERT INTO public.follows (follower_id, following_id)
    VALUES (auth_result.encrypted_user_id, following_id_param);
    
    SELECT COUNT(*)::INTEGER INTO follower_count
    FROM public.follows WHERE following_id = following_id_param;
    
    RETURN QUERY SELECT 'followed'::TEXT, follower_count;
  END IF;
  
  -- Refresh the session
  PERFORM public.refresh_wallet_session(session_token_param);
END;
$$;

-- Function to create streams with JWT verification
CREATE OR REPLACE FUNCTION public.create_stream_secure(
  session_token_param TEXT,
  wallet_address_param TEXT,
  title_param TEXT,
  category_param TEXT DEFAULT NULL,
  livepeer_stream_id_param TEXT DEFAULT NULL,
  livepeer_playback_id_param TEXT DEFAULT NULL,
  streaming_mode_param TEXT DEFAULT 'rtmp',
  is_live_param BOOLEAN DEFAULT FALSE
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  auth_result RECORD;
  new_stream_id UUID;
BEGIN
  -- Verify the JWT session
  SELECT * INTO auth_result 
  FROM public.verify_wallet_jwt(session_token_param, wallet_address_param);
  
  IF NOT auth_result.is_valid THEN
    RAISE EXCEPTION 'Invalid or expired session token';
  END IF;
  
  -- Create the stream
  INSERT INTO public.streams (
    user_id,
    title,
    category,
    livepeer_stream_id,
    livepeer_playback_id,
    streaming_mode,
    is_live
  ) VALUES (
    auth_result.encrypted_user_id,
    title_param,
    category_param,
    livepeer_stream_id_param,
    livepeer_playback_id_param,
    streaming_mode_param,
    is_live_param
  ) RETURNING id INTO new_stream_id;
  
  -- Refresh the session
  PERFORM public.refresh_wallet_session(session_token_param);
  
  RETURN new_stream_id;
END;
$$;