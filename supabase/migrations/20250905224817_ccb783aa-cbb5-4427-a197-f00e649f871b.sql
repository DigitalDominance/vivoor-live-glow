-- Enable pgcrypto extension for secure random token generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Test that gen_random_bytes now works
SELECT encode(gen_random_bytes(32), 'hex') as test_token;