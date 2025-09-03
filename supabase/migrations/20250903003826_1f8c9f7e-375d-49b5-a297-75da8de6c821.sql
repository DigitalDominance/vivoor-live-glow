-- Fix the Security Definer View issue by removing the problematic view
-- The public_profiles view is causing the security definer view error

-- Drop the public_profiles view that's causing the security issue
DROP VIEW IF EXISTS public.public_profiles;

-- The view functionality can be replaced by the secure functions we already created
-- Users should use get_public_profile_data() function instead