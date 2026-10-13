-- Use existing local gift art rather than non-existent CP-only paths.
-- Dedicated CP SVGA files are not present yet, so clear stale animation URLs instead of returning 404s.
update public.cp_exclusive_gifts_config
set icon_url = case id
  when 'cp_rose_bouquet' then '/gifts/basic-3d/rose.png'
  when 'cp_love_letter' then '/gifts/basic-3d/confession-letter.png'
  when 'cp_eternal_wings' then '/gifts/basic-3d/sweet-love.png'
  when 'cp_dream_castle' then '/gifts/basic-3d/crown.png'
  when 'cp_galaxy_carriage' then '/gifts/basic-3d/love-ring.png'
  else icon_url
end,
animation_url = null
where id in ('cp_rose_bouquet','cp_love_letter','cp_eternal_wings','cp_dream_castle','cp_galaxy_carriage');
