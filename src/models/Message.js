import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  roomId: { type: String, required: true }, 
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  type: { type: String, default: 'text' }, 
  createdAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null } 
});

export default mongoose.model('Message', messageSchema);