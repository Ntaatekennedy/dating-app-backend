const typingByMatch = new Map();

function setTyping(matchId, userId, isTyping) {
  if (!typingByMatch.has(matchId)) {
    typingByMatch.set(matchId, new Map());
  }
  const matchMap = typingByMatch.get(matchId);
  if (isTyping) {
    matchMap.set(userId, Date.now() + 3500);
  } else {
    matchMap.delete(userId);
  }
}

function isUserTyping(matchId, userId) {
  const matchMap = typingByMatch.get(matchId);
  if (!matchMap) return false;
  const expiresAt = matchMap.get(userId);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    matchMap.delete(userId);
    return false;
  }
  return true;
}

module.exports = { setTyping, isUserTyping };
