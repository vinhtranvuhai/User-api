import RoomManager from "./RoomManager.js";
import NotificationHandler from "./NotificationHandler.js";
import StateSyncHandler from "./StateSyncHandler.js";
import User from "../../models/userModel.js";

class SocketService {
  static onlineUsers = new Map();
  static socketIdToUser = new Map();
  static io = null;

  static init(io) {
    this.io = io;
    this.onlineUsers = new Map();
    this.socketIdToUser = new Map();
    // Nên có connect error
    io.on("connection", async (socket) => {
      const user = socket.user;

      if (!user || !user._id) {
        console.warn("Kết nối không hợp lệ - không có thông tin user");
        socket.disconnect(true);
        return;
      }

      const userId = user._id.toString();
      // Nếu 1 user connect từ 2 tab/ thiết bị khác => ghi đè => save mảng => khi disconnect => xóa khỏi mảng
      this.onlineUsers.set(userId, {
        socketId: socket.id,
        user: {
          _id: userId,
          email: user.email,
          name: user.name || user.email.split("@")[0],
          onlineStatus: "online",
        },
      });

      this.socketIdToUser.set(socket.id, {
        id: userId,
        name: user.name || user.email,
        email: user.email,
      });

      try {
        // Func này khả năng gây chết db => debounce hoặc batch update - update mỗi 30 giây/lần cho user nào thay đổi trạng thái
        // Hoặc lưu onlineStatus tạm trong Redis / memory, chỉ sync về DB định kỳ.
        await User.findByIdAndUpdate(userId, {
          onlineStatus: "online",
          lastSeen: new Date(),
        });
      } catch (err) {
        console.error("Lỗi cập nhật onlineStatus:", err);
      }

      console.log(`User connected: ${user.name || user.email} (${socket.id})`);

      this.io.emit(
        "server:online-users",
        Array.from(this.onlineUsers.values()).map((u) => u.user)
      );

      RoomManager.handle(socket, this.onlineUsers, this.io);
      NotificationHandler.handle(socket, this.onlineUsers, this.io);
      StateSyncHandler.handle(socket, this.io);

      // Nên có tránh trường hợp disconnect ảo => reload spam
      socket.on("disconnect", async () => {
        this.onlineUsers.delete(userId);
        this.socketIdToUser.delete(socket.id);

        try {
          await User.findByIdAndUpdate(userId, {
            onlineStatus: "offline",
            lastSeen: new Date(),
          });
        } catch (err) {
          console.error("Lỗi cập nhật offline:", err);
        }

        this.io.emit(
          "server:online-users",
          Array.from(this.onlineUsers.values()).map((u) => u.user)
        );

        console.log(`User disconnected: ${user.name || user.email}`);
      });
    });
  }
}

export default SocketService;
