-- ============================================================
-- Dating App — MySQL 8.0+ (schema + sample data)
-- Compatible with MySQL Workbench
-- Run this single file to create the database, tables, and demo data.
-- ============================================================

DROP DATABASE IF EXISTS dating_app;

CREATE DATABASE dating_app
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE dating_app;

-- ============================================================
-- TABLES
-- ============================================================

-- 1. USERS
CREATE TABLE users (
    id              CHAR(36)        PRIMARY KEY,
    email           VARCHAR(255)    UNIQUE,
    phone           VARCHAR(20)     UNIQUE,
    password_hash   VARCHAR(255),
    is_verified     BOOLEAN         DEFAULT FALSE,
    is_active       BOOLEAN         DEFAULT TRUE,
    last_active_at  TIMESTAMP       NULL,
    created_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 1b. PHONE OTPs (sign-in / sign-up verification)
CREATE TABLE phone_otps (
    id              CHAR(36)        PRIMARY KEY,
    phone           VARCHAR(20)     NOT NULL,
    code            VARCHAR(6)      NOT NULL,
    purpose         ENUM('login', 'register') NOT NULL,
    expires_at      TIMESTAMP       NOT NULL,
    used_at         TIMESTAMP       NULL,
    created_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_phone_otps_phone_purpose (phone, purpose),
    INDEX idx_phone_otps_expires (expires_at)
) ENGINE=InnoDB;

-- 1c. PASSWORD RESET CODES
CREATE TABLE password_reset_codes (
    id              CHAR(36)        PRIMARY KEY,
    email           VARCHAR(255)    NOT NULL,
    code            VARCHAR(6)      NOT NULL,
    expires_at      TIMESTAMP       NOT NULL,
    used_at         TIMESTAMP       NULL,
    created_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_password_reset_email (email),
    INDEX idx_password_reset_expires (expires_at)
) ENGINE=InnoDB;

-- 2. PROFILES
CREATE TABLE profiles (
    id              CHAR(36)        PRIMARY KEY,
    user_id         CHAR(36)        NOT NULL UNIQUE,
    display_name    VARCHAR(100)    NOT NULL,
    bio             TEXT,
    date_of_birth   DATE            NOT NULL,
    gender          VARCHAR(20)     NOT NULL,
    interested_in   JSON            NOT NULL,
    height_cm       SMALLINT,
    job_title       VARCHAR(100),
    education       VARCHAR(100),
    latitude        DECIMAL(10, 8)  NULL,
    longitude       DECIMAL(11, 8)  NULL,
    city            VARCHAR(100),
    country         VARCHAR(100),
    relationship_type ENUM('long_term', 'short_term', 'just_fun', 'making_friends') NULL,
    is_visible      BOOLEAN         DEFAULT TRUE,
    created_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_profiles_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_profiles_gender    ON profiles(gender);
CREATE INDEX idx_profiles_location  ON profiles(latitude, longitude);
CREATE INDEX idx_profiles_visible   ON profiles(is_visible);

-- 3. PHOTOS
CREATE TABLE photos (
    id              CHAR(36)        PRIMARY KEY,
    user_id         CHAR(36)        NOT NULL,
    url             TEXT            NOT NULL,
    sort_order      SMALLINT        DEFAULT 0,
    is_approved     BOOLEAN         DEFAULT FALSE,
    created_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_photos_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_photos_user ON photos(user_id);

-- 4. PREFERENCES
CREATE TABLE preferences (
    id              CHAR(36)        PRIMARY KEY,
    user_id         CHAR(36)        NOT NULL UNIQUE,
    min_age         SMALLINT        DEFAULT 18,
    max_age         SMALLINT        DEFAULT 99,
    max_distance_km SMALLINT        DEFAULT 50,
    show_me         JSON            NOT NULL,
    updated_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_preferences_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. SWIPES
CREATE TABLE swipes (
    id              CHAR(36)        PRIMARY KEY,
    swiper_id       CHAR(36)        NOT NULL,
    swiped_id       CHAR(36)        NOT NULL,
    action          ENUM('like', 'pass', 'super_like') NOT NULL,
    created_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_swipes_swiper
        FOREIGN KEY (swiper_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_swipes_swiped
        FOREIGN KEY (swiped_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_swipe_pair
        UNIQUE (swiper_id, swiped_id)
) ENGINE=InnoDB;

CREATE INDEX idx_swipes_swiper ON swipes(swiper_id);
CREATE INDEX idx_swipes_swiped ON swipes(swiped_id, action);

-- 6. MATCHES
CREATE TABLE matches (
    id              CHAR(36)        PRIMARY KEY,
    user1_id        CHAR(36)        NOT NULL,
    user2_id        CHAR(36)        NOT NULL,
    matched_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    is_active       BOOLEAN         DEFAULT TRUE,

    CONSTRAINT fk_matches_user1
        FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_matches_user2
        FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_match_pair
        UNIQUE (user1_id, user2_id),
    CONSTRAINT chk_user_order
        CHECK (user1_id < user2_id)
) ENGINE=InnoDB;

CREATE INDEX idx_matches_user1 ON matches(user1_id, is_active);
CREATE INDEX idx_matches_user2 ON matches(user2_id, is_active);

-- 7. MESSAGES
CREATE TABLE messages (
    id              CHAR(36)        PRIMARY KEY,
    match_id        CHAR(36)        NOT NULL,
    sender_id       CHAR(36)        NOT NULL,
    content         TEXT            NOT NULL,
    is_read         BOOLEAN         DEFAULT FALSE,
    sent_at         TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_messages_match
        FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    CONSTRAINT fk_messages_sender
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_messages_match  ON messages(match_id, sent_at DESC);
CREATE INDEX idx_messages_unread ON messages(match_id, is_read);

-- 8. BLOCKS
CREATE TABLE blocks (
    id              CHAR(36)        PRIMARY KEY,
    blocker_id      CHAR(36)        NOT NULL,
    blocked_id      CHAR(36)        NOT NULL,
    created_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_blocks_blocker
        FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_blocks_blocked
        FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_block_pair
        UNIQUE (blocker_id, blocked_id)
) ENGINE=InnoDB;

-- 9. REPORTS
CREATE TABLE reports (
    id              CHAR(36)        PRIMARY KEY,
    reporter_id     CHAR(36)        NOT NULL,
    reported_id     CHAR(36)        NOT NULL,
    reason          ENUM(
                        'fake_profile',
                        'inappropriate_content',
                        'harassment',
                        'spam',
                        'underage',
                        'other'
                    ) NOT NULL,
    details         TEXT,
    status          ENUM('pending', 'reviewed', 'actioned') DEFAULT 'pending',
    created_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_reports_reporter
        FOREIGN KEY (reporter_id) REFERENCES users(id),
    CONSTRAINT fk_reports_reported
        FOREIGN KEY (reported_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- 10. SUBSCRIPTIONS
CREATE TABLE subscriptions (
    id              CHAR(36)        PRIMARY KEY,
    user_id         CHAR(36)        NOT NULL,
    plan            ENUM('free', 'daily', 'weekly', 'monthly') DEFAULT 'free',
    starts_at       TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    expires_at      TIMESTAMP       NULL,
    is_active       BOOLEAN         DEFAULT TRUE,
    payment_phone   VARCHAR(20)     NULL,

    CONSTRAINT fk_subscriptions_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 11. INTERESTS
CREATE TABLE interests (
    id      INT             AUTO_INCREMENT PRIMARY KEY,
    name    VARCHAR(50)     NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE user_interests (
    user_id     CHAR(36)    NOT NULL,
    interest_id INT         NOT NULL,

    PRIMARY KEY (user_id, interest_id),
    CONSTRAINT fk_ui_user
        FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
    CONSTRAINT fk_ui_interest
        FOREIGN KEY (interest_id) REFERENCES interests(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- TRIGGER — auto-create match on mutual like
-- ============================================================
DELIMITER $$

CREATE TRIGGER trg_create_match
AFTER INSERT ON swipes
FOR EACH ROW
BEGIN
    IF NEW.action IN ('like', 'super_like') THEN
        IF EXISTS (
            SELECT 1 FROM swipes
            WHERE swiper_id = NEW.swiped_id
              AND swiped_id = NEW.swiper_id
              AND action IN ('like', 'super_like')
        ) THEN
            INSERT IGNORE INTO matches (id, user1_id, user2_id)
            VALUES (
                UUID(),
                LEAST(NEW.swiper_id, NEW.swiped_id),
                GREATEST(NEW.swiper_id, NEW.swiped_id)
            );
        END IF;
    END IF;
END$$

DELIMITER ;

-- ============================================================
-- SAMPLE DATA (matches Flutter mock users)
-- Demo password: password123 (plain text for local dev only)
-- ============================================================

INSERT INTO interests (name) VALUES
    ('Travel'), ('Music'), ('Fitness'), ('Cooking'),
    ('Photography'), ('Movies'), ('Hiking'), ('Reading');

INSERT INTO users (id, email, phone, password_hash, is_verified, last_active_at) VALUES
    ('user-demo-me', 'demo@dating.app', '+256700100001', 'password123', TRUE, NOW()),
    ('user-001', 'emma@example.com', '+256700100002', 'password123', TRUE, NOW()),
    ('user-002', 'sophia@example.com', '+256700100003', 'password123', TRUE, NOW()),
    ('user-003', 'mia@example.com', '+256700100004', 'password123', TRUE, NOW()),
    ('user-004', 'olivia@example.com', '+256700100005', 'password123', TRUE, NOW()),
    ('user-005', 'ava@example.com', '+256700100006', 'password123', TRUE, NOW()),
    ('user-006', 'james@example.com', '+256700100007', 'password123', TRUE, NOW()),
    ('user-007', 'zara@example.com', '+256700100008', 'password123', TRUE, NOW()),
    ('user-008', 'daniel@example.com', '+256700100009', 'password123', TRUE, DATE_SUB(NOW(), INTERVAL 2 DAY)),
    ('user-009', 'lily@example.com', '+256700100010', 'password123', TRUE, DATE_SUB(NOW(), INTERVAL 5 MINUTE)),
    ('user-010', 'noah@example.com', '+256700100011', 'password123', TRUE, NOW()),
    ('user-011', 'chloe@example.com', '+256700100012', 'password123', TRUE, DATE_SUB(NOW(), INTERVAL 1 HOUR));

INSERT INTO profiles (id, user_id, display_name, bio, date_of_birth, gender, interested_in,
    height_cm, job_title, education, latitude, longitude, city, country, relationship_type) VALUES
    ('profile-user-demo-me', 'user-demo-me', 'Alex',
     'Coffee lover, weekend hiker, always up for new adventures.',
     '1995-06-15', 'male', '["male", "female", "non_binary"]',
     170, 'Software Engineer', 'BSc Computer Science', 41.0082, 28.9784, 'Istanbul', 'Turkey', 'long_term'),
    ('profile-user-001', 'user-001', 'Emma',
     'Art gallery weekends and spontaneous road trips.',
     '1997-03-22', 'female', '["male", "female", "non_binary"]',
     170, 'Graphic Designer', 'BA Fine Arts', 41.015, 28.98, 'Istanbul', 'Turkey', 'long_term'),
    ('profile-user-002', 'user-002', 'Sophia',
     'Yoga instructor. Looking for genuine connections.',
     '1994-11-08', 'female', '["male", "female", "non_binary"]',
     170, 'Yoga Instructor', 'Certified Yoga Teacher', 41.02, 28.965, 'Istanbul', 'Turkey', 'short_term'),
    ('profile-user-003', 'user-003', 'Mia',
     'Bookworm by day, concert-goer by night.',
     '1999-07-30', 'female', '["male", "female", "non_binary"]',
     170, 'Marketing Specialist', 'MBA', 39.9334, 32.8597, 'Ankara', 'Turkey', 'just_fun'),
    ('profile-user-004', 'user-004', 'Olivia',
     'Foodie exploring every hidden gem in the city.',
     '1996-01-14', 'female', '["male", "female", "non_binary"]',
     170, 'Chef', 'Culinary Institute', 38.4237, 27.1428, 'Izmir', 'Turkey', 'making_friends'),
    ('profile-user-005', 'user-005', 'Ava',
     'Photographer capturing moments and making memories.',
     '1998-09-05', 'non_binary', '["male", "female", "non_binary"]',
     170, 'Photographer', 'BA Visual Arts', 41.01, 28.97, 'Istanbul', 'Turkey', 'making_friends'),
    ('profile-user-006', 'user-006', 'James',
     'Startup founder who loves live music and rooftop sunsets.',
     '1993-04-18', 'male', '["male", "female", "non_binary"]',
     178, 'Entrepreneur', 'MBA', 0.3476, 32.5825, 'Kampala', 'Uganda', 'long_term'),
    ('profile-user-007', 'user-007', 'Zara',
     'Nurse by day, dancer by night. Good vibes only.',
     '1996-12-02', 'female', '["male", "female", "non_binary"]',
     165, 'Registered Nurse', 'BSc Nursing', 0.0564, 32.4637, 'Entebbe', 'Uganda', 'short_term'),
    ('profile-user-008', 'user-008', 'Daniel',
     'Cyclist, coffee nerd, and amateur chef.',
     '1991-08-25', 'male', '["male", "female", "non_binary"]',
     182, 'Product Manager', 'BSc Information Systems', 0.4244, 33.2042, 'Jinja', 'Uganda', 'making_friends'),
    ('profile-user-009', 'user-009', 'Lily',
     'Fashion stylist with a soft spot for vintage markets.',
     '2000-02-14', 'female', '["male", "female", "non_binary"]',
     168, 'Fashion Stylist', 'Diploma Fashion Design', 0.3510, 32.5900, 'Kampala', 'Uganda', 'just_fun'),
    ('profile-user-010', 'user-010', 'Noah',
     'Personal trainer helping people crush their goals.',
     '1994-06-09', 'male', '["male", "female", "non_binary"]',
     185, 'Personal Trainer', 'Certified Fitness Coach', 0.3400, 32.5750, 'Kampala', 'Uganda', 'short_term'),
    ('profile-user-011', 'user-011', 'Chloe',
     'Teacher, book club host, and weekend brunch enthusiast.',
     '1997-10-21', 'female', '["male", "female", "non_binary"]',
     172, 'High School Teacher', 'BA Education', -0.6100, 30.6580, 'Mbarara', 'Uganda', 'long_term');

INSERT INTO photos (id, user_id, url, sort_order, is_approved) VALUES
    ('photo-user-demo-me', 'user-demo-me', 'https://picsum.photos/seed/alex/600/800', 0, TRUE),
    ('photo-user-001', 'user-001', 'https://picsum.photos/seed/emma/600/800', 0, TRUE),
    ('photo-user-002', 'user-002', 'https://picsum.photos/seed/sophia/600/800', 0, TRUE),
    ('photo-user-003', 'user-003', 'https://picsum.photos/seed/mia/600/800', 0, TRUE),
    ('photo-user-004', 'user-004', 'https://picsum.photos/seed/olivia/600/800', 0, TRUE),
    ('photo-user-005', 'user-005', 'https://picsum.photos/seed/ava/600/800', 0, TRUE),
    ('photo-user-006', 'user-006', 'https://picsum.photos/seed/james/600/800', 0, TRUE),
    ('photo-user-006b', 'user-006', 'https://picsum.photos/seed/james2/600/800', 1, TRUE),
    ('photo-user-007', 'user-007', 'https://picsum.photos/seed/zara/600/800', 0, TRUE),
    ('photo-user-008', 'user-008', 'https://picsum.photos/seed/daniel/600/800', 0, TRUE),
    ('photo-user-009', 'user-009', 'https://picsum.photos/seed/lily/600/800', 0, TRUE),
    ('photo-user-009b', 'user-009', 'https://picsum.photos/seed/lily2/600/800', 1, TRUE),
    ('photo-user-010', 'user-010', 'https://picsum.photos/seed/noah/600/800', 0, TRUE),
    ('photo-user-011', 'user-011', 'https://picsum.photos/seed/chloe/600/800', 0, TRUE);

INSERT INTO preferences (id, user_id, min_age, max_age, max_distance_km, show_me) VALUES
    ('pref-user-demo-me', 'user-demo-me', 18, 99, 50, '["male", "female", "non_binary"]'),
    ('pref-user-001', 'user-001', 18, 99, 50, '["male", "female", "non_binary"]'),
    ('pref-user-002', 'user-002', 18, 99, 50, '["male", "female", "non_binary"]'),
    ('pref-user-003', 'user-003', 18, 99, 50, '["male", "female", "non_binary"]'),
    ('pref-user-004', 'user-004', 18, 99, 50, '["male", "female", "non_binary"]'),
    ('pref-user-005', 'user-005', 18, 99, 50, '["male", "female", "non_binary"]'),
    ('pref-user-006', 'user-006', 22, 35, 80, '["male", "female", "non_binary"]'),
    ('pref-user-007', 'user-007', 24, 40, 60, '["male", "female", "non_binary"]'),
    ('pref-user-008', 'user-008', 21, 38, 100, '["male", "female", "non_binary"]'),
    ('pref-user-009', 'user-009', 20, 32, 50, '["male", "female", "non_binary"]'),
    ('pref-user-010', 'user-010', 22, 36, 70, '["male", "female", "non_binary"]'),
    ('pref-user-011', 'user-011', 23, 40, 90, '["male", "female", "non_binary"]');

INSERT INTO subscriptions (id, user_id, plan, is_active) VALUES
    ('sub-user-demo-me', 'user-demo-me', 'free', TRUE),
    ('sub-user-001', 'user-001', 'free', TRUE),
    ('sub-user-002', 'user-002', 'free', TRUE),
    ('sub-user-003', 'user-003', 'free', TRUE),
    ('sub-user-004', 'user-004', 'free', TRUE),
    ('sub-user-005', 'user-005', 'free', TRUE),
    ('sub-user-006', 'user-006', 'free', TRUE),
    ('sub-user-007', 'user-007', 'free', TRUE),
    ('sub-user-008', 'user-008', 'free', TRUE),
    ('sub-user-009', 'user-009', 'free', TRUE),
    ('sub-user-010', 'user-010', 'free', TRUE),
    ('sub-user-011', 'user-011', 'free', TRUE);

INSERT INTO user_interests (user_id, interest_id) VALUES
    ('user-demo-me', 1), ('user-demo-me', 3), ('user-demo-me', 7),
    ('user-001', 1), ('user-001', 2), ('user-001', 5),
    ('user-002', 3), ('user-002', 4), ('user-002', 7),
    ('user-003', 2), ('user-003', 6), ('user-003', 8),
    ('user-004', 4), ('user-004', 1), ('user-004', 6),
    ('user-005', 5), ('user-005', 1), ('user-005', 2),
    ('user-006', 2), ('user-006', 6), ('user-006', 1),
    ('user-007', 3), ('user-007', 2), ('user-007', 4),
    ('user-008', 4), ('user-008', 7), ('user-008', 8),
    ('user-009', 5), ('user-009', 1), ('user-009', 6),
    ('user-010', 3), ('user-010', 4), ('user-010', 7),
    ('user-011', 8), ('user-011', 6), ('user-011', 2);

INSERT INTO matches (id, user1_id, user2_id, matched_at) VALUES
    ('match-001', 'user-001', 'user-demo-me', DATE_SUB(NOW(), INTERVAL 2 DAY));

INSERT INTO messages (id, match_id, sender_id, content, is_read, sent_at) VALUES
    ('msg-001', 'match-001', 'user-001', 'Hey! Love your profile 😊', TRUE, DATE_SUB(NOW(), INTERVAL 5 HOUR)),
    ('msg-002', 'match-001', 'user-demo-me', 'Thanks! Your art photos are amazing.', TRUE, DATE_SUB(NOW(), INTERVAL 4 HOUR)),
    ('msg-003', 'match-001', 'user-001', 'Want to grab coffee this weekend?', FALSE, DATE_SUB(NOW(), INTERVAL 1 HOUR));

-- Sophia already liked Alex — liking her back in the app creates a match
INSERT INTO swipes (id, swiper_id, swiped_id, action) VALUES
    ('swipe-sophia-like', 'user-002', 'user-demo-me', 'like');

-- ============================================================
-- REFERENCE QUERIES (for your backend — not executed here)
-- ============================================================
/*
-- Discover profiles
SELECT p.*, ph.url AS primary_photo
FROM profiles p
JOIN photos ph ON ph.user_id = p.user_id AND ph.sort_order = 0
WHERE p.user_id != :current_user_id
  AND p.is_visible = TRUE
  AND JSON_CONTAINS(:show_me, JSON_QUOTE(p.gender))
  AND TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) BETWEEN :min_age AND :max_age
  AND (
      6371 * ACOS(
          COS(RADIANS(:my_lat)) * COS(RADIANS(p.latitude))
          * COS(RADIANS(p.longitude) - RADIANS(:my_lng))
          + SIN(RADIANS(:my_lat)) * SIN(RADIANS(p.latitude))
      )
  ) <= :max_distance_km
  AND p.user_id NOT IN (
      SELECT swiped_id FROM swipes WHERE swiper_id = :current_user_id
  )
  AND p.user_id NOT IN (
      SELECT blocked_id FROM blocks WHERE blocker_id = :current_user_id
      UNION
      SELECT blocker_id FROM blocks WHERE blocked_id = :current_user_id
  )
ORDER BY p.updated_at DESC
LIMIT 20;

-- Match list with last message
SELECT
    m.*,
    CASE WHEN m.user1_id = :me THEN p2.display_name ELSE p1.display_name END AS match_name,
    msg.content     AS last_message,
    msg.sent_at     AS last_message_at
FROM matches m
JOIN profiles p1 ON p1.user_id = m.user1_id
JOIN profiles p2 ON p2.user_id = m.user2_id
LEFT JOIN (
    SELECT match_id, content, sent_at,
           ROW_NUMBER() OVER (PARTITION BY match_id ORDER BY sent_at DESC) AS rn
    FROM messages
) msg ON msg.match_id = m.id AND msg.rn = 1
WHERE (m.user1_id = :me OR m.user2_id = :me)
  AND m.is_active = TRUE
ORDER BY msg.sent_at DESC;
*/
