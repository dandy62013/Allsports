-- ALLSPORTS: permisos seguros para borrar hilos y mensajes.
-- Antes de ejecutar: sustituye el UUID de abajo por el ID de TU cuenta,
-- visible en Supabase > Authentication > Users. No uses el correo.
create table if not exists public.forum_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.forum_admins enable row level security;

drop policy if exists "forum_admins_read_own" on public.forum_admins;
create policy "forum_admins_read_own"
on public.forum_admins for select
to authenticated
using (user_id = auth.uid());

-- Añade aquí únicamente tu UUID. Esta inserción se ejecuta desde SQL Editor,
-- no desde la web, por lo que los usuarios normales no pueden hacerse admins.
insert into public.forum_admins (user_id)
values ('REEMPLAZA-ESTE-TEXTO-POR-TU-UUID')
on conflict (user_id) do nothing;

drop policy if exists "posts_delete_owner_or_admin" on public.posts;
create policy "posts_delete_owner_or_admin"
on public.posts for delete
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.forum_admins a
    where a.user_id = auth.uid()
  )
);

drop policy if exists "replies_delete_owner_or_admin" on public.replies;
create policy "replies_delete_owner_or_admin"
on public.replies for delete
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.forum_admins a
    where a.user_id = auth.uid()
  )
);
