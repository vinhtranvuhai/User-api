/* eslint-disable @typescript-eslint/no-unused-vars */
import Message from '../../models/Message.js';
import User from '../../models/userModel.js';
import { createRoomId } from '../../utils/createRoomId.js';

const RoomManager = {
  handle(socket, onlineUsers, io) {

    socket.on('room:find-user', async ({ email }, callback) => {
      try {
        const user = await User.findOne({ email }).select('_id name email');
        if (!user) return callback({ error: 'Không tìm thấy người dùng' });

        callback({
          user: {
            _id: user._id.toString(),
            name: user.name || user.email.split('@')[0],
            email: user.email
          }
        });
      } catch (err) {
        console.error('Find user error:', err);
        callback({ error: 'Lỗi hệ thống' });
      }
    });

  
    socket.on('room:join', async ({ roomId }) => {
      socket.join(roomId);
      console.log(`${socket.user.email} joined room: ${roomId}`);

      const members = this.getMembers(roomId, onlineUsers, io);
      socket.emit('room:joined', { roomId, members });

      socket.to(roomId).emit('room:user-joined', {
        user: { _id: socket.user._id, email: socket.user.email, name: socket.user.name },
        message: `${socket.user.name || socket.user.email} đã tham gia`
      });

      io.to(roomId).emit('room:members', members);

      const history = await Message.find({ roomId, deletedAt: null })
        .sort({ createdAt: 1 })
        .limit(50)
        .populate('from', 'name email _id');

      socket.emit('room:history', history.map(m => ({
        _id: m._id,
        user: {
          _id: m.from._id.toString(),
          email: m.from.email,
          name: m.from.name || m.from.email.split('@')[0]
        },
        message: m.content,
        timestamp: m.createdAt
      })));
    });

  
    socket.on('room:leave', ({ roomId }) => {
      socket.leave(roomId);
      console.log(`${socket.user.email} left room: ${roomId}`);

      const members = this.getMembers(roomId, onlineUsers, io);
      io.to(roomId).emit('room:members', members);
      socket.to(roomId).emit('room:user-left', {
        user: { _id: socket.user._id, email: socket.user.email, name: socket.user.name },
        message: `${socket.user.name || socket.user.email} đã rời phòng`
      });
    });


    socket.on('room:message', async ({ roomId, message }) => {
      try {
        const msg = await Message.create({
          roomId,
          from: socket.user._id,
          content: message
        });

        const populated = await msg.populate('from', 'name email _id');
        const payload = {
          _id: msg._id,
          user: {
            _id: populated.from._id.toString(),
            email: populated.from.email,
            name: populated.from.name || populated.from.email.split('@')[0]
          },
          message,
          timestamp: msg.createdAt
        };

        io.to(roomId).emit('room:message', payload);
             
        if (roomId.startsWith("private-")) {
          const userIds = roomId.replace("private-", "").split("-");
          const receiverId = userIds.find(id => id !== socket.user._id.toString());

          let receiverData = [...onlineUsers.values()].find(
            data => data.user._id.toString() === receiverId
          );

       
          const userNotificationEnabled = 
            typeof receiverData.user.notificationEnabled !== "undefined"
              ? receiverData.user.notificationEnabled
              : (await User.findById(receiverId).select("notificationEnabled"))
                  ?.notificationEnabled ?? true; 

        
          if (!userNotificationEnabled) {
            console.log(`Người nhận (${receiverData.user.email}) đã tắt thông báo`);
            return;
          }

          const receiverSocket = io.sockets.sockets.get(receiverData.socketId);

          if (receiverSocket && !receiverSocket.rooms.has(roomId)) {
            receiverSocket.emit("notification:receive", {
              from: {
                _id: socket.user._id,
                name: socket.user.name || socket.user.email,
                email: socket.user.email,
              },
              title: "Tin nhắn mới",
              body: message,
              type: "direct",
              roomId,
            });

            console.log(`Gửi thông báo tin nhắn riêng tới ${receiverData.user.email}`);
          }
        }


      } catch (err) {
        console.error('Save message error:', err);
        socket.emit('error', { message: 'Lưu tin nhắn thất bại' });
      }
    });

  
    socket.on('room:delete', async ({ msgId, roomId }) => {
      try {
        const result = await Message.findOneAndUpdate(
          { _id: msgId, from: socket.user._id },
          { deletedAt: new Date() },
          { new: true }
        );

        if (result) {
          io.to(roomId).emit('room:deleted', { msgId });
        }
      } catch (err) {
        console.error('Delete message error:', err);
        socket.emit('error', { message: 'Thu hồi thất bại' });
      }
    });


    socket.on('room:typing', ({ roomId, isTyping }) => {
      socket.to(roomId).emit('room:typing', {
        userId: socket.user._id.toString(),
        userName: socket.user.name || socket.user.email,
        isTyping
      });
    });

  
    socket.on('notification:toggle', async (enabled) => {
      try {
        await User.findByIdAndUpdate(socket.user._id, {
          notificationEnabled: enabled
        });
        socket.emit('notification:toggled', { enabled });
      } catch (err) {
        socket.emit('error', { message: 'Cập nhật thất bại' });
      }
    });
  },

  
  getMembers(roomId, onlineUsers, io) {
    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room) return [];

    return Array.from(room)
      .map(socketId => {
        for (const [userId, data] of onlineUsers.entries()) {
          if (data.socketId === socketId) {
            return {
              _id: data.user._id,
              email: data.user.email,
              name: data.user.name || data.user.email.split('@')[0],
              onlineStatus: 'online'
            };
          }
        }
        return null;
      })
      .filter(Boolean);
  }
};

export default RoomManager;