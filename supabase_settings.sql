-- Create a table for user settings
create table if not exists user_settings (
  user_id uuid references auth.users not null primary key,
  working_start int default 9,
  working_end int default 18,
  is_night_hidden boolean default false,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS
alter table user_settings enable row level security;

-- Policies
create policy "Users can view own settings" 
  on user_settings for select 
  using (auth.uid() = user_id);

create policy "Users can insert own settings" 
  on user_settings for insert 
  with check (auth.uid() = user_id);

create policy "Users can update own settings" 
  on user_settings for update 
  using (auth.uid() = user_id);

-- Optional: Function to handle new user setup (if you want default settings on signup)
-- For now, the App will handle upserting settings on first login.
