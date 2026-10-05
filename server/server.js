import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';

if (!process.env.VERCEL) {
  const port = Number(process.env.PORT) || 5000;
  try {
    await connectDB();
    app.listen(port, () => console.log(`API listening at http://localhost:${port}`));
  } catch (error) {
    console.error(`Server startup failed: ${error.message}`);
    process.exit(1);
  }
}

export default app;
