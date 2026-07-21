-- Проверка дубликатов в found_slots
SELECT 
  user_id, 
  warehouse_id, 
  date, 
  time_slot, 
  is_booked,
  COUNT(*) as count
FROM found_slots
GROUP BY user_id, warehouse_id, date, time_slot, is_booked
HAVING COUNT(*) > 1;

