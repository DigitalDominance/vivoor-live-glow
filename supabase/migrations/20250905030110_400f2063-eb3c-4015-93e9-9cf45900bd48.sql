-- Migrate existing wallet address user IDs to encrypted versions
-- Create temporary table to store old ID mappings
CREATE TEMP TABLE id_mappings (
  old_id text,
  new_id text,
  wallet_address text
);

-- Generate new encrypted IDs for existing users and store mappings
INSERT INTO id_mappings (old_id, new_id, wallet_address)
SELECT 
  p.id as old_id,
  encrypt_wallet_address(p.kaspa_address) as new_id,
  p.kaspa_address as wallet_address
FROM profiles p 
WHERE p.kaspa_address IS NOT NULL 
  AND p.id LIKE 'kaspa:%';

-- Show what we're about to migrate (for verification)
SELECT old_id, new_id, wallet_address FROM id_mappings;

-- Update all related tables with new encrypted IDs
-- Start with profiles table
UPDATE profiles 
SET id = (SELECT new_id FROM id_mappings WHERE old_id = profiles.id)
WHERE id IN (SELECT old_id FROM id_mappings);

-- Update streams table
UPDATE streams 
SET user_id = (SELECT new_id FROM id_mappings WHERE old_id = streams.user_id)
WHERE user_id IN (SELECT old_id FROM id_mappings);

-- Update likes table
UPDATE likes 
SET user_id = (SELECT new_id FROM id_mappings WHERE old_id = likes.user_id)
WHERE user_id IN (SELECT old_id FROM id_mappings);

-- Update follows table
UPDATE follows 
SET follower_id = (SELECT new_id FROM id_mappings WHERE old_id = follows.follower_id),
    following_id = (SELECT new_id FROM id_mappings WHERE old_id = follows.following_id)
WHERE follower_id IN (SELECT old_id FROM id_mappings) 
   OR following_id IN (SELECT old_id FROM id_mappings);

-- Update reports table
UPDATE reports 
SET reported_user_id = (SELECT new_id FROM id_mappings WHERE old_id = reports.reported_user_id),
    reporter_user_id = (SELECT new_id FROM id_mappings WHERE old_id = reports.reporter_user_id)
WHERE reported_user_id IN (SELECT old_id FROM id_mappings) 
   OR reporter_user_id IN (SELECT old_id FROM id_mappings);

-- Update verifications table
UPDATE verifications 
SET user_id = (SELECT new_id FROM id_mappings WHERE old_id = verifications.user_id)
WHERE user_id IN (SELECT old_id FROM id_mappings);

-- Update payment_verifications table
UPDATE payment_verifications 
SET user_id = (SELECT new_id FROM id_mappings WHERE old_id = payment_verifications.user_id)
WHERE user_id IN (SELECT old_id FROM id_mappings);

-- Update vods table
UPDATE vods 
SET user_id = (SELECT new_id FROM id_mappings WHERE old_id = vods.user_id)
WHERE user_id IN (SELECT old_id FROM id_mappings);

-- Update clips table
UPDATE clips 
SET user_id = (SELECT new_id FROM id_mappings WHERE old_id = clips.user_id)
WHERE user_id IN (SELECT old_id FROM id_mappings);

-- Update chat_messages table
UPDATE chat_messages 
SET user_id = (SELECT new_id FROM id_mappings WHERE old_id = chat_messages.user_id)
WHERE user_id IN (SELECT old_id FROM id_mappings);

-- Update clip_likes table
UPDATE clip_likes 
SET user_id = (SELECT new_id FROM id_mappings WHERE old_id = clip_likes.user_id)
WHERE user_id IN (SELECT old_id FROM id_mappings);

-- Update stream_viewers table
UPDATE stream_viewers 
SET user_id = (SELECT new_id FROM id_mappings WHERE old_id = stream_viewers.user_id)
WHERE user_id IN (SELECT old_id FROM id_mappings);