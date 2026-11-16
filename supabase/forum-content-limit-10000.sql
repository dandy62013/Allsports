-- ALLSPORTS: ampliar el contenido de publicaciones y respuestas a 10.000 caracteres.
-- Ejecutar una sola vez en Supabase > SQL Editor.
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conrelid::regclass AS tbl, conname
    FROM pg_constraint
    WHERE contype = 'c'
      AND conrelid IN ('public.posts'::regclass, 'public.replies'::regclass)
      AND pg_get_constraintdef(oid) ILIKE '%content%'
      AND pg_get_constraintdef(oid) ILIKE '%1000%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
  END LOOP;
END $$;

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_content_max_10000,
  ADD CONSTRAINT posts_content_max_10000 CHECK (char_length(content) <= 10000);

ALTER TABLE public.replies
  DROP CONSTRAINT IF EXISTS replies_content_max_10000,
  ADD CONSTRAINT replies_content_max_10000 CHECK (char_length(content) <= 10000);
