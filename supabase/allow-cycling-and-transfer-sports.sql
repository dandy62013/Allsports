-- Keeps the forum's sport categories aligned with the bots and forumStructure in foro/index.html.
-- Applied to the Supabase project via migration allow_cycling_and_transfer_sports.
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_sport_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_sport_check
  CHECK (sport = ANY (ARRAY[
    'Fútbol'::text,
    'Baloncesto'::text,
    'Tenis'::text,
    'Motor'::text,
    'Ciclismo'::text,
    'Mercado de fichajes'::text,
    'Otros'::text,
    'Mundial'::text,
    'Juegos Olímpicos'::text,
    'Comunidad'::text
  ]));
