-- Add sound_url column and populate for Collection 2 (Luxury Vehicles)
ALTER TABLE public.gifts ADD COLUMN IF NOT EXISTS sound_url text;

UPDATE public.gifts SET sound_url = '/__l5e/assets-v1/b408ae1b-ac87-4af4-b781-27bbdaf40f2b/c2_01_bugatti.mp3'      WHERE sort_order = 101;
UPDATE public.gifts SET sound_url = '/__l5e/assets-v1/203c8b6d-acf9-4996-a07f-177e34e78cc8/c2_02_rollsroyce.mp3'   WHERE sort_order = 102;
UPDATE public.gifts SET sound_url = '/__l5e/assets-v1/6229079e-b578-447c-8b54-146786b6d867/c2_03_mclaren.mp3'      WHERE sort_order = 103;
UPDATE public.gifts SET sound_url = '/__l5e/assets-v1/15680b27-965e-448c-a6bc-a64af86b1183/c2_04_gwagon.mp3'       WHERE sort_order = 104;
UPDATE public.gifts SET sound_url = '/__l5e/assets-v1/ce50de33-908f-48c7-b952-030727fc3569/c2_05_cybertruck.mp3'   WHERE sort_order = 105;
UPDATE public.gifts SET sound_url = '/__l5e/assets-v1/32f30bbb-bd3d-460b-9fa5-596f3b4af868/c2_06_ducati.mp3'       WHERE sort_order = 106;
UPDATE public.gifts SET sound_url = '/__l5e/assets-v1/4d225043-17f9-4b93-b95e-85935108ad18/c2_07_harley.mp3'       WHERE sort_order = 107;
UPDATE public.gifts SET sound_url = '/__l5e/assets-v1/743ce5c7-5f90-4b25-b347-3ca9f920f634/c2_08_f1.mp3'           WHERE sort_order = 108;
UPDATE public.gifts SET sound_url = '/__l5e/assets-v1/b86bbca0-198f-415e-aec4-67873e17b420/c2_09_monstertruck.mp3' WHERE sort_order = 109;
UPDATE public.gifts SET sound_url = '/__l5e/assets-v1/f36a4281-cb50-4a5e-b81e-7206edbde2d3/c2_10_policecar.mp3'    WHERE sort_order = 110;
