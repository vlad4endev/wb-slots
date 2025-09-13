-- Add chosen_supply_id field to tasks table
ALTER TABLE tasks ADD COLUMN chosen_supply_id VARCHAR(255);

-- Add comment for the new field
COMMENT ON COLUMN tasks.chosen_supply_id IS 'ID of the chosen supply for auto-booking';

-- Create index for better performance when querying by chosen supply
CREATE INDEX IF NOT EXISTS idx_tasks_chosen_supply_id ON tasks(chosen_supply_id);
