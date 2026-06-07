require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'epet1',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'iot2026pass',
});

// 挂载到全局，供各路由直接使用
global.db = pool;

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 路由
app.use('/api/epet1/user',      require('./routes/users')(pool));
app.use('/api/epet1/pet',        require('./routes/pets')(pool));
app.use('/api/epet1/postcard',   require('./routes/postcards')(pool));
app.use('/api/epet1/shop',       require('./routes/shop')(pool));
app.use('/api/epet1/travel',     require('./routes/travel')(pool));
app.use('/api/epet1/drift',      require('./routes/drift')(pool));
app.use('/api/epet1/game',       require('./routes/games')(pool));
app.use('/api/epet1/chat',       require('./routes/chat')(pool));

// 情绪值相关路由
app.use('/api/epet1/emotion',    require('./routes/emotion')(pool));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`E-Pet1 Backend running on http://0.0.0.0:${PORT}`);
});
