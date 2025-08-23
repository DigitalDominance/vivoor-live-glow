-- Update existing streams to extract livepeer_stream_id from playback_url where possible
-- Playback URLs have format: https://livepeercdn.com/hls/{stream_id}/index.m3u8
UPDATE streams 
SET livepeer_stream_id = (
  CASE 
    WHEN playback_url ~ 'livepeercdn\.com/hls/([^/]+)/' 
    THEN (regexp_match(playback_url, 'livepeercdn\.com/hls/([^/]+)/'))[1]
    ELSE NULL
  END
)
WHERE livepeer_stream_id IS NULL 
AND playback_url IS NOT NULL 
AND playback_url LIKE '%livepeercdn.com/hls/%';