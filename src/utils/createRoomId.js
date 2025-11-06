export const createRoomId = (userId1, userId2) => {
  const ids = [userId1, userId2].sort();
  return `private-${ids[0]}-${ids[1]}`;
};