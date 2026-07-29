-- Update profiles table check constraint to include 'operator' role
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('super_admin','manager','sales_officer','delivery','operator','customer'));
