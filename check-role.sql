-- Check role for kwalberg@me.com
SELECT 
  p.id,
  p.user_id,
  p.display_name,
  p.role,
  p.org_id,
  o.name as org_name
FROM profiles p
LEFT JOIN org o ON o.id = p.org_id
WHERE p.user_id IN (
  SELECT id FROM auth.users WHERE email = 'kwalberg@me.com'
);

-- If you want to update to admin:
-- UPDATE profiles 
-- SET role = 'admin' 
-- WHERE user_id IN (
--   SELECT id FROM auth.users WHERE email = 'kwalberg@me.com'
-- );

