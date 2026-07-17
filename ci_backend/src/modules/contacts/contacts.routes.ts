import { Router } from 'express';
import { ContactsController } from './contacts.controller';
import { authenticateJWT } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { createContactSchema, updateContactSchema, queryContactSchema } from './contacts.validator';

const router = Router();
const controller = new ContactsController();

/**
 * @openapi
 * tags:
 *   name: Contacts
 *   description: Manage contact profiles, run full-text filters, sorting, and append notes.
 */

/**
 * @openapi
 * /api/contacts:
 *   post:
 *     summary: Create a new contact
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Jane Smith
 *               company:
 *                 type: string
 *                 example: Innovate Tech
 *               designation:
 *                 type: string
 *                 example: Director of Product
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane.smith@innovate.io
 *               phone:
 *                 type: string
 *                 example: +1-555-123-4567
 *               website:
 *                 type: string
 *                 example: https://innovate.io
 *               address:
 *                 type: string
 *                 example: Austin, TX
 *               linkedInUrl:
 *                 type: string
 *                 example: https://linkedin.com/in/janesmith-innovate
 *               skills:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["TypeScript", "Node.js"]
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Lead", "Tech"]
 *               notes:
 *                 type: string
 *                 example: Met at Tech Conference 2026.
 *     responses:
 *       201:
 *         description: Contact created successfully, background enrichment jobs queued.
 */
router.post('/', authenticateJWT, validate(createContactSchema), controller.create);

/**
 * @openapi
 * /api/contacts:
 *   get:
 *     summary: Retrieve contacts list
 *     description: Supports search, field filtering, tag matching, sorting, and pagination.
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 10
 *       - name: search
 *         in: query
 *         description: Full-text search over name, company, email, phone
 *         schema:
 *           type: string
 *       - name: sortBy
 *         in: query
 *         schema:
 *           type: string
 *           enum: [name, company, industry, decisionMakerScore, createdAt]
 *           default: createdAt
 *       - name: sortOrder
 *         in: query
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *       - name: tags
 *         in: query
 *         description: Comma-separated tag filters (e.g. Lead,Tech)
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contacts list retrieved successfully
 */
router.get('/', authenticateJWT, validate(queryContactSchema), controller.list);

router.get('/export', authenticateJWT, controller.exportData);
router.post('/merge', authenticateJWT, controller.merge);
router.get('/tags', authenticateJWT, controller.listTags);

/**
 * @openapi
 * /api/contacts/{id}:
 *   get:
 *     summary: Retrieve detailed contact record by ID
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contact retrieved successfully
 *       404:
 *         description: Contact not found
 */
router.get('/:id', authenticateJWT, controller.getOne);

/**
 * @openapi
 * /api/contacts/{id}:
 *   patch:
 *     summary: Update contact properties
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               company:
 *                 type: string
 *               designation:
 *                 type: string
 *               skills:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Contact updated successfully
 */
router.patch('/:id', authenticateJWT, validate(updateContactSchema), controller.update);

/**
 * @openapi
 * /api/contacts/{id}:
 *   delete:
 *     summary: Delete contact
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contact deleted successfully
 */
router.delete('/:id', authenticateJWT, controller.remove);

/**
 * @openapi
 * /api/contacts/{id}/notes:
 *   post:
 *     summary: Append a note to a contact
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 example: Emailed contact regarding new proposals.
 *     responses:
 *       201:
 *         description: Note appended successfully
 */
router.post('/:id/notes', authenticateJWT, controller.createNote);
router.get('/:id/notes', authenticateJWT, controller.getNotes);
router.patch('/notes/:noteId', authenticateJWT, controller.updateNote);
router.delete('/notes/:noteId', authenticateJWT, controller.deleteNote);

router.post('/:id/tags', authenticateJWT, controller.addTags);
router.delete('/:id/tags', authenticateJWT, controller.removeTags);

router.get('/:id/duplicates', authenticateJWT, controller.getDuplicates);
router.get('/:id/timeline', authenticateJWT, controller.getTimeline);

export default router;
