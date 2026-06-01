import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.DB_URL ?? "file:/home/claude/code/dcfc/db.sqlite",
});

const now = new Date().toISOString().replace("T", " ").slice(0, 19);

await db.executeMultiple(`
INSERT OR IGNORE INTO media (id, filename, mime_type, width, height, size_bytes, alt, created_at) VALUES
  ('mkvnwegz21drjwxm8v4q9pyx', 'mkvnwegz21drjwxm8v4q9pyx.png', 'image/png', 1500, 1500, 326880, 'Smokeys logo', '${now}'),
  ('x8rooiabquz8hrez4l7xrjt8', 'x8rooiabquz8hrez4l7xrjt8.png', 'image/png', 1048, 300,  32545,  'Green Electrical & Plumbing Supplies logo', '${now}'),
  ('pudzy8hhg1vmiotmdeb2m8r7', 'pudzy8hhg1vmiotmdeb2m8r7.png', 'image/png', 836,  320,  12505,  'Visit Bawtry logo', '${now}'),
  ('r5pkfmb8ci55x0bmef9qnn3m', 'r5pkfmb8ci55x0bmef9qnn3m.png', 'image/png', 1024, 1536, 316102, 'Alt Rubber and Plastics logo', '${now}'),
  ('iqr4c5g5qbv21q7nswfle4f0', 'iqr4c5g5qbv21q7nswfle4f0.png', 'image/png', 1418, 2051, 44728,  'Eland Cables logo', '${now}');

INSERT OR IGNORE INTO sponsors (id, name, url, tier, logo_media_id, active, sort_order, created_at) VALUES
  ('prtn69jlgg17bxb9e52nahd5', 'College Grove Estates', NULL, 'official', NULL, 1, 20, '${now}'),
  ('ble5wpxzre4bttj3d646f1po', 'Smokeys', 'https://smokeys.online/', 'official', 'mkvnwegz21drjwxm8v4q9pyx', 1, 30, '${now}'),
  ('k8pupkvulw6shg6g6sfczpv3', 'Green Electrical & Plumbing Supplies', 'https://www.green.supplies/', 'official', 'x8rooiabquz8hrez4l7xrjt8', 1, 40, '${now}'),
  ('sp8x5enty8ln881d32vrqipd', 'Visit Bawtry', 'https://www.visitbawtry.com/', 'official', 'pudzy8hhg1vmiotmdeb2m8r7', 1, 50, '${now}'),
  ('qyje2mwbkvye0ivobna0d1j4', 'Alt Rubber and Plastics', 'https://www.altrubberplastics.co.uk/', 'partner', 'r5pkfmb8ci55x0bmef9qnn3m', 1, 60, '${now}'),
  ('scovhp2kfsto9nx24a5bk9mt', 'Eland Cables', 'https://www.elandcables.com/', 'partner', 'iqr4c5g5qbv21q7nswfle4f0', 1, 70, '${now}');
`);

console.log("Done — 5 media rows + 6 sponsor rows inserted (or already existed).");
db.close();
