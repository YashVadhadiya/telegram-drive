-- Telegram Drive Seed Data
-- Optional: Insert sample data for development

INSERT INTO users (id, telegram_id, username, first_name, storage_used, theme, created_at, updated_at, last_login_at)
VALUES ('usr_seed', 123456789, 'demo_user', 'Demo', 0, 'dark', 1700000000, 1700000000, 1700000000);

INSERT INTO folders (id, user_id, name, icon, color, telegram_group_id, sort_order, created_at, updated_at)
VALUES
  ('fld_seed_1', 'usr_seed', 'Movies', 'film', '#E74C3C', -1001234561, 0, 1700000000, 1700000000),
  ('fld_seed_2', 'usr_seed', 'Photos', 'image', '#2ECC71', -1001234562, 0, 1700000000, 1700000000),
  ('fld_seed_3', 'usr_seed', 'Documents', 'file-text', '#3498DB', -1001234563, 0, 1700000000, 1700000000),
  ('fld_seed_4', 'usr_seed', 'Music', 'music', '#9B59B6', -1001234564, 0, 1700000000, 1700000000),
  ('fld_seed_5', 'usr_seed', 'Projects', 'folder', '#F39C12', -1001234565, 0, 1700000000, 1700000000);

INSERT INTO files (id, user_id, folder_id, name, original_name, extension, mime_type, size, telegram_message_id, created_at, updated_at)
VALUES
  ('fil_seed_1', 'usr_seed', 'fld_seed_1', 'interstellar.mp4', 'interstellar.mp4', 'mp4', 'video/mp4', 1572864000, 101, 1700000000, 1700000000),
  ('fil_seed_2', 'usr_seed', 'fld_seed_1', 'matrix.mkv', 'matrix.mkv', 'mkv', 'video/x-matroska', 2147483648, 102, 1700000000, 1700000000),
  ('fil_seed_3', 'usr_seed', 'fld_seed_2', 'vacation.jpg', 'vacation.jpg', 'jpg', 'image/jpeg', 4194304, 201, 1700000000, 1700000000),
  ('fil_seed_4', 'usr_seed', 'fld_seed_2', 'profile.png', 'profile.png', 'png', 'image/png', 2097152, 202, 1700000000, 1700000000),
  ('fil_seed_5', 'usr_seed', 'fld_seed_3', 'report.pdf', 'report.pdf', 'pdf', 'application/pdf', 5242880, 301, 1700000000, 1700000000),
  ('fil_seed_6', 'usr_seed', 'fld_seed_3', 'spreadsheet.xlsx', 'spreadsheet.xlsx', 'xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 1048576, 302, 1700000000, 1700000000),
  ('fil_seed_7', 'usr_seed', 'fld_seed_4', 'album.mp3', 'album.mp3', 'mp3', 'audio/mpeg', 8388608, 401, 1700000000, 1700000000),
  ('fil_seed_8', 'usr_seed', 'fld_seed_4', 'podcast.wav', 'podcast.wav', 'wav', 'audio/wav', 31457280, 402, 1700000000, 1700000000),
  ('fil_seed_9', 'usr_seed', 'fld_seed_5', 'source-code.zip', 'source-code.zip', 'zip', 'application/zip', 15728640, 501, 1700000000, 1700000000),
  ('fil_seed_10', 'usr_seed', 'fld_seed_5', 'presentation.pptx', 'presentation.pptx', 'pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 5242880, 502, 1700000000, 1700000000);
