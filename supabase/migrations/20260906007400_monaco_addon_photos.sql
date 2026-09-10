-- 0074_monaco_addon_photos
--
-- "Also all should have the same layout with photos." The layout was already shared — every
-- option renders through the same card — but two of the nine Monaco add-ons had no photograph at
-- all, so they fell back to a bare card next to ones with imagery, and three of the yacht options
-- carried the identical lead image, which made three different products read as one repeated.
--
-- Chosen from the existing library in apps/web/public/photos rather than sourced: the airport
-- transfer gets the promenade at dusk (the drive in), the terrace gets the harbour rock and the
-- circuit signage, and the three yacht days each lead with a different frame so a traveler
-- scanning the day plan can tell them apart. The two night events had the same harbour shot and
-- now differ.
update public.departure_add_ons
   set image_urls = array['/photos/nice-promenade-dusk.jpg']
 where title = 'Private airport transfer' and coalesce(array_length(image_urls,1),0) = 0;

update public.departure_add_ons
   set image_urls = array['/photos/monaco-harbour-rock.jpg','/photos/monaco-circuit-signage.jpg']
 where title = 'Terrace with lunch (Sat + Sun)';

update public.departure_add_ons
   set image_urls = array['/photos/monaco-yacht-deck-view.jpg','/photos/monaco-harbour-yachts.jpg']
 where title = 'Amber Lounge yacht, qualifying day';
update public.departure_add_ons
   set image_urls = array['/photos/monaco-harbour-yachts.jpg','/photos/monaco-yacht-deck-view.jpg']
 where title = 'Amber Lounge yacht, both days';
update public.departure_add_ons
   set image_urls = array['/photos/monaco-hairpin-race.jpg','/photos/monaco-yacht-deck-view.jpg']
 where title = 'Amber Lounge yacht, race day';

update public.departure_add_ons
   set image_urls = array['/photos/monaco-casino-night.jpg']
 where title = 'Friday night on the water';
update public.departure_add_ons
   set image_urls = array['/photos/monaco-night-sea.jpg']
 where title = 'Sunday night after the flag';
