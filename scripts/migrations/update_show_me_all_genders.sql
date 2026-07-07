-- Run on production to let existing users see male, female, and non-binary in Discover.
UPDATE preferences
SET show_me = '["male", "female", "non_binary"]',
    updated_at = NOW();

-- Let demo male profiles appear to male viewers (mutual interest).
UPDATE profiles
SET interested_in = '["male", "female", "non_binary"]',
    updated_at = NOW()
WHERE user_id IN ('user-006', 'user-008', 'user-010');
