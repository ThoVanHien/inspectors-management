import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { env } from '../../config/env';
import { pool } from '../../db/pool';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../utils/async-handler';
import { badRequest } from '../../utils/http-error';

export const filesRouter = Router();

const uploadSchema = z.object({
  fileType: z.enum(['CERTIFICATE_PDF', 'PAPER_EXAM_SCAN', 'CERTIFICATE_TEMPLATE', 'OTHER'])
});

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    const now = new Date();
    const dir = path.join(
      env.UPLOAD_ROOT,
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, '0')
    );
    fs.mkdirSync(dir, { recursive: true });
    callback(null, dir);
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase() || '.pdf';
    callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: env.MAX_PDF_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== 'application/pdf') {
      callback(badRequest('Only PDF uploads are allowed'));
      return;
    }
    callback(null, true);
  }
});

filesRouter.use(authenticate);

filesRouter.get(
  '/files',
  requireRoles('ADMIN', 'PART_LEADER'),
  asyncHandler(async (_req, res) => {
    const [files] = await pool.query(
      `SELECT
        id,
        original_name AS originalName,
        stored_name AS storedName,
        file_path AS filePath,
        mime_type AS mimeType,
        file_size AS fileSize,
        file_hash AS fileHash,
        file_type AS fileType,
        status,
        uploaded_by AS uploadedBy,
        created_at AS createdAt
      FROM files
      ORDER BY created_at DESC`
    );
    res.json({ data: files });
  })
);

filesRouter.post(
  '/files',
  requireRoles('ADMIN', 'PART_LEADER'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const parsed = uploadSchema.safeParse(req.body);

    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? 'Invalid file type');
    }

    if (!req.file) {
      throw badRequest('File is required');
    }

    const buffer = await fs.promises.readFile(req.file.path);
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

    const [result] = await pool.query(
      `INSERT INTO files
        (original_name, stored_name, file_path, mime_type, file_size, file_hash, file_type, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      [
        req.file.originalname,
        req.file.filename,
        req.file.path,
        req.file.mimetype,
        req.file.size,
        fileHash,
        parsed.data.fileType,
        req.user!.id
      ]
    );

    res.status(201).json({ id: Number((result as { insertId: number }).insertId), fileHash });
  })
);
