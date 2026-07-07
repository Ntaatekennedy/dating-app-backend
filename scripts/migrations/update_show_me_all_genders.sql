-- Run on production to let existing users see male, female, and non-binary in Discover.
UPDATE preferences
SET show_me = '["male", "female", "non_binary"]',
    updated_at = NOW();

-- Let all demo profiles appear across genders (mutual interest).
UPDATE profiles
SET interested_in = '["male", "female", "non_binary"]',
    updated_at = NOW();
