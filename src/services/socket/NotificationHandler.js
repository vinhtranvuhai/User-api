import User from '../../models/userModel.js';

const NotificationHandler = {
  handle(socket, onlineUsers, io) {
    socket.on('notification:send', async ({ targetUserId, title, body }) => {
      try {
        let targetSocketId = null;
        for (const [userId, data] of onlineUsers.entries()) {
          if (userId === targetUserId) {
            targetSocketId = data.socketId;
            break;
          }
        }

        if (!targetSocketId) {
          return socket.emit('notification:failed', {
            message: 'Người dùng không online'
          });
        }

        const targetUser = await User.findById(targetUserId).select('notificationEnabled');
        if (!targetUser || !targetUser.notificationEnabled) {
          return socket.emit('notification:failed', {
            message: 'Người dùng đã tắt thông báo'
          });
        }

        io.to(targetSocketId).emit('notification:receive', {
          title,
          body,
          type: 'direct',
          from: socket.user
        });

     
        socket.emit('notification:sent', { targetUserId });
      } catch (err) {
        console.error('Lỗi gửi 1-1:', err);
        socket.emit('notification:failed', { message: 'Lỗi hệ thống' });
      }
    });

    socket.on('notification:send-to-room', async ({ roomId, title, body }) => {
      try {
        const room = io.sockets.adapter.rooms.get(roomId);
        if (!room) {
          return socket.emit('notification:failed', {
            message: 'Phòng không tồn tại'
          });
        }

        let sentCount = 0;
        const userIdsToCheck = new Set();
 
        for (const socketId of room) {
          for (const [userId, data] of onlineUsers.entries()) {
            if (data.socketId === socketId) {
              userIdsToCheck.add(userId);
              break;
            }
          }
        }

        const users = await User.find({ _id: { $in: Array.from(userIdsToCheck) } })
          .select('_id notificationEnabled')
          .lean();

        const enabledMap = new Map(users.map(u => [u._id.toString(), u.notificationEnabled]));

      
        for (const socketId of room) {
          for (const [userId, data] of onlineUsers.entries()) {
            if (data.socketId === socketId && enabledMap.get(userId)) {
              io.to(socketId).emit('notification:receive', {
                title,
                body,
                type: 'group',
                from: socket.user
              });
              sentCount++;
              break;
            }
          }
        }

        socket.emit('notification:sent-to-room', { roomId, sentCount });
      } catch (err) {
        console.error('Lỗi gửi nhóm:', err);
        socket.emit('notification:failed', { message: 'Lỗi gửi nhóm' });
      }
    });

    socket.on('notification:toggle', async (enabled) => {
      try {
        await User.findByIdAndUpdate(socket.user._id, {
          notificationEnabled: enabled
        });
        socket.emit('notification:toggled', { enabled });
      } catch (err) {
        console.error('Lỗi toggle:', err);
        socket.emit('error', { message: 'Cập nhật thất bại' });
      }
    });
  }
};



export default NotificationHandler;
