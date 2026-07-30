-- Widen storage MIME allowlists so admins can upload every shop asset type:
-- entrance sounds (audio), Lottie/SVGA JSON, AVIF/APNG art, and QuickTime clips.

UPDATE storage.buckets
   SET allowed_mime_types = ARRAY[
        'image/png','image/jpeg','image/webp','image/gif','image/svg+xml','image/avif','image/apng',
        'video/mp4','video/webm','video/quicktime',
        'audio/mpeg','audio/mp4','audio/ogg','audio/wav','audio/webm',
        'application/json','text/plain','application/octet-stream'
       ],
       file_size_limit = 78643200
 WHERE id IN ('shop-assets','ads','banners','splash','splash-assets','vip-assets','room-bg');
