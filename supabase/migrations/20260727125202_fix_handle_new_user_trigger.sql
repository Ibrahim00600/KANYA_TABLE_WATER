/*
# Fix handle_new_user trigger — add error safety

Makes the trigger resilient so any failure during profile creation
does not block user authentication.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, full_name, phone, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'phone', ''),
      COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't block auth
    RAISE WARNING 'handle_new_user error: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
