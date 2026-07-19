// Auto-unlock exact DP frame by VIP level (1..100).
export type LevelFrame = {
  level: number;
  series: string;
  url: string;
};

const A = (path: string) =>
  `https://project--269a4b2a-bb70-44e1-bd04-6acc825e6f84.lovable.app${path}`;

export const LEVEL_FRAMES: LevelFrame[] = [
  { level: 1, series: "Celestial", url: A("/__l5e/assets-v1/84f57c2f-871f-4a3a-88c3-b8890d17321e/celestial-lv1.png") },
  { level: 2, series: "Celestial", url: A("/__l5e/assets-v1/3946d93d-9eeb-46e4-80f2-d16fdf9a7fb3/celestial-lv2.png") },
  { level: 3, series: "Celestial", url: A("/__l5e/assets-v1/d71eb954-8858-48b1-b1ce-798d28f1a139/celestial-lv3.png") },
  { level: 4, series: "Celestial", url: A("/__l5e/assets-v1/189de10c-ad81-4f2d-9bb1-89e3dd340b88/celestial-lv4.png") },
  { level: 5, series: "Celestial", url: A("/__l5e/assets-v1/01d8bdb7-f09d-4317-8c12-ea77b73e5168/celestial-lv5.png") },
  { level: 6, series: "Celestial", url: A("/__l5e/assets-v1/99d93fde-864b-4bc2-aeca-0896f4f6f426/celestial-lv6.png") },
  { level: 7, series: "Celestial", url: A("/__l5e/assets-v1/f858f3b5-53d5-4069-a116-f1ebd1137aa8/celestial-lv7.png") },
  { level: 8, series: "Celestial", url: A("/__l5e/assets-v1/a4173b8b-fc01-43a2-acb7-fb81e95a16c9/celestial-lv8.png") },
  { level: 9, series: "Celestial", url: A("/__l5e/assets-v1/5bfc93ee-470a-4efb-b6f9-75bc7f8af405/celestial-lv9.png") },
  { level: 10, series: "Celestial", url: A("/__l5e/assets-v1/c46445dc-577a-46a4-949d-be3068d1c941/celestial-lv10.png") },
  { level: 11, series: "Dragon", url: A("/__l5e/assets-v1/c7bac5f7-9334-45f5-a57a-b508dc96a8e0/dragon-lv11.png") },
  { level: 12, series: "Dragon", url: A("/__l5e/assets-v1/c92e47b3-354f-4889-acd2-6dc8e84eca15/dragon-lv12.png") },
  { level: 13, series: "Dragon", url: A("/__l5e/assets-v1/544f1d0f-2edb-4103-9d01-38ca1e941798/dragon-lv13.png") },
  { level: 14, series: "Dragon", url: A("/__l5e/assets-v1/adb14094-a77f-41c8-9c40-41e67e7394f5/dragon-lv14.png") },
  { level: 15, series: "Dragon", url: A("/__l5e/assets-v1/ce46e93f-9787-4492-b5ed-2b9c44e322a7/dragon-lv15.png") },
  { level: 16, series: "Dragon", url: A("/__l5e/assets-v1/94a5ce65-190b-41c8-b59f-a4f7791e6976/dragon-lv16.png") },
  { level: 17, series: "Dragon", url: A("/__l5e/assets-v1/80d40934-d154-4935-8145-574943cd360d/dragon-lv17.png") },
  { level: 18, series: "Dragon", url: A("/__l5e/assets-v1/18e8224d-998e-44a1-8a10-1c005270794a/dragon-lv18.png") },
  { level: 19, series: "Dragon", url: A("/__l5e/assets-v1/089e120d-6879-414f-bf33-2244624fc347/dragon-lv19.png") },
  { level: 20, series: "Dragon", url: A("/__l5e/assets-v1/fd9e4d6c-8c42-450d-824f-61f2e074e23c/dragon-lv20.png") },
  { level: 21, series: "Phoenix", url: A("/__l5e/assets-v1/a5b5e2e2-a07a-4b65-bf20-ec827f947372/phoenix-lv21.png") },
  { level: 22, series: "Phoenix", url: A("/__l5e/assets-v1/855c12e1-5fb4-40c9-942a-7e0ccc9d5b84/phoenix-lv22.png") },
  { level: 23, series: "Phoenix", url: A("/__l5e/assets-v1/7c84b100-f77d-4bfd-a78f-766b4af4d265/phoenix-lv23.png") },
  { level: 24, series: "Phoenix", url: A("/__l5e/assets-v1/85b3cb0a-f38d-40c6-91aa-1b6b89c1c599/phoenix-lv24.png") },
  { level: 25, series: "Phoenix", url: A("/__l5e/assets-v1/436d8704-f9fc-4b76-a19d-16933081d871/phoenix-lv25.png") },
  { level: 26, series: "Phoenix", url: A("/__l5e/assets-v1/d5f00245-159f-4a8c-90fe-9454b420c2bf/phoenix-lv26.png") },
  { level: 27, series: "Phoenix", url: A("/__l5e/assets-v1/da954122-f21f-455f-b671-3c967b6b5d93/phoenix-lv27.png") },
  { level: 28, series: "Phoenix", url: A("/__l5e/assets-v1/9fd5abce-814f-40c2-acaa-0c648d723d31/phoenix-lv28.png") },
  { level: 29, series: "Phoenix", url: A("/__l5e/assets-v1/48a7d5cb-32df-40bc-9b7d-58f890cc9bf6/phoenix-lv29.png") },
  { level: 30, series: "Phoenix", url: A("/__l5e/assets-v1/eed7b217-60c9-4423-a4b0-40ec02c7e9f3/phoenix-lv30.png") },
  { level: 31, series: "Lion King", url: A("/__l5e/assets-v1/7afd344b-49fc-494f-aac1-f813492cf344/lion-lv31.png") },
  { level: 32, series: "Lion King", url: A("/__l5e/assets-v1/1ea7924e-33cd-4484-876c-4a84772c753e/lion-lv32.png") },
  { level: 33, series: "Lion King", url: A("/__l5e/assets-v1/06d41996-44dd-4cd6-8f71-e8c68ed4c39a/lion-lv33.png") },
  { level: 34, series: "Lion King", url: A("/__l5e/assets-v1/4ae61bc5-0aba-4b97-bf48-386d852b5368/lion-lv34.png") },
  { level: 35, series: "Lion King", url: A("/__l5e/assets-v1/e6f9d68d-a3c3-4c9e-95ef-04f15f549cfd/lion-lv35.png") },
  { level: 36, series: "Lion King", url: A("/__l5e/assets-v1/5cb77168-6b17-44e2-8fc5-c2c5042f6c07/lion-lv36.png") },
  { level: 37, series: "Lion King", url: A("/__l5e/assets-v1/3521a070-1720-4c39-9fa3-3843c647640e/lion-lv37.png") },
  { level: 38, series: "Lion King", url: A("/__l5e/assets-v1/99128b04-b810-48ac-81e5-85aa5b95c36b/lion-lv38.png") },
  { level: 39, series: "Lion King", url: A("/__l5e/assets-v1/8a38c9e3-52ef-4706-8e41-a2b01c69cec7/lion-lv39.png") },
  { level: 40, series: "Lion King", url: A("/__l5e/assets-v1/315055e1-3396-441e-b260-3daa3cace157/lion-lv40.png") },
  { level: 41, series: "Ocean King", url: A("/__l5e/assets-v1/4295ee66-21f0-439c-b6c8-986d8035b995/ocean-lv41.png") },
  { level: 42, series: "Ocean King", url: A("/__l5e/assets-v1/65f5f3e8-3252-4678-a240-f6c83e2bb311/ocean-lv42.png") },
  { level: 43, series: "Ocean King", url: A("/__l5e/assets-v1/6ca8d8f6-f8a0-4729-b86c-77158fe2bcfd/ocean-lv43.png") },
  { level: 44, series: "Ocean King", url: A("/__l5e/assets-v1/a5e4c20f-8327-4a26-b90d-58c5b9a125f8/ocean-lv44.png") },
  { level: 45, series: "Ocean King", url: A("/__l5e/assets-v1/dc7c984d-9427-427d-9039-e9a5042f30ad/ocean-lv45.png") },
  { level: 46, series: "Ocean King", url: A("/__l5e/assets-v1/6548ecc4-50e3-41fa-a48f-bc4055b3dddf/ocean-lv46.png") },
  { level: 47, series: "Ocean King", url: A("/__l5e/assets-v1/171acab3-3d44-4dc8-a8d7-609637fc637e/ocean-lv47.png") },
  { level: 48, series: "Ocean King", url: A("/__l5e/assets-v1/d004d805-1e0b-44bc-b9d8-f457729fb2f0/ocean-lv48.png") },
  { level: 49, series: "Ocean King", url: A("/__l5e/assets-v1/091c3c1a-5502-406a-bd03-e2955b9a4b1e/ocean-lv49.png") },
  { level: 50, series: "Ocean King", url: A("/__l5e/assets-v1/7af178d1-40ed-4d9f-8763-ca1adc693aa1/ocean-lv50.png") },
  { level: 51, series: "Galaxy", url: A("/__l5e/assets-v1/e16ab610-6cdd-4368-8815-46af3f32a715/galaxy-lv51.png") },
  { level: 52, series: "Galaxy", url: A("/__l5e/assets-v1/fd2e0810-1f4e-4cee-92dd-42b7f8de6cca/galaxy-lv52.png") },
  { level: 53, series: "Galaxy", url: A("/__l5e/assets-v1/2eda63d9-ef58-4a7d-97a7-0d65bf3e6f04/galaxy-lv53.png") },
  { level: 54, series: "Galaxy", url: A("/__l5e/assets-v1/5ea2c297-21f8-43ab-9e06-bf5b6b92c8ce/galaxy-lv54.png") },
  { level: 55, series: "Galaxy", url: A("/__l5e/assets-v1/c003df35-a5c4-4d1b-8f37-8f44b3d7349f/galaxy-lv55.png") },
  { level: 56, series: "Galaxy", url: A("/__l5e/assets-v1/3251cc62-81b7-40ca-9cd0-1ae4618b16cf/galaxy-lv56.png") },
  { level: 57, series: "Galaxy", url: A("/__l5e/assets-v1/a1c56474-5f1f-400c-9076-c0226d2c5c84/galaxy-lv57.png") },
  { level: 58, series: "Galaxy", url: A("/__l5e/assets-v1/85ab6363-9096-4821-8d9f-b211f689ba42/galaxy-lv58.png") },
  { level: 59, series: "Galaxy", url: A("/__l5e/assets-v1/eb46e920-7eae-429f-a170-4e485e07555e/galaxy-lv59.png") },
  { level: 60, series: "Galaxy", url: A("/__l5e/assets-v1/7c084016-33ec-4412-96c1-a46c0f5ca240/galaxy-lv60.png") },
  { level: 61, series: "Diamond Emperor", url: A("/__l5e/assets-v1/e22581b3-8a26-4f1c-a29b-83f34260acc7/diamond-lv61.png") },
  { level: 62, series: "Diamond Emperor", url: A("/__l5e/assets-v1/408303c6-0be0-4841-bb7b-66ae26cf561e/diamond-lv62.png") },
  { level: 63, series: "Diamond Emperor", url: A("/__l5e/assets-v1/d5f596b8-96c2-4fb9-9250-56f0131ca5c8/diamond-lv63.png") },
  { level: 64, series: "Diamond Emperor", url: A("/__l5e/assets-v1/b5726afc-e55e-406b-8377-b27166ea82bf/diamond-lv64.png") },
  { level: 65, series: "Diamond Emperor", url: A("/__l5e/assets-v1/169e820c-9e73-48a5-980e-677371bfce02/diamond-lv65.png") },
  { level: 66, series: "Diamond Emperor", url: A("/__l5e/assets-v1/dded69df-3b83-4119-a594-fcb0d5cd3488/diamond-lv66.png") },
  { level: 67, series: "Diamond Emperor", url: A("/__l5e/assets-v1/ef25f0ed-91eb-4efa-a37c-8980764ffeaa/diamond-lv67.png") },
  { level: 68, series: "Diamond Emperor", url: A("/__l5e/assets-v1/d9574cce-c798-4825-bf6b-b0c1d03b8077/diamond-lv68.png") },
  { level: 69, series: "Diamond Emperor", url: A("/__l5e/assets-v1/575932ed-cb05-4f54-a2b6-4e5c881cf614/diamond-lv69.png") },
  { level: 70, series: "Diamond Emperor", url: A("/__l5e/assets-v1/c5e4d010-18d5-4e32-b4a3-a228e4ab5e59/diamond-lv70.png") },
  { level: 71, series: "Royal Palace", url: A("/__l5e/assets-v1/64310e7b-953d-49e8-9673-c6d9490f2d30/palace-lv71.png") },
  { level: 72, series: "Royal Palace", url: A("/__l5e/assets-v1/7fe36f93-f73f-45aa-90ab-37fa7045fda2/palace-lv72.png") },
  { level: 73, series: "Royal Palace", url: A("/__l5e/assets-v1/2d7c2d55-6b5b-416d-8d2b-f635bb9bca24/palace-lv73.png") },
  { level: 74, series: "Royal Palace", url: A("/__l5e/assets-v1/217cb6e1-f479-4c0e-ae1f-07a6a083409c/palace-lv74.png") },
  { level: 75, series: "Royal Palace", url: A("/__l5e/assets-v1/228fd821-722c-40e2-b0e0-fe0e555f39ff/palace-lv75.png") },
  { level: 76, series: "Royal Palace", url: A("/__l5e/assets-v1/ee895b60-2f44-4369-bcfe-a6f40b77f29d/palace-lv76.png") },
  { level: 77, series: "Royal Palace", url: A("/__l5e/assets-v1/a02a79f6-c0b0-4434-8f36-318276b89a07/palace-lv77.png") },
  { level: 78, series: "Royal Palace", url: A("/__l5e/assets-v1/2c43eb10-aa66-47a8-8a3c-79b8f30ac35a/palace-lv78.png") },
  { level: 79, series: "Royal Palace", url: A("/__l5e/assets-v1/e6d8349f-e2bc-4340-9a5d-1185a413af88/palace-lv79.png") },
  { level: 80, series: "Royal Palace", url: A("/__l5e/assets-v1/e914d741-3029-4ad5-9819-bee766aade2e/palace-lv80.png") },
  { level: 81, series: "Legend King", url: A("/__l5e/assets-v1/4c25eeeb-5015-44de-a65b-a6b33958f82e/legend-lv81.png") },
  { level: 82, series: "Legend King", url: A("/__l5e/assets-v1/ac816cac-8877-4f97-a2a3-a88f7684bcbc/legend-lv82.png") },
  { level: 83, series: "Legend King", url: A("/__l5e/assets-v1/6e80104c-e5ae-416a-ae0a-7fcbb266eb7f/legend-lv83.png") },
  { level: 84, series: "Legend King", url: A("/__l5e/assets-v1/ee97cca9-aab0-42c1-acf1-bb2ee790c449/legend-lv84.png") },
  { level: 85, series: "Legend King", url: A("/__l5e/assets-v1/63b3d32e-0f08-40e7-a1e5-68279218d90f/legend-lv85.png") },
  { level: 86, series: "Legend King", url: A("/__l5e/assets-v1/8f225960-0ed4-4f5f-8d54-6122a5dab638/legend-lv86.png") },
  { level: 87, series: "Legend King", url: A("/__l5e/assets-v1/7378d6c4-68f8-4165-8799-3e1964395243/legend-lv87.png") },
  { level: 88, series: "Legend King", url: A("/__l5e/assets-v1/eca4ff06-b5ca-446a-b189-18374b0231a0/legend-lv88.png") },
  { level: 89, series: "Legend King", url: A("/__l5e/assets-v1/f56ecec7-8fad-4240-a34e-305996350cb4/legend-lv89.png") },
  { level: 90, series: "Legend King", url: A("/__l5e/assets-v1/d904b9d8-e8b5-4940-9d11-d37a06c87b9e/legend-lv90.png") },
  { level: 91, series: "CEO Emperor", url: A("/__l5e/assets-v1/1d519d17-9f57-4e84-ad18-ee32034f9c9c/ceo-lv91.png") },
  { level: 92, series: "CEO Emperor", url: A("/__l5e/assets-v1/7205f865-c05d-43e3-82ff-22bc22210e35/ceo-lv92.png") },
  { level: 93, series: "CEO Emperor", url: A("/__l5e/assets-v1/1b384e6e-1289-45dc-aa21-a324b7496485/ceo-lv93.png") },
  { level: 94, series: "CEO Emperor", url: A("/__l5e/assets-v1/505fa73b-20a0-41c8-9995-a58470ca4bb6/ceo-lv94.png") },
  { level: 95, series: "CEO Emperor", url: A("/__l5e/assets-v1/a3318543-5f77-445e-ab76-6292b211a06e/ceo-lv95.png") },
  { level: 96, series: "CEO Emperor", url: A("/__l5e/assets-v1/36482069-79a6-4828-baf8-0c3c1fca16a4/ceo-lv96.png") },
  { level: 97, series: "CEO Emperor", url: A("/__l5e/assets-v1/ec03a924-c5fe-45e6-b719-a92b165c200b/ceo-lv97.png") },
  { level: 98, series: "CEO Emperor", url: A("/__l5e/assets-v1/099834b4-5a61-41b5-8444-b48016b39df0/ceo-lv98.png") },
  { level: 99, series: "CEO Emperor", url: A("/__l5e/assets-v1/bb639f1a-cc1b-4808-8db4-dc0503904a0c/ceo-lv99.png") },
  { level: 100, series: "CEO Emperor", url: A("/__l5e/assets-v1/8591d753-e3be-4af6-876c-2292fde6b367/ceo-lv100.png") },
];

export function frameForLevel(level: number | null | undefined): string | null {
  const raw = Math.floor(level ?? 0);
  if (raw < 1) return null;
  const lvl = Math.min(100, raw);
  return LEVEL_FRAMES.find((item) => item.level === lvl)?.url ?? null;
}

export function seriesForLevel(level: number | null | undefined): string | null {
  const raw = Math.floor(level ?? 0);
  if (raw < 1) return null;
  const lvl = Math.min(100, raw);
  return LEVEL_FRAMES.find((item) => item.level === lvl)?.series ?? null;
}

/**
 * Returns every frame from the start of the current 10-level series up to
 * (and including) the user's current level. When the user crosses into a
 * new series (e.g. 10 → 11) the previous series' frames drop off and the
 * new series starts stacking from a single frame again.
 */
export function framesForLevelStack(level: number | null | undefined): LevelFrame[] {
  const raw = Math.floor(level ?? 0);
  if (raw < 1) return [];
  const lvl = Math.min(100, raw);
  const seriesStart = Math.floor((lvl - 1) / 10) * 10 + 1;
  return LEVEL_FRAMES.filter((item) => item.level >= seriesStart && item.level <= lvl);
}
