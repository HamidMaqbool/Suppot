
export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface User {
  id: number | string;
  name: string;
  email: string;
  avatar?: string;
  role: 'user' | 'admin';
  roles?: string[];
}

export interface Message {
  id: number | string;
  ticketId: number | string;
  senderId?: number | string;
  content?: string;
  createdAt: string;
  attachments?: string[];
  replyToId?: number | string;
  isSystem?: boolean;
  isInternal?: boolean;
}

export interface Ticket {
  id: number | string;
  userId: number | string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string;
  assignedTo?: number | string;
  rating?: number;
  feedback?: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
}
