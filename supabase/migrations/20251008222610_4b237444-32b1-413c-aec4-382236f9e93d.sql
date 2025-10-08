-- Add txid column to chat_messages table for on-chain message tracking
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS txid TEXT;

-- Create index for faster txid lookups
CREATE INDEX IF NOT EXISTS idx_chat_messages_txid ON public.chat_messages(txid);

-- Add unique constraint to prevent duplicate messages from same transaction
ALTER TABLE public.chat_messages 
ADD CONSTRAINT unique_chat_txid UNIQUE (txid);