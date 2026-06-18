import express from 'express';
import router from './routes/api';

const app = express();
const PORT = 3001;

app.use(express.json());
app.use('/api', router);

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
console.log(`📡 Ready to receive requests...`);
});