import app from './app';
import dotenv from 'dotenv';
import { startCronJobs } from './src/database/cronJobs';
import { syncSchema } from './src/database/schema';

dotenv.config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  try {
    await syncSchema();
  } catch (err) {
    console.error('[syncSchema] Error:', err);
  }
  console.log(`server running on port ${PORT}`);
  startCronJobs();
});

