import express, { json } from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import userRoutes from "./routes/userRoutes.js";
import { connectDB } from "./config/db.js";
import initSocket from "./socket/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.PORT || "http://localhost:3000", // REVIEW : Điêu cái này là port lsao có thể chạy ở origin
    methods: ["GET", "POST"],
  },
});

app.use(express.static(path.join(__dirname, "public")));

app.use(json());

// REVIEW: Ở môi trường thật sẽ ko log => gây rò rỉ dữ liệu => if (process.env.NODE_ENV !== 'production')
app.use((req, res, next) => {
  console.log(
    `${new Date().toISOString()} - ${req.method} ${req.url} - Body:`,
    req.body
  );
  next();
});

app.use("/api/users", userRoutes);
initSocket(io);

const PORT = process.env.PORT || 3000;

// REVIEW : Xử lý lỗi toàn cục
// app.use((err, req, res, next) => {
//   console.error('Unhandled error:', err);
//   res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
// });

const startServer = async () => {
  try {
    await connectDB();
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
};

startServer();
