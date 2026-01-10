export function getOrCreateSessionId(): string {
  const SESSION_KEY = 'customer_session_id';
  let sessionId = localStorage.getItem(SESSION_KEY);

  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(SESSION_KEY, sessionId);
  }

  return sessionId;
}

export function clearSession(): void {
  localStorage.removeItem('customer_session_id');
}
