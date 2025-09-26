-- Sjekk entries med status 'sendt' men uten tripletex_synced_at
SELECT 
  id,
  status,
  tripletex_synced_at,
  tripletex_entry_id,
  timer,
  created_at
FROM vakt_timer 
WHERE status = 'sendt' 
  AND tripletex_synced_at IS NULL;

-- Oppdater inkonsistente entries tilbake til 'utkast' status
-- (Kjør bare hvis du finner inkonsistente entries over)
-- UPDATE vakt_timer 
-- SET status = 'utkast', 
--     tripletex_entry_id = NULL,
--     sync_error = 'Inkonsistent status - tilbakestilt til utkast'
-- WHERE status = 'sendt' 
--   AND tripletex_synced_at IS NULL;
