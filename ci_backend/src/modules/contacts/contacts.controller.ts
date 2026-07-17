import { Request, Response, NextFunction } from 'express';
import { ContactsService } from './contacts.service';

const contactsService = new ContactsService();

export class ContactsController {
  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }
      const contact = await contactsService.createContact(req.user.id, req.body);
      res.status(201).json({
        success: true,
        message: 'Contact created successfully',
        data: contact,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }
      const contact = await contactsService.getContactById(req.user.id, req.params.id);
      res.status(200).json({
        success: true,
        message: 'Contact retrieved successfully',
        data: contact,
      });
    } catch (error) {
      next(error);
    }
  }

  public async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }
      const contact = await contactsService.updateContact(req.user.id, req.params.id, req.body);
      res.status(200).json({
        success: true,
        message: 'Contact updated successfully',
        data: contact,
      });
    } catch (error) {
      next(error);
    }
  }

  public async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }
      await contactsService.deleteContact(req.user.id, req.params.id);
      res.status(200).json({
        success: true,
        message: 'Contact deleted successfully',
        data: {},
      });
    } catch (error) {
      next(error);
    }
  }

  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }
      const result = await contactsService.listContacts(req.user.id, req.query);
      res.status(200).json({
        success: true,
        message: 'Contacts retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  public async createNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }
      const note = await contactsService.addNote(req.user.id, req.params.id, req.body.content);
      res.status(201).json({
        success: true,
        message: 'Note added to contact successfully',
        data: note,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getDuplicates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }
      const result = await contactsService.detectDuplicates(req.user.id, req.params.id);
      res.status(200).json({ success: true, message: 'Duplicate contacts analysis complete', data: result });
    } catch (error) {
      next(error);
    }
  }

  public async merge(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }
      const { targetId, sourceId } = req.body;
      if (!targetId || !sourceId) {
        res.status(400).json({ success: false, message: 'targetId and sourceId are required', error: {} });
        return;
      }
      const result = await contactsService.mergeContacts(req.user.id, targetId, sourceId);
      res.status(200).json({ success: true, message: 'Contacts successfully merged', data: result });
    } catch (error) {
      next(error);
    }
  }

  public async getTimeline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }
      const result = await contactsService.getContactTimeline(req.user.id, req.params.id);
      res.status(200).json({ success: true, message: 'Contact activity timeline retrieved', data: result });
    } catch (error) {
      next(error);
    }
  }

  public async exportData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }
      const format = req.query.format === 'csv' ? 'csv' : 'json';
      const contacts = await contactsService.exportContacts(req.user.id, req.query);

      if (format === 'csv') {
        const headers = ['ID', 'Name', 'Company', 'Designation', 'Email', 'Phone', 'Website', 'Address', 'Skills', 'Industry', 'DecisionMakerScore', 'Source', 'CreatedAt'];
        const csvRows = [headers.join(',')];
        for (const c of contacts) {
          const row = [
            `"${c.id}"`,
            `"${(c.name || '').replace(/"/g, '""')}"`,
            `"${(c.company || '').replace(/"/g, '""')}"`,
            `"${(c.designation || '').replace(/"/g, '""')}"`,
            `"${(c.email || '').replace(/"/g, '""')}"`,
            `"${(c.phone || '').replace(/"/g, '""')}"`,
            `"${(c.website || '').replace(/"/g, '""')}"`,
            `"${(c.address || '').replace(/"/g, '""')}"`,
            `"${c.skills.join('; ')}"`,
            `"${(c.industry || '').replace(/"/g, '""')}"`,
            c.decisionMakerScore,
            `"${c.source}"`,
            `"${c.createdAt.toISOString()}"`
          ];
          csvRows.push(row.join(','));
        }
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=contacts_export.csv');
        res.status(200).send(csvRows.join('\n'));
      } else {
        res.status(200).json({ success: true, message: 'Contacts exported successfully', data: contacts });
      }
    } catch (error) {
      next(error);
    }
  }

  public async getNotes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }
      const notes = await contactsService.listNotes(req.user.id, req.params.id);
      res.status(200).json({ success: true, message: 'Contact notes retrieved', data: notes });
    } catch (error) {
      next(error);
    }
  }

  public async updateNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }
      const note = await contactsService.updateNote(req.user.id, req.params.noteId, req.body.content);
      res.status(200).json({ success: true, message: 'Note updated successfully', data: note });
    } catch (error) {
      next(error);
    }
  }

  public async deleteNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }
      await contactsService.deleteNote(req.user.id, req.params.noteId);
      res.status(200).json({ success: true, message: 'Note deleted successfully', data: {} });
    } catch (error) {
      next(error);
    }
  }

  public async addTags(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }
      const { tags } = req.body;
      if (!tags || !Array.isArray(tags)) {
        res.status(400).json({ success: false, message: 'tags array is required', error: {} });
        return;
      }
      const contact = await contactsService.addTags(req.user.id, req.params.id, tags);
      res.status(200).json({ success: true, message: 'Tags connected successfully', data: contact });
    } catch (error) {
      next(error);
    }
  }

  public async removeTags(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }
      const { tags } = req.body;
      if (!tags || !Array.isArray(tags)) {
        res.status(400).json({ success: false, message: 'tags array is required', error: {} });
        return;
      }
      const contact = await contactsService.removeTags(req.user.id, req.params.id, tags);
      res.status(200).json({ success: true, message: 'Tags disconnected successfully', data: contact });
    } catch (error) {
      next(error);
    }
  }

  public async listTags(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }
      const tags = await contactsService.listTags(req.user.id);
      res.status(200).json({ success: true, message: 'User tags retrieved successfully', data: tags });
    } catch (error) {
      next(error);
    }
  }
}
