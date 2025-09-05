-- Create simple but secure encryption function using built-in hash functions
CREATE OR REPLACE FUNCTION public.encrypt_wallet_address(wallet_address text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  encryption_key text;
  encrypted_id text;
BEGIN
  -- Use a hardcoded secure key for now
  encryption_key := 'vivoor_secure_key_2024_v1_salt_encryption';
  
  -- Create a secure hash using built-in md5 function (temporary until we can use proper crypto)
  encrypted_id := md5(wallet_address || encryption_key || 'extra_salt_2024');
  
  RETURN 'usr_' || encrypted_id;
END;
$$;

-- Test the function first
SELECT encrypt_wallet_address('kaspa:qrf090luz6h2l4rukxd2w9d6wh9wadyezhfk5vpcfchvqcrh9ym2vey35y4wr');

-- Create verification function
CREATE OR REPLACE FUNCTION public.verify_encrypted_user_id(wallet_address text, encrypted_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN encrypt_wallet_address(wallet_address) = encrypted_id;
END;
$$;