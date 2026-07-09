function parseJsonArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
  return [];
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email ?? '',
    phone: row.phone,
    passwordHash: row.password_hash ?? '',
    isVerified: !!row.is_verified,
    isActive: !!row.is_active,
    lastActiveAt: row.last_active_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    bio: row.bio,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    interestedIn: parseJsonArray(row.interested_in),
    heightCm: row.height_cm,
    jobTitle: row.job_title,
    education: row.education,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    city: row.city,
    country: row.country,
    relationshipType: row.relationship_type,
    isVisible: !!row.is_visible,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPreferences(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    minAge: row.min_age,
    maxAge: row.max_age,
    maxDistanceKm: row.max_distance_km,
    showMe: parseJsonArray(row.show_me),
    updatedAt: row.updated_at,
  };
}

function mapPhoto(row, baseUrl) {
  if (!row) return null;
  let url = row.url;
  if (url && !url.startsWith('http')) {
    url = `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  }
  return {
    id: row.id,
    userId: row.user_id,
    url,
    sortOrder: row.sort_order,
    isApproved: !!row.is_approved,
    createdAt: row.created_at,
  };
}

function mapMatch(row) {
  if (!row) return null;
  return {
    id: row.id,
    user1Id: row.user1_id,
    user2Id: row.user2_id,
    matchedAt: row.matched_at,
    isActive: !!row.is_active,
  };
}

function mapMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    matchId: row.match_id,
    senderId: row.sender_id,
    content: row.content,
    isDelivered: !!row.is_delivered,
    isRead: !!row.is_read,
    sentAt: row.sent_at,
  };
}

function mapSubscription(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    plan: row.plan,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    isActive: !!row.is_active,
    paymentPhone: row.payment_phone,
  };
}

function mapInterest(row) {
  return { id: row.id, name: row.name };
}

module.exports = {
  mapUser,
  mapProfile,
  mapPreferences,
  mapPhoto,
  mapMatch,
  mapMessage,
  mapSubscription,
  mapInterest,
  parseJsonArray,
};
