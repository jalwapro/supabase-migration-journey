-- 0274: fix gift chromakey mismatches (detected from real frame analysis)
-- + let admins see hidden emojis + allow unicode-only emojis

-- luma: 14 gifts
update public.gifts set chromakey = 'luma' where id in ('25764fd0-756f-486b-ba23-d2ae1978bda7','82978bba-b3da-46da-bffe-b7af63b8827d','dd4ba184-edc6-49cc-974a-e1e71c0e92b3','594523e7-212d-4d10-ab5c-9276e1571021','5cf82286-5c6c-471b-831f-dbcfff1ea5df','04969032-cff0-46d5-8b57-b696f4a9643e','be099d40-9b8e-4bcd-8132-115eb7a096bc','6d53f933-71b2-4cc2-a2eb-a578b2581818','dca905c2-466f-4b7c-9dba-3a303ac81652','39dafd26-7374-4063-a4e1-c688d6f803af','94a87ec7-57c3-4788-b201-cca4813ca9fa','b463cae9-b0be-4762-9357-9e482ae2a8b4','c2b3ee03-ecb9-4377-a076-bd13afcd210b','732e3a77-d341-49f2-a192-daa63d3c9d5d');

-- green: 16 gifts
update public.gifts set chromakey = 'green' where id in ('a981f91b-7668-4e97-b0bc-6b62e4a49938','01c7015b-1df8-417e-bd90-39d0ce7faee0','1ed66cbc-8b72-4ee3-b490-3f5ccfd356e2','15ca35cd-40a7-4e71-be7b-6568804b7674','4c29e02d-be1a-4748-8ebb-cdad32361a2e','e2780e31-ef07-43a9-9ff9-a4b54e9d72e4','35d2af1a-b3bc-4403-a943-9426c387491d','fe76db8c-19e0-4c52-a160-d5abed3335a0','1e176247-93cb-4cd8-83d5-a27d65e1cf36','c6781d90-31c1-4438-9215-3a4a2d8c1c0a','5da1f1cc-56c9-4290-af43-792f1c6e9029','7b3156ba-ab61-4cd1-a908-2c7ba61296d3','f66193d3-14a3-40cd-a67f-2fd202315561','89bb40a1-688f-48db-b9d6-a89a1158fb60','1bc35568-6407-4e45-abf2-1687bf779247','c286c6e6-c475-4bac-be86-bf6632448ee5');

-- none: 22 gifts
update public.gifts set chromakey = 'none' where id in ('a75dd354-d499-48db-8b83-0b6adbc38cb6','6dfe5263-8946-41e1-a2b9-4af0fb88001c','406d40c8-de1f-46f9-9a23-cacdba102986','b8bbc99e-5b87-4c20-a665-e11b30919b34','692f19b8-ef53-43cc-a783-e33aa0080af2','158a1f7c-3822-444e-83db-4fddff68510c','28cfd5a4-2811-4223-b551-9b770218d03e','3b963aa9-c559-43ac-b226-e01d607d4e5f','949a46fb-0c92-490c-a8b7-e6615fa234b6','c32f697e-8f10-442a-9a7f-994530534c5a','fa2a3a5c-8318-4311-9eed-7792033349d5','38233323-db57-473e-bf49-566ca9bd57d1','d10b8420-f49a-4e18-aaaa-867f788f6bf9','f19b20dc-4591-4060-9ce5-a2180ad767bf','6cf62f39-a17b-4a52-9467-135acbf1e1c2','8ef86593-fc0f-48ff-9f55-a989f72ef279','712c128f-bcd2-4d8b-9f3d-968a6a691b06','33ccb77c-b38e-4cbe-a188-357787bcf170','144583a3-cad2-4553-9d22-38fa537f141b','6247274f-c009-46f8-92ff-a051e413867e','d83f504b-3be3-4064-8a3b-8252f4d0928e','68c418dd-8307-46f6-953c-938f559a260d');

-- Admins must see deactivated emojis, otherwise hidden rows vanish from the panel.
drop policy if exists "chat_emojis read" on public.chat_emojis;
create policy "chat_emojis read" on public.chat_emojis
  for select to anon, authenticated
  using (is_active or is_admin(auth.uid()));

-- Unicode-only emojis need no uploaded asset.
alter table public.chat_emojis alter column clip_path set default '';
