-- Security hardening: fix "Function Search Path Mutable" warning for SECURITY DEFINER function.
-- Run this against an existing Supabase database to apply the fix in-place.
-- Ref: https://supabase.com/docs/guides/database/database-linting#function-search-path-mutable

alter function public.handle_new_user() set search_path = public, pg_temp;


