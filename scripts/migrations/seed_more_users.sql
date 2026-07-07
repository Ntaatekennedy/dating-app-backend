-- Run on an existing dating_app database to add 6 more demo users (v1.0.13).
-- Safe to skip if user-006 already exists.

USE dating_app;

INSERT IGNORE INTO users (id, email, phone, password_hash, is_verified, last_active_at) VALUES
    ('user-006', 'james@example.com', '+256700100007', 'password123', TRUE, NOW()),
    ('user-007', 'zara@example.com', '+256700100008', 'password123', TRUE, NOW()),
    ('user-008', 'daniel@example.com', '+256700100009', 'password123', TRUE, DATE_SUB(NOW(), INTERVAL 2 DAY)),
    ('user-009', 'lily@example.com', '+256700100010', 'password123', TRUE, DATE_SUB(NOW(), INTERVAL 5 MINUTE)),
    ('user-010', 'noah@example.com', '+256700100011', 'password123', TRUE, NOW()),
    ('user-011', 'chloe@example.com', '+256700100012', 'password123', TRUE, DATE_SUB(NOW(), INTERVAL 1 HOUR));

INSERT IGNORE INTO profiles (id, user_id, display_name, bio, date_of_birth, gender, interested_in,
    height_cm, job_title, education, latitude, longitude, city, country, relationship_type) VALUES
    ('profile-user-006', 'user-006', 'James',
     'Startup founder who loves live music and rooftop sunsets.',
     '1993-04-18', 'male', '["male", "female", "non_binary"]',
     178, 'Entrepreneur', 'MBA', 0.3476, 32.5825, 'Kampala', 'Uganda', 'long_term'),
    ('profile-user-007', 'user-007', 'Zara',
     'Nurse by day, dancer by night. Good vibes only.',
     '1996-12-02', 'female', '["male"]',
     165, 'Registered Nurse', 'BSc Nursing', 0.0564, 32.4637, 'Entebbe', 'Uganda', 'short_term'),
    ('profile-user-008', 'user-008', 'Daniel',
     'Cyclist, coffee nerd, and amateur chef.',
     '1991-08-25', 'male', '["male", "female", "non_binary"]',
     182, 'Product Manager', 'BSc Information Systems', 0.4244, 33.2042, 'Jinja', 'Uganda', 'making_friends'),
    ('profile-user-009', 'user-009', 'Lily',
     'Fashion stylist with a soft spot for vintage markets.',
     '2000-02-14', 'female', '["male"]',
     168, 'Fashion Stylist', 'Diploma Fashion Design', 0.3510, 32.5900, 'Kampala', 'Uganda', 'just_fun'),
    ('profile-user-010', 'user-010', 'Noah',
     'Personal trainer helping people crush their goals.',
     '1994-06-09', 'male', '["male", "female", "non_binary"]',
     185, 'Personal Trainer', 'Certified Fitness Coach', 0.3400, 32.5750, 'Kampala', 'Uganda', 'short_term'),
    ('profile-user-011', 'user-011', 'Chloe',
     'Teacher, book club host, and weekend brunch enthusiast.',
     '1997-10-21', 'female', '["male", "non_binary"]',
     172, 'High School Teacher', 'BA Education', -0.6100, 30.6580, 'Mbarara', 'Uganda', 'long_term');

INSERT IGNORE INTO photos (id, user_id, url, sort_order, is_approved) VALUES
    ('photo-user-006', 'user-006', 'https://picsum.photos/seed/james/600/800', 0, TRUE),
    ('photo-user-006b', 'user-006', 'https://picsum.photos/seed/james2/600/800', 1, TRUE),
    ('photo-user-007', 'user-007', 'https://picsum.photos/seed/zara/600/800', 0, TRUE),
    ('photo-user-008', 'user-008', 'https://picsum.photos/seed/daniel/600/800', 0, TRUE),
    ('photo-user-009', 'user-009', 'https://picsum.photos/seed/lily/600/800', 0, TRUE),
    ('photo-user-009b', 'user-009', 'https://picsum.photos/seed/lily2/600/800', 1, TRUE),
    ('photo-user-010', 'user-010', 'https://picsum.photos/seed/noah/600/800', 0, TRUE),
    ('photo-user-011', 'user-011', 'https://picsum.photos/seed/chloe/600/800', 0, TRUE);

INSERT IGNORE INTO preferences (id, user_id, min_age, max_age, max_distance_km, show_me) VALUES
    ('pref-user-006', 'user-006', 22, 35, 80, '["male", "female", "non_binary"]'),
    ('pref-user-007', 'user-007', 24, 40, 60, '["male", "female", "non_binary"]'),
    ('pref-user-008', 'user-008', 21, 38, 100, '["male", "female", "non_binary"]'),
    ('pref-user-009', 'user-009', 20, 32, 50, '["male", "female", "non_binary"]'),
    ('pref-user-010', 'user-010', 22, 36, 70, '["male", "female", "non_binary"]'),
    ('pref-user-011', 'user-011', 23, 40, 90, '["male", "female", "non_binary"]');

INSERT IGNORE INTO subscriptions (id, user_id, plan, is_active) VALUES
    ('sub-user-006', 'user-006', 'free', TRUE),
    ('sub-user-007', 'user-007', 'free', TRUE),
    ('sub-user-008', 'user-008', 'free', TRUE),
    ('sub-user-009', 'user-009', 'free', TRUE),
    ('sub-user-010', 'user-010', 'free', TRUE),
    ('sub-user-011', 'user-011', 'free', TRUE);

INSERT IGNORE INTO user_interests (user_id, interest_id) VALUES
    ('user-006', 2), ('user-006', 6), ('user-006', 1),
    ('user-007', 3), ('user-007', 2), ('user-007', 4),
    ('user-008', 4), ('user-008', 7), ('user-008', 8),
    ('user-009', 5), ('user-009', 1), ('user-009', 6),
    ('user-010', 3), ('user-010', 4), ('user-010', 7),
    ('user-011', 8), ('user-011', 6), ('user-011', 2);
