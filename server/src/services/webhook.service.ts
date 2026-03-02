// Tipos para eventos de webhook da Meta

export interface WhatsAppIncomingMessage {
  type: 'whatsapp_message';
  messageId: string;
  from: string; // phone number
  name: string; // sender profile name
  timestamp: string;
  messageType: 'text' | 'image' | 'audio' | 'video' | 'document';
  text?: string;
  mediaId?: string;
  mimeType?: string;
}

export interface WhatsAppStatusUpdate {
  type: 'whatsapp_status';
  messageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  recipientId: string;
  timestamp: string;
  errorMessage?: string;
}

export interface InstagramDMMessage {
  type: 'instagram_dm';
  messageId: string;
  senderId: string;
  recipientId: string;
  timestamp: string;
  text?: string;
  attachmentUrl?: string;
  attachmentType?: string;
}

export interface InstagramCommentEvent {
  type: 'instagram_comment';
  commentId: string;
  mediaId: string;
  senderId: string;
  senderUsername: string;
  text: string;
  timestamp: string;
}

export type WebhookEvent =
  | WhatsAppIncomingMessage
  | WhatsAppStatusUpdate
  | InstagramDMMessage
  | InstagramCommentEvent;

export class WebhookService {
  parseWhatsAppPayload(body: any): WebhookEvent[] {
    const events: WebhookEvent[] = [];

    try {
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          if (change.field !== 'messages') continue;
          const value = change.value;

          // Process incoming messages
          const messages = value.messages || [];
          const contacts = value.contacts || [];
          for (const msg of messages) {
            const contact = contacts.find((c: any) => c.wa_id === msg.from) || {};

            const event: WhatsAppIncomingMessage = {
              type: 'whatsapp_message',
              messageId: msg.id,
              from: msg.from,
              name: contact.profile?.name || msg.from,
              timestamp: msg.timestamp,
              messageType: msg.type || 'text',
              text: msg.text?.body,
              mediaId: msg.image?.id || msg.audio?.id || msg.video?.id || msg.document?.id,
              mimeType: msg.image?.mime_type || msg.audio?.mime_type || msg.video?.mime_type || msg.document?.mime_type,
            };
            events.push(event);
          }

          // Process status updates
          const statuses = value.statuses || [];
          for (const status of statuses) {
            const statusMap: Record<string, 'sent' | 'delivered' | 'read' | 'failed'> = {
              sent: 'sent',
              delivered: 'delivered',
              read: 'read',
              failed: 'failed',
            };

            const event: WhatsAppStatusUpdate = {
              type: 'whatsapp_status',
              messageId: status.id,
              status: statusMap[status.status] || 'sent',
              recipientId: status.recipient_id,
              timestamp: status.timestamp,
              errorMessage: status.errors?.[0]?.message,
            };
            events.push(event);
          }
        }
      }
    } catch (e) {
      console.error('Erro ao parsear webhook WhatsApp:', e);
    }

    return events;
  }

  parseInstagramPayload(body: any): WebhookEvent[] {
    const events: WebhookEvent[] = [];

    try {
      const entries = body.entry || [];
      for (const entry of entries) {
        // Instagram DMs (messaging field)
        const messaging = entry.messaging || [];
        for (const msg of messaging) {
          if (msg.message) {
            const event: InstagramDMMessage = {
              type: 'instagram_dm',
              messageId: msg.message.mid,
              senderId: msg.sender.id,
              recipientId: msg.recipient.id,
              timestamp: String(msg.timestamp),
              text: msg.message.text,
              attachmentUrl: msg.message.attachments?.[0]?.payload?.url,
              attachmentType: msg.message.attachments?.[0]?.type,
            };
            events.push(event);
          }
        }

        // Instagram Comments (changes field)
        const changes = entry.changes || [];
        for (const change of changes) {
          if (change.field === 'comments') {
            const val = change.value;
            const event: InstagramCommentEvent = {
              type: 'instagram_comment',
              commentId: val.id,
              mediaId: val.media?.id || '',
              senderId: val.from?.id || '',
              senderUsername: val.from?.username || '',
              text: val.text || '',
              timestamp: String(entry.time || Date.now()),
            };
            events.push(event);
          }
        }
      }
    } catch (e) {
      console.error('Erro ao parsear webhook Instagram:', e);
    }

    return events;
  }
}
