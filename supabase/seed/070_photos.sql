-- Seed: photography for the two tours and four destinations. Files live in apps/web/public/photos
-- (built by scripts/build-web-photos.mjs from Kyle's library); URLs are site-relative so the same
-- rows work on every environment. Admin can replace any of them from the tour version screen.

update public.tour_versions
set hero_image_url = '/photos/nice-promenade-dusk.jpg',
    gallery_image_urls = array[
      '/photos/nice-place-massena.jpg',
      '/photos/nice-cours-saleya-flowers.jpg',
      '/photos/nice-beach-castle-hill.jpg',
      '/photos/nice-old-town-evening.jpg',
      '/photos/chateauneuf-vineyard-road.jpg',
      '/photos/chateauneuf-cellar-barrels.jpg',
      '/photos/avignon-cloitre-saint-louis.jpg',
      '/photos/paris-seine-quay.jpg',
      '/photos/paris-covered-passage.jpg',
      '/photos/paris-seine-night.jpg'
    ]
where id = '21000000-0000-4000-8000-000000000001'
  and (hero_image_url is null or hero_image_url like '/photos/%');

update public.tour_versions
set hero_image_url = '/photos/monaco-hairpin-race.jpg',
    gallery_image_urls = array[
      '/photos/monaco-harbour-rock.jpg',
      '/photos/monaco-trackside-barriers.jpg',
      '/photos/monaco-yacht-deck-view.jpg',
      '/photos/monaco-casino-square.jpg',
      '/photos/monaco-harbour-yachts.jpg',
      '/photos/monaco-larvotto-beach.jpg',
      '/photos/monaco-circuit-signage.jpg',
      '/photos/monaco-casino-night.jpg',
      '/photos/nice-promenade-dusk.jpg',
      '/photos/monaco-night-sea.jpg'
    ]
where id = '21000000-0000-4000-8000-000000000002'
  and (hero_image_url is null or hero_image_url like '/photos/%');

update public.destinations set hero_image_url = '/photos/nice-place-massena.jpg'
where slug = 'nice' and (hero_image_url is null or hero_image_url like '/photos/%');
update public.destinations set hero_image_url = '/photos/avignon-cloitre-saint-louis.jpg'
where slug = 'avignon' and (hero_image_url is null or hero_image_url like '/photos/%');
update public.destinations set hero_image_url = '/photos/paris-seine-quay.jpg'
where slug = 'paris' and (hero_image_url is null or hero_image_url like '/photos/%');
update public.destinations set hero_image_url = '/photos/monaco-harbour-rock.jpg'
where slug = 'monaco' and (hero_image_url is null or hero_image_url like '/photos/%');
