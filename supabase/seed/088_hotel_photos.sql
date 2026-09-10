-- Seed, 2026-09-10: real photographs of the actual properties.
--
-- Every tier card was showing the same stock Nice street scene, so Explorer and Classic were
-- literally identical pictures of somewhere neither hotel is. LiteAPI carries the properties' own
-- photography — 89 frames for the Monsigny, 74 for the Petit Palais, 183 for Le Méridien — and we
-- were storing two or three of them at most.
--
-- Ten each now (three for the Beausoleil apartment, which is all its owner uploaded), served as a
-- carousel. These are the supplier's hosted images on static.cupid.travel rather than files in our
-- repo: they are the property's own current photography, they change when the property changes
-- them, and next.config.ts has to allow the host for next/image to serve them.
--
-- Honesty note, unchanged: these are the properties each tier is PRICED AGAINST, and none is
-- contracted. The card says so under the pictures.

update public.hotels set image_urls = array[
    'https://static.cupid.travel/hotels/ex_e2b68c01_z.jpg',
    'https://static.cupid.travel/hotels/ex_202a5d52_z.jpg',
    'https://static.cupid.travel/hotels/ex_913b1ff3_z.jpg',
    'https://static.cupid.travel/hotels/ex_f33122eb_z.jpg',
    'https://static.cupid.travel/hotels/ex_89387993_z.jpg',
    'https://static.cupid.travel/hotels/ex_8607e96d_z.jpg',
    'https://static.cupid.travel/hotels/ex_1525d8eb_z.jpg',
    'https://static.cupid.travel/hotels/ex_138725cb_z.jpg',
    'https://static.cupid.travel/hotels/ex_9735afa7_z.jpg',
    'https://static.cupid.travel/hotels/ex_3f442443_z.jpg'
  ] where id = '40000000-0000-4000-8000-000000000001';  -- Hôtel & Appartements Monsigny
update public.hotels set image_urls = array[
    'https://static.cupid.travel/hotels/363486298.jpg',
    'https://static.cupid.travel/hotels/530008600.jpg',
    'https://static.cupid.travel/hotels/530009485.jpg',
    'https://static.cupid.travel/hotels/363485572.jpg',
    'https://static.cupid.travel/hotels/363484261.jpg',
    'https://static.cupid.travel/hotels/363484675.jpg',
    'https://static.cupid.travel/hotels/363484731.jpg',
    'https://static.cupid.travel/hotels/363485733.jpg',
    'https://static.cupid.travel/hotels/363484453.jpg',
    'https://static.cupid.travel/hotels/363485695.jpg'
  ] where id = '40000000-0000-4000-8000-000000000002';  -- Hôtel Petit Palais
update public.hotels set image_urls = array[
    'https://static.cupid.travel/hotels/135980443.jpg',
    'https://static.cupid.travel/hotels/hd/135979988.jpg',
    'https://static.cupid.travel/hotels/hd/135979605.jpg',
    'https://static.cupid.travel/hotels/hd/135979354.jpg',
    'https://static.cupid.travel/hotels/hd/135978850.jpg',
    'https://static.cupid.travel/hotels/hd/135978591.jpg',
    'https://static.cupid.travel/hotels/135978246.jpg',
    'https://static.cupid.travel/hotels/hd/135978032.jpg',
    'https://static.cupid.travel/hotels/hd/135977859.jpg',
    'https://static.cupid.travel/hotels/hd/135977768.jpg'
  ] where id = '40000000-0000-4000-8000-000000000003';  -- Studio La Florentina
update public.hotels set image_urls = array[
    'https://static.cupid.travel/hotels/426587837.jpg',
    'https://static.cupid.travel/hotels/489519146.jpg',
    'https://static.cupid.travel/hotels/601955847.jpg',
    'https://static.cupid.travel/hotels/483158853.jpg',
    'https://static.cupid.travel/hotels/597153460.jpg',
    'https://static.cupid.travel/hotels/597153396.jpg',
    'https://static.cupid.travel/hotels/483158736.jpg',
    'https://static.cupid.travel/hotels/483158782.jpg',
    'https://static.cupid.travel/hotels/597153419.jpg',
    'https://static.cupid.travel/hotels/481006498.jpg'
  ] where id = '40000000-0000-4000-8000-000000000004';  -- Le Méridien Beach Plaza
update public.hotels set image_urls = array[
    'https://static.cupid.travel/hotels/463637848.jpg',
    'https://static.cupid.travel/hotels/hd/463638236.jpg',
    'https://static.cupid.travel/hotels/hd/334616236.jpg'
  ] where id = '40000000-0000-4000-8000-000000000005';  -- La Riviere du les jarden de Elisa
