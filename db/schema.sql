CREATE TABLE IF NOT EXISTS weather_current (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grid_x SMALLINT NOT NULL,
  grid_y SMALLINT NOT NULL,
  base_date VARCHAR(8) NOT NULL,
  base_time VARCHAR(4) NOT NULL,
  temperature DECIMAL(4,1),
  humidity SMALLINT,
  rainfall DECIMAL(5,1),
  wind_direction SMALLINT,
  wind_speed DECIMAL(4,1),
  wind_u DECIMAL(4,1),
  wind_v DECIMAL(4,1),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_grid_time (grid_x, grid_y, base_date, base_time),
  INDEX idx_base_datetime (base_date, base_time)
);

CREATE TABLE IF NOT EXISTS weather_ultra (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grid_x SMALLINT NOT NULL,
  grid_y SMALLINT NOT NULL,
  fcst_date VARCHAR(8) NOT NULL,
  fcst_time VARCHAR(4) NOT NULL,
  base_date VARCHAR(8) NOT NULL,
  base_time VARCHAR(4) NOT NULL,
  temperature DECIMAL(4,1),
  humidity SMALLINT,
  sky TINYINT,
  pty TINYINT,
  rainfall DECIMAL(5,1),
  lightning DECIMAL(5,1),
  wind_direction SMALLINT,
  wind_speed DECIMAL(4,1),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_grid_fcst (grid_x, grid_y, fcst_date, fcst_time),
  INDEX idx_fcst_datetime (fcst_date, fcst_time),
  INDEX idx_base_datetime (base_date, base_time)
);

CREATE TABLE IF NOT EXISTS weather_short (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grid_x SMALLINT NOT NULL,
  grid_y SMALLINT NOT NULL,
  fcst_date VARCHAR(8) NOT NULL,
  fcst_time VARCHAR(4) NOT NULL,
  base_date VARCHAR(8) NOT NULL,
  base_time VARCHAR(4) NOT NULL,
  temperature DECIMAL(4,1),
  temp_min DECIMAL(4,1),
  temp_max DECIMAL(4,1),
  humidity SMALLINT,
  sky TINYINT,
  pty TINYINT,
  pop SMALLINT,
  rainfall VARCHAR(20),
  snowfall VARCHAR(20),
  wind_direction SMALLINT,
  wind_speed DECIMAL(4,1),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_grid_fcst (grid_x, grid_y, fcst_date, fcst_time),
  INDEX idx_fcst_datetime (fcst_date, fcst_time),
  INDEX idx_base_datetime (base_date, base_time)
);

CREATE TABLE IF NOT EXISTS users (
  userid INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  max_count INT DEFAULT 10,
  authtoken VARCHAR(64),
  authtoken_expires_at TIMESTAMP NULL,
  apitoken VARCHAR(64) NOT NULL UNIQUE,
  plan_type ENUM('free', 'basic', 'premium', 'enterprise') DEFAULT 'free',
  failed_login_attempts INT DEFAULT 0,
  locked_until TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_apitoken (apitoken),
  INDEX idx_authtoken (authtoken),
  INDEX idx_username (username)
);

CREATE TABLE IF NOT EXISTS limit_status (
  logid INT AUTO_INCREMENT PRIMARY KEY,
  userid INT NOT NULL,
  endpoint VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userid) REFERENCES users(userid) ON DELETE CASCADE,
  INDEX idx_userid_created (userid, created_at)
);

CREATE TABLE IF NOT EXISTS api_logs (
  logid BIGINT AUTO_INCREMENT PRIMARY KEY,
  userid INT,
  endpoint VARCHAR(100) NOT NULL,
  method VARCHAR(10) NOT NULL,
  request_params JSON,
  response_status INT NOT NULL,
  response_time_ms INT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userid) REFERENCES users(userid) ON DELETE SET NULL,
  INDEX idx_userid_created (userid, created_at)
);

CREATE TABLE IF NOT EXISTS plan_limits (
  plan_type ENUM('free', 'basic', 'premium', 'enterprise') PRIMARY KEY,
  daily_limit INT NOT NULL,
  description VARCHAR(255)
);

INSERT INTO plan_limits (plan_type, daily_limit, description) VALUES
  ('free', 10, 'Free - 10 requests/day'),
  ('basic', 100, 'Basic - 100 requests/day'),
  ('premium', 1000, 'Premium - 1000 requests/day'),
  ('enterprise', 10000, 'Enterprise - 10000 requests/day')
ON DUPLICATE KEY UPDATE daily_limit = VALUES(daily_limit);

CREATE TABLE IF NOT EXISTS auth_rate_limit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ip_address VARCHAR(45) NOT NULL,
  endpoint VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ip_endpoint_created (ip_address, endpoint, created_at)
);
